import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { TypedSupabaseClient } from "./client";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

/**
 * Server client for Server Components and Route Handlers, reading the session
 * from cookies. `null` when Supabase isn't configured.
 */
export async function createClient(): Promise<TypedSupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies. The proxy
          // refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}
