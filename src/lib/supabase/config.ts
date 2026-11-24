/**
 * Supabase settings from env. NEXT_PUBLIC_* values are inlined at build time,
 * so each must be referenced literally.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Without both values the app runs guest-only and hides the auth UI. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
}

export const OAUTH_PROVIDERS = ["github", "google"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Providers listed in `NEXT_PUBLIC_AUTH_PROVIDERS` (comma-separated), in a fixed order. */
export function parseOAuthProviders(value: string | undefined): OAuthProvider[] {
  const wanted = new Set(
    (value ?? "")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  );
  return OAUTH_PROVIDERS.filter((p) => wanted.has(p));
}

export function enabledOAuthProviders(): OAuthProvider[] {
  return parseOAuthProviders(process.env.NEXT_PUBLIC_AUTH_PROVIDERS);
}

/**
 * A same-origin path to send the user to after auth. Anything else
 * (absolute URLs, `//host`, backslash tricks) falls back to `/`.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
