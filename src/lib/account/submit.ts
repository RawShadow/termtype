import type { Mode } from "@/lib/engine/config";
import type { GuestRun } from "@/lib/history/guestRuns";
import type { TestResultRow } from "@/lib/supabase/database.types";

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
