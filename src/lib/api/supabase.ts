"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
};

export const getSupabaseClient = () => ensureClient();

export const signInWithEmail = async (email: string, password: string) => {
  const supabase = ensureClient();
  if (!supabase) {
    throw new Error("Supabase no está configurado en este entorno.");
  }
  console.log("[supabase] signInWithPassword request", { email });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[supabase] signInWithPassword error", error);
    throw error;
  }

  console.log("[supabase] signInWithPassword success", data.user?.id);
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
