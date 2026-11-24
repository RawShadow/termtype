import type { CharBreakdown, CharState, WordEntry } from "./types";

/** Net WPM: correct characters (incl. spaces after correct words) per minute / 5. */
export function netWpm(correctChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Math.max(0, Math.round(correctChars / 5 / (elapsedSeconds / 60)));
}

/** Raw WPM: every typed character per minute / 5, regardless of correctness. */
export function rawWpm(totalTypedChars: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Math.round(totalTypedChars / 5 / (elapsedSeconds / 60));
}

/** Accuracy in percent, rounded to one decimal. */
export function accuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  return totalKeystrokes > 0
    ? Number(((correctKeystrokes / totalKeystrokes) * 100).toFixed(1))
    : 0;
}

/** Coefficient of variation in percent (population std dev / mean * 100). */
export function coefficientOfVariation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return (Math.sqrt(variance) / mean) * 100;
}

export function consistency(perSecondRawWpms: readonly number[]): number {
  return Math.max(0, Math.round(100 - coefficientOfVariation(perSecondRawWpms)));
}

/** Per-character display state for one word (target chars, then any extras). */
export function charStates(word: WordEntry): { char: string; state: CharState }[] {
  const { target, typed } = word;
  const out: { char: string; state: CharState }[] = [];
  for (let i = 0; i < target.length; i++) {
    if (i >= typed.length) out.push({ char: target[i], state: "untyped" });
    else out.push({ char: target[i], state: typed[i] === target[i] ? "correct" : "incorrect" });
  }
  for (let i = target.length; i < typed.length; i++) {
    out.push({ char: typed[i], state: "extra" });
  }
  return out;
}

export function hasError(word: WordEntry): boolean {
  return word.typed !== word.target;
}

/**
 * Character breakdown over words up to and including `wordIndex`.
 * Words before `wordIndex` are committed: their untyped chars count as missed.
 * The in-progress word counts its typed chars; it contributes to
 * `correctWithSpaces` only while it is error-free so far.
 */
export function countChars(words: readonly WordEntry[], wordIndex: number): CharBreakdown {
  const result: CharBreakdown = { correct: 0, incorrect: 0, extra: 0, missed: 0, correctWithSpaces: 0 };
  const last = Math.min(wordIndex, words.length - 1);
  for (let i = 0; i <= last; i++) {
    const { target, typed } = words[i];
    const committed = i < wordIndex;
    for (let c = 0; c < Math.max(target.length, typed.length); c++) {
      if (c >= typed.length) {
        if (committed) result.missed++;
      } else if (c >= target.length) {
        result.extra++;
      } else if (typed[c] === target[c]) {
        result.correct++;
      } else {
        result.incorrect++;
      }
    }
    if (committed && typed === target) result.correctWithSpaces += target.length + 1;
    if (!committed && target.startsWith(typed)) result.correctWithSpaces += typed.length;
  }
  return result;
}
