"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Browser client using the public anon key. Read-only thanks to RLS. */
export function getBrowserSupabase(url: string, anonKey: string) {
  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
