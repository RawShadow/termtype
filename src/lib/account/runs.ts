import { toSubmission } from "@/lib/anticheat/submission";
import type { GuestRun } from "@/lib/history/guestRuns";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import { rowToRun, type RunSummary } from "./submit";
import type { SubmitOutcome } from "./sync";

export interface SubmitResult {
  outcome: SubmitOutcome;
  message: string | null;
}

/** Short messages for non-success responses from /api/results. */
const STATUS_MESSAGES: Record<number, string> = {
  401: "sign in again",
  403: "request blocked",
  409: "choose a username first",
  503: "saving is unavailable right now",
};

/**
 * Saves one run through `POST /api/results`, which validates it server-side.
 * Rejected = the server will never accept this run; error = try again later.
 */
export async function submitRun(run: GuestRun, fetchImpl: typeof fetch = fetch): Promise<SubmitResult> {
  const submission = toSubmission(run);
  if (!submission) return { outcome: "rejected", message: "failed runs aren't saved" };
  try {
    const res = await fetchImpl("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    if (res.ok) return { outcome: "saved", message: null };
    const body = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[] };
    if ([400, 413, 415, 422].includes(res.status)) {
      return { outcome: "rejected", message: body.reasons?.[0] ?? body.error ?? "invalid run" };
    }
    return { outcome: "error", message: STATUS_MESSAGES[res.status] ?? "could not save - try again" };
  } catch {
    return { outcome: "error", message: "could not reach the server" };
  }
}

/** The user's most recent saved runs, newest first. Empty on any error. */
export async function fetchRecentRuns(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 10,
): Promise<RunSummary[]> {
  try {
    const { data } = await supabase
      .from("test_results")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map(rowToRun);
  } catch {
    return [];
  }
}

/** Best WPM in a category before this run, or null if there is none (or on error). */
export async function fetchPreviousBest(
  supabase: TypedSupabaseClient,
  userId: string,
  run: Pick<GuestRun, "id" | "mode" | "subMode">,
): Promise<number | null> {
  try {
    const { data } = await supabase
      .from("test_results")
      .select("wpm")
      .eq("user_id", userId)
      .eq("mode", run.mode)
      .eq("sub_mode", run.subMode)
      .neq("client_run_id", run.id)
      .order("wpm", { ascending: false })
      .limit(1);
    return data?.[0]?.wpm ?? null;
  } catch {
    return null;
  }
}
