import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Browser client (a singleton inside @supabase/ssr). `null` when Supabase isn't configured. */
export function createClient(): TypedSupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
}
