import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null | undefined;

/**
 * Server-only client with the service key, used solely by /api/results to
 * call `record_test_result`. Returns null when no key is configured (saving
 * is then disabled; everything else keeps working). Never import this from
 * client code: the `server-only` import fails the build if you do.
 */
export function getAdminClient(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
  client =
    SUPABASE_URL && key
      ? createClient<Database>(SUPABASE_URL, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
      : null;
  return client;
}
