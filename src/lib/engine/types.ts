export type CharState = "untyped" | "correct" | "incorrect" | "extra";

export type TestStatus = "idle" | "running" | "finished";

export interface WordEntry {
  /** The word the user is supposed to type. */
  target: string;
  /** What the user has actually typed for this word so far. */
  typed: string;
}

export interface Snapshot {
  /** 1-based second of the test this snapshot closes. */
  second: number;
  /** Cumulative net WPM at the end of this second. */
  netWpm: number;
  /** Cumulative raw WPM at the end of this second. */
  rawWpm: number;
  /** Incorrect keystrokes made during this second. */
  errors: number;
}

export interface SecondBucket {
  keystrokes: number;
  errors: number;
}

export interface EngineState {
  words: WordEntry[];
  wordIndex: number;
  status: TestStatus;
  durationSec: number;
  /** `performance.now()`-style timestamp (ms) of the first keystroke. */
  startTime: number | null;
  endTime: number | null;
  /** Every character or space keystroke, including ones later deleted. */
  totalKeystrokes: number;
  correctKeystrokes: number;
  snapshots: Snapshot[];
  /** Raw WPM of each individual second (input for consistency). */
  perSecondRaw: number[];
  /** Keystrokes collected for the second currently in progress. */
  bucket: SecondBucket;
  /** RNG state used to append more words; keeps the reducer pure. */
  seed: number;
}

export type EngineAction =
  | { type: "CHAR"; char: string; now: number }
  | { type: "SPACE"; now: number }
  | { type: "BACKSPACE" }
  | { type: "CLEAR_WORD" }
  | { type: "TICK"; now: number }
  | { type: "RESET"; seed: number };

export interface CharBreakdown {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  /** Correct chars of correct words plus one space each; feeds net WPM. */
  correctWithSpaces: number;
}

export interface TestResult {
  netWpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  chars: CharBreakdown;
  durationSec: number;
}
