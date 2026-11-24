import { NextResponse, type NextRequest } from "next/server";
import { handleSubmit } from "@/lib/anticheat/handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a finished run for the signed-in user after server-side validation
 * (session, ceilings, duration tolerance, snapshot consistency). This is the
 * only way runs reach `test_results`.
 */
export async function POST(request: NextRequest) {
  const admin = getAdminClient();
  const { status, body } = await handleSubmit(request, {
    getUserId: async () => {
      try {
        const supabase = await createClient();
        if (!supabase) return null;
        const { data } = await supabase.auth.getClaims();
        return data?.claims?.sub ?? null;
      } catch {
        return null;
      }
    },
    save: admin
      ? async (args) => {
          const { data, error } = await admin.rpc("record_test_result", args);
          if (error || !data) return { error: error ?? { message: "no row returned" } };
          return { id: data.id };
        }
      : null,
  });
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
