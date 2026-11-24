import { subModeOf, type Mode, type Strictness } from "@/lib/engine/config";
import type { CharBreakdown, EngineState, FailReason, TestResult } from "@/lib/engine/types";

export const GUEST_RUNS_KEY = "termtype_guest_runs";
export const MAX_GUEST_RUNS = 10;

export interface GuestRun {
  id: string;
  /** Epoch ms when the run finished. */
  createdAt: number;
  mode: Mode;
  subMode: string;
  modifiers: { punct: boolean; nums: boolean; strictness: Strictness };
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  chars: Omit<CharBreakdown, "correctWithSpaces">;
  durationSec: number;
  failReason: FailReason | null;
  // Timing summary the Phase 3/4 sync sends to the server for validation.
  startTime: number;
  endTime: number;
  totalKeystrokes: number;
  perSecondWpm: number[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Stable id for a run, derived from its seed and start time. */
export function runIdOf(state: EngineState): string {
  return `${state.startSeed.toString(36)}-${Math.round(state.startTime ?? 0).toString(36)}`;
}

export function toGuestRun(state: EngineState, result: TestResult, createdAt: number): GuestRun {
  const { correct, incorrect, extra, missed } = result.chars;
  return {
    id: runIdOf(state),
    createdAt,
    mode: state.config.mode,
    subMode: subModeOf(state.config),
    modifiers: {
      punct: state.config.punct,
      nums: state.config.nums,
      strictness: state.config.strictness,
    },
    wpm: result.netWpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    chars: { correct, incorrect, extra, missed },
    durationSec: Math.round(result.durationSec * 100) / 100,
    failReason: result.failReason,
    startTime: state.startTime ?? 0,
    endTime: state.endTime ?? 0,
    totalKeystrokes: state.totalKeystrokes,
    perSecondWpm: state.snapshots.map((s) => s.netWpm),
  };
}

function isGuestRun(value: unknown): value is GuestRun {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.createdAt === "number" &&
    typeof r.mode === "string" &&
    typeof r.subMode === "string" &&
    typeof r.wpm === "number" &&
    typeof r.rawWpm === "number" &&
    typeof r.accuracy === "number" &&
    typeof r.consistency === "number" &&
    typeof r.chars === "object" &&
    r.chars !== null &&
    typeof r.modifiers === "object" &&
    r.modifiers !== null
  );
}

/** Newest first. Bad or unreadable data yields an empty list, never an exception. */
export function loadGuestRuns(storage: StorageLike): GuestRun[] {
  try {
    const raw = storage.getItem(GUEST_RUNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGuestRun).slice(0, MAX_GUEST_RUNS) : [];
  } catch {
    return [];
  }
}

/** Adds a run (replacing one with the same id), keeps the newest {@link MAX_GUEST_RUNS}. */
export function addGuestRun(storage: StorageLike, run: GuestRun): GuestRun[] {
  const runs = [run, ...loadGuestRuns(storage).filter((r) => r.id !== run.id)].slice(
    0,
    MAX_GUEST_RUNS,
  );
  try {
    storage.setItem(GUEST_RUNS_KEY, JSON.stringify(runs));
  } catch {
    // Storage full or blocked: keep the in-memory list.
  }
  return runs;
}

/** Best non-failed run for a mode + sub-mode (highest WPM, then accuracy, then earliest). */
export function personalBest(
  runs: readonly GuestRun[],
  mode: Mode,
  subMode: string,
  excludeId?: string,
): GuestRun | null {
  let best: GuestRun | null = null;
  for (const run of runs) {
    if (run.id === excludeId || run.failReason || run.mode !== mode || run.subMode !== subMode) continue;
    if (
      !best ||
      run.wpm > best.wpm ||
      (run.wpm === best.wpm && run.accuracy > best.accuracy) ||
      (run.wpm === best.wpm && run.accuracy === best.accuracy && run.createdAt < best.createdAt)
    ) {
      best = run;
    }
  }
  return best;
}

/** True when `run` beats every earlier run in its category (and is not failed). */
export function isPersonalBest(runs: readonly GuestRun[], run: GuestRun): boolean {
  if (run.failReason) return false;
  const previous = personalBest(runs, run.mode, run.subMode, run.id);
  return !previous || run.wpm > previous.wpm;
}
