import { subModeOf } from "./config";
import { accuracy, consistency, countChars, netWpm, rawWpm } from "./stats";
import type { EngineState, TestResult } from "./types";

/**
 * Seconds a finished test is scored over: the full duration for a completed
 * timed test, otherwise the actual time from first keystroke to the end.
 */
export function elapsedOf(state: EngineState): number {
  if (state.durationSec !== null && state.failReason === null) return state.durationSec;
  if (state.startTime === null || state.endTime === null) return 0;
  return Math.max(0, (state.endTime - state.startTime) / 1000);
}

/** Final scores for a finished test. */
export function getResult(state: EngineState, elapsedSec = elapsedOf(state)): TestResult {
  const chars = countChars(state.words, state.wordIndex);
  return {
    netWpm: netWpm(chars.correctWithSpaces, elapsedSec),
    // Raw counts every char/space keystroke, including ones later deleted.
    rawWpm: rawWpm(state.totalKeystrokes, elapsedSec),
    accuracy: accuracy(state.correctKeystrokes, state.totalKeystrokes),
    consistency: consistency(state.perSecondRaw),
    chars,
    durationSec: elapsedSec,
    mode: state.config.mode,
    subMode: subModeOf(state.config),
    failReason: state.failReason,
  };
}
