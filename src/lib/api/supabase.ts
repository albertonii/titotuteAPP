"use client";

import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

const ensureClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "Supabase credentials are not configuradas. Solo modo offline."
    );
    return null;
  }
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return [];
        },
      },
    });
  }
  return client;
};

export const getSupabaseClient = () => ensureClient();

export const signInWithEmail = async (email: string, password: string) => {
  const supabase = ensureClient();
  if (!supabase) {
    throw new Error("Supabase no está configurado en este entorno.");
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signOut = async () => {
  const supabase = ensureClient();
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};
