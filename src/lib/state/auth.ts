"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  getSupabaseClient,
  signInWithEmail,
  signOut,
} from "@/lib/api/supabase";
import { db, type User } from "@/lib/db-local/db";

export type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error?: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrateUserFromLocal: (email: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: "idle",
      error: undefined,
      async hydrateUserFromLocal(email: string) {
        const target = email.toLowerCase();
        const localUser = await db.users
          .filter((user) => user.email?.toLowerCase() === target)
          .first();
        if (localUser) {
          set({ user: localUser, status: "authenticated", error: undefined });
        }
      },
      async signIn(email: string, password: string) {
        set({ status: "loading", error: undefined });
        const supabase = getSupabaseClient();
        try {
          if (!navigator.onLine || !supabase) {
            await get().hydrateUserFromLocal(email);
            if (!get().user) {
              throw new Error(
                "Modo offline: usuario no encontrado localmente."
              );
            }
            set({ status: "authenticated" });
            return;
          }

          const { user } = await signInWithEmail(email, password);
          if (!user) {
            throw new Error("No se pudo iniciar sesión.");
          }

          let storedUser = await db.users.get(user.id);
          if (supabase) {
            try {
              const { data: remoteProfile } = await supabase
                .from("users")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();
              if (remoteProfile) {
                const profile = remoteProfile as User;
                await db.users.put(profile);
                storedUser = profile;
              }
            } catch (remoteError) {
              console.error(
                "[auth] failed to fetch remote profile",
                remoteError
              );
            }
          }

          if (!storedUser) {
            storedUser = {
              id: user.id,
              name: user.user_metadata?.full_name ?? user.email ?? "Usuario",
              role:
                (user.app_metadata?.role as unknown as User["role"]) ??
                "athlete",
              email: user.email?.toLowerCase() ?? email.toLowerCase(),
              updated_at: new Date().toISOString(),
            };
            await db.users.put(storedUser);
          }

          set({ user: storedUser, status: "authenticated" });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Error inesperado";
          set({ status: "error", error: message });
        }
      },
      async signOut() {
        try {
          await signOut();
        } finally {
          set({ user: null, status: "idle", error: undefined });
        }
      },
    }),
    {
      name: "auth-store",
    }
  )
);
