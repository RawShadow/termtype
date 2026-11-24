import { accuracy, consistency, countChars, netWpm, rawWpm } from "./stats";
import type { EngineState, TestResult } from "./types";

/**
 * Final scores for a finished (or in-progress) test. `elapsedSec` defaults to
 * the full duration, which is exact for a finished Time-mode test.
 */
export function getResult(state: EngineState, elapsedSec = state.durationSec): TestResult {
  const chars = countChars(state.words, state.wordIndex);
  return {
    netWpm: netWpm(chars.correctWithSpaces, elapsedSec),
    // Raw counts every char/space keystroke, including ones later deleted.
    rawWpm: rawWpm(state.totalKeystrokes, elapsedSec),
    accuracy: accuracy(state.correctKeystrokes, state.totalKeystrokes),
    consistency: consistency(state.perSecondRaw),
    chars,
    durationSec: elapsedSec,
  };
}
