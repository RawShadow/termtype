import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "./types";

/**
 * The signed-in account for this request, or null for guests. Any failure
 * (Supabase unconfigured or unreachable, bad cookie) means "guest", so the
 * typing test never depends on it. Call only inside request-time boundaries.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, created_at")
      .eq("id", claims.sub)
      .maybeSingle();

    return {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
      username: profile?.username ?? null,
      joinedAt: profile?.created_at ?? null,
    };
  } catch {
    return null;
  }
});
