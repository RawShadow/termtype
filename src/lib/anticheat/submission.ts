import {
  CODE_TIME_OPTIONS,
  QUOTE_LENGTHS,
  supportsModifiers,
  TIME_OPTIONS,
  WORD_OPTIONS,
  type Mode,
  type Strictness,
} from "@/lib/engine/config";
import type { GuestRun } from "@/lib/history/guestRuns";
import type { RecordTestResultArgs } from "@/lib/supabase/database.types";

/** JSON body of `POST /api/results`. */
export interface Submission {
  clientRunId: string;
  mode: Mode;
  subMode: string;
  modifiers: { punct: boolean; nums: boolean; strictness: Strictness };
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  /** Whole seconds the score covers (rounded; at least 1). */
  durationSec: number;
  /** ISO time the run finished. */
  playedAt: string;
  /** Lightweight keystroke timing summary for server-side checks. */
  timing: {
    /** Client clock (ms) at the first keystroke. */
    startTime: number;
    /** Client clock (ms) when the test ended. */
    endTime: number;
    totalKeystrokes: number;
    /** Cumulative net WPM at the end of each second (last one may be partial). */
    perSecondWpm: number[];
  };
}

/** Valid sub-modes per mode, in the `test_results.sub_mode` shape. */
export const SUB_MODES: Readonly<Record<Mode, readonly string[]>> = {
  time: TIME_OPTIONS.map(String),
  words: WORD_OPTIONS.map(String),
  quote: QUOTE_LENGTHS,
  code: CODE_TIME_OPTIONS.map((n) => `code_${n}`),
};

/** Configured length in seconds for timed modes, null otherwise. */
export function timedLength(mode: Mode, subMode: string): number | null {
  if (mode === "time") return Number(subMode);
  if (mode === "code") return Number(subMode.replace("code_", ""));
  return null;
}

/** Request body for a finished run, or null for runs that are never saved (failed strict runs). */
export function toSubmission(run: GuestRun): Submission | null {
  if (run.failReason) return null;
  const modifiersApply = supportsModifiers(run.mode);
  return {
    clientRunId: run.id,
    mode: run.mode,
    subMode: run.subMode,
    modifiers: {
      punct: modifiersApply && run.modifiers.punct,
      nums: modifiersApply && run.modifiers.nums,
      strictness: run.modifiers.strictness,
    },
    wpm: run.wpm,
    rawWpm: run.rawWpm,
    accuracy: run.accuracy,
    consistency: run.consistency,
    durationSec: Math.max(1, Math.round(run.durationSec)),
    playedAt: new Date(run.createdAt).toISOString(),
    timing: {
      startTime: run.startTime,
      endTime: run.endTime,
      totalKeystrokes: run.totalKeystrokes,
      perSecondWpm: run.perSecondWpm,
    },
  };
}

/** Arguments for `record_test_result`. The user id comes from the session, never the body. */
export function toRecordArgs(userId: string, s: Submission): RecordTestResultArgs {
  return {
    p_user_id: userId,
    p_client_run_id: s.clientRunId,
    p_mode: s.mode,
    p_sub_mode: s.subMode,
    p_modifiers: s.modifiers,
    p_wpm: s.wpm,
    p_raw_wpm: s.rawWpm,
    p_accuracy: s.accuracy,
    p_consistency: s.consistency,
    p_duration_sec: s.durationSec,
    p_played_at: s.playedAt,
  };
}
