import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** OAuth return: exchange the code for a session cookie, then continue to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/login?error=oauth", origin));
}
