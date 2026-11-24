import { isOneOf, MODES, STRICTNESS_LEVELS } from "@/lib/engine/config";
import { SUB_MODES, timedLength, type Submission } from "./submission";

/** Hard sanity ceilings from the SPEC. */
export const MAX_WPM = 260;
export const MAX_RAW_WPM = 300;
/** Allowed gap between the client's measured time and the reported duration. */
export const DURATION_TOLERANCE_SEC = 1.5;
const MAX_DURATION_SEC = 3600;

export type ValidationResult = { ok: true; value: Submission } | { ok: false; reasons: string[] };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Within `max(abs, pct * expected)` of the expected value. */
function near(actual: number, expected: number, abs: number, pct: number): boolean {
  return Math.abs(actual - expected) <= Math.max(abs, pct * expected);
}

/** Shape and types only. Returns the typed value or the first problems found. */
function parseShape(input: unknown): { value?: Submission; reasons: string[] } {
  const reasons: string[] = [];
  if (!isObject(input)) return { reasons: ["body must be an object"] };
  const b = input;

  if (typeof b.clientRunId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(b.clientRunId)) {
    reasons.push("invalid run id");
  }
  if (!isOneOf(MODES, b.mode)) reasons.push("invalid mode");
  else if (typeof b.subMode !== "string" || !SUB_MODES[b.mode].includes(b.subMode)) {
    reasons.push("invalid sub-mode");
  }

  const m = b.modifiers;
  if (
    !isObject(m) ||
    typeof m.punct !== "boolean" ||
    typeof m.nums !== "boolean" ||
    !isOneOf(STRICTNESS_LEVELS, m.strictness) ||
    Object.keys(m).length !== 3
  ) {
    reasons.push("invalid modifiers");
  }

  for (const key of ["wpm", "rawWpm", "consistency", "durationSec"] as const) {
    if (!isInt(b[key])) reasons.push(`${key} must be an integer`);
  }
  if (!isNum(b.accuracy)) reasons.push("accuracy must be a number");
  if (typeof b.playedAt !== "string" || Number.isNaN(Date.parse(b.playedAt))) {
    reasons.push("playedAt must be an ISO date");
  }

  const t = b.timing;
  if (!isObject(t)) {
    reasons.push("missing timing summary");
  } else {
    if (!isNum(t.startTime) || !isNum(t.endTime)) reasons.push("timing needs start and end times");
    if (!isInt(t.totalKeystrokes) || t.totalKeystrokes < 0) reasons.push("invalid keystroke count");
    if (
      !Array.isArray(t.perSecondWpm) ||
      t.perSecondWpm.length > MAX_DURATION_SEC + 1 ||
      !t.perSecondWpm.every(isNum)
    ) {
      reasons.push("invalid per-second wpm");
    }
  }

  if (reasons.length) return { reasons };
  return { value: input as unknown as Submission, reasons };
}

/**
 * Server-side checks for a submitted run (SPEC "Anti-Cheat & Validation"):
 * hard ceilings, duration vs. the client's own timing within ±1.5s, and
 * consistency between the per-second snapshots, keystrokes and the scores.
 */
export function validateSubmission(input: unknown): ValidationResult {
  const shape = parseShape(input);
  if (!shape.value) return { ok: false, reasons: shape.reasons };
  const s = shape.value;
  const reasons: string[] = [];

  // 1. Ceilings and ranges.
  if (s.wpm < 0 || s.wpm > MAX_WPM) reasons.push(`wpm must be 0-${MAX_WPM}`);
  if (s.rawWpm < 0 || s.rawWpm > MAX_RAW_WPM) reasons.push(`raw wpm must be 0-${MAX_RAW_WPM}`);
  if (s.wpm > s.rawWpm) reasons.push("wpm cannot exceed raw wpm");
  if (s.accuracy < 0 || s.accuracy > 100) reasons.push("accuracy must be 0-100");
  if (s.consistency < 0 || s.consistency > 100) reasons.push("consistency must be 0-100");

  // 2. Duration: the configured length, and the client's own clock.
  const length = timedLength(s.mode, s.subMode);
  if (length !== null && s.durationSec !== length) {
    reasons.push(`a ${s.subMode.replace("code_", "")}s test must last ${length}s`);
  }
  if (length === null && (s.durationSec < 1 || s.durationSec > MAX_DURATION_SEC)) {
    reasons.push(`duration must be 1-${MAX_DURATION_SEC}s`);
  }
  const elapsed = (s.timing.endTime - s.timing.startTime) / 1000;
  if (!(elapsed > 0)) {
    reasons.push("test must end after it starts");
    return { ok: false, reasons };
  }
  if (Math.abs(elapsed - s.durationSec) > DURATION_TOLERANCE_SEC) {
    reasons.push("measured time does not match the duration");
  }

  // 3. Snapshot consistency.
  const snapshots = s.timing.perSecondWpm;
  const expectedCount = Math.ceil(elapsed - 1e-9);
  if (Math.abs(snapshots.length - expectedCount) > 1) {
    reasons.push("per-second wpm does not cover the test");
  }
  if (snapshots.some((w) => w < 0 || w > MAX_WPM)) {
    reasons.push(`per-second wpm must be 0-${MAX_WPM}`);
  }
  const last = snapshots[snapshots.length - 1];
  if (last === undefined || !near(last, s.wpm, 3, 0.05)) {
    reasons.push("wpm does not match the per-second wpm");
  }
  const rawFromKeystrokes = Math.round(s.timing.totalKeystrokes / 5 / (elapsed / 60));
  if (!near(s.rawWpm, rawFromKeystrokes, 2, 0.03)) {
    reasons.push("raw wpm does not match the keystroke count");
  }

  return reasons.length ? { ok: false, reasons } : { ok: true, value: s };
}
