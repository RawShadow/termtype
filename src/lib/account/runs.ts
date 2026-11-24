import type { GuestRun } from "@/lib/history/guestRuns";
import type { TypedSupabaseClient } from "@/lib/supabase/client";
import { rowToRun, saveErrorMessage, toSubmitArgs, type RunSummary } from "./submit";
import { isRejection, type SubmitOutcome } from "./sync";

export interface SubmitResult {
  outcome: SubmitOutcome;
  message: string | null;
}

/** Saves one run through the validating `submit_test_result` function. */
export async function submitRun(supabase: TypedSupabaseClient, run: GuestRun): Promise<SubmitResult> {
  const args = toSubmitArgs(run);
  if (!args) return { outcome: "rejected", message: "failed runs aren't saved" };
  try {
    const { error } = await supabase.rpc("submit_test_result", args);
    if (!error) return { outcome: "saved", message: null };
    return { outcome: isRejection(error.code) ? "rejected" : "error", message: saveErrorMessage(error) };
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
