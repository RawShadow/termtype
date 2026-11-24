import { supportsModifiers, type Mode } from "@/lib/engine/config";
import type { GuestRun } from "@/lib/history/guestRuns";
import type { SubmitTestResultArgs, TestResultRow } from "@/lib/supabase/database.types";

/**
 * Arguments for the `submit_test_result` database function, or null for runs
 * that are never saved (failed strict runs).
 */
export function toSubmitArgs(run: GuestRun): SubmitTestResultArgs | null {
  if (run.failReason) return null;
  const modifiersApply = supportsModifiers(run.mode);
  return {
    p_client_run_id: run.id,
    p_mode: run.mode,
    p_sub_mode: run.subMode,
    p_modifiers: {
      punct: modifiersApply && run.modifiers.punct,
      nums: modifiersApply && run.modifiers.nums,
      strictness: run.modifiers.strictness,
    },
    p_wpm: run.wpm,
    p_raw_wpm: run.rawWpm,
    p_accuracy: run.accuracy,
    p_consistency: run.consistency,
    p_duration_sec: Math.max(1, Math.round(run.durationSec)),
    p_played_at: new Date(run.createdAt).toISOString(),
  };
}

/** The fields the recent-runs table needs, shared by guest runs and saved rows. */
export type RunSummary = Pick<
  GuestRun,
  "id" | "createdAt" | "mode" | "subMode" | "modifiers" | "wpm" | "rawWpm" | "accuracy" | "failReason"
>;

const MODES: readonly string[] = ["time", "words", "quote", "code"];

/** A saved database row in the shape of a run summary. */
export function rowToRun(row: TestResultRow): RunSummary {
  const m = (typeof row.modifiers === "object" && row.modifiers !== null && !Array.isArray(row.modifiers)
    ? row.modifiers
    : {}) as Record<string, unknown>;
  const strictness = m.strictness === "expert" || m.strictness === "master" ? m.strictness : "normal";
  return {
    id: row.client_run_id,
    createdAt: Date.parse(row.created_at),
    mode: (MODES.includes(row.mode) ? row.mode : "time") as Mode,
    subMode: row.sub_mode,
    modifiers: { punct: m.punct === true, nums: m.nums === true, strictness },
    wpm: row.wpm,
    rawWpm: row.raw_wpm,
    accuracy: Number(row.accuracy),
    failReason: null,
  };
}

/** Turns a Supabase/PostgREST error into a short message for the results screen. */
export function saveErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "unknown error";
  if (error.code === "23514") return "values out of range";
  if (error.code === "28000" || error.code === "42501") return "sign in again";
  if (error.message && error.message.length <= 80) return error.message;
  return "could not reach the server";
}
