import { initialContent, moreContent } from "@/lib/content";
import { DEFAULT_CONFIG, durationOf, type TestConfig } from "./config";
import { countChars, hasError, netWpm, rawWpm } from "./stats";
import type { EngineAction, EngineState, FailReason, Snapshot, WordEntry } from "./types";

/** Max characters a user can type past the end of a word. */
export const MAX_EXTRA_CHARS = 10;
/** Append more words once fewer than this many remain ahead of the caret. */
const BUFFER_THRESHOLD = 40;
/** A final partial second shorter than this is charted but left out of consistency. */
const MIN_PARTIAL_SECOND = 0.5;

export function createInitialState(options: { seed: number; config?: TestConfig }): EngineState {
  const config = options.config ?? DEFAULT_CONFIG;
  const content = initialContent(config, options.seed);
  return {
    config,
    words: content.words.map((target) => ({ target, typed: "" })),
    wordIndex: 0,
    status: "idle",
    durationSec: durationOf(config),
    endless: content.endless,
    quote: content.quote,
    failReason: null,
    startTime: null,
    endTime: null,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    snapshots: [],
    perSecondRaw: [],
    bucket: { keystrokes: 0, errors: 0 },
    startSeed: options.seed,
    seed: content.seed,
  };
}

/** Writes snapshots for whole seconds `snapshots.length + 1 .. upTo`. */
function closeSeconds(state: EngineState, upTo: number): EngineState {
  if (upTo <= state.snapshots.length) return state;
  const snapshots: Snapshot[] = [...state.snapshots];
  const perSecondRaw = [...state.perSecondRaw];
  let bucket = state.bucket;
  const { correctWithSpaces } = countChars(state.words, state.wordIndex);
  for (let second = snapshots.length + 1; second <= upTo; second++) {
    snapshots.push({
      second,
      netWpm: netWpm(correctWithSpaces, second),
      rawWpm: rawWpm(state.totalKeystrokes, second),
      errors: bucket.errors,
    });
    perSecondRaw.push(rawWpm(bucket.keystrokes, 1));
    bucket = { keystrokes: 0, errors: 0 };
  }
  return { ...state, snapshots, perSecondRaw, bucket };
}

/**
 * Closes every whole second since the last snapshot and finishes timed tests
 * once the duration is reached. Returns the same object when nothing changed
 * so React can skip re-rendering.
 */
export function advanceClock(state: EngineState, now: number): EngineState {
  if (state.status !== "running" || state.startTime === null) return state;
  const elapsedSec = (now - state.startTime) / 1000;
  const limit = state.durationSec;
  const done = limit !== null && elapsedSec >= limit;
  const completed = Math.floor(limit !== null ? Math.min(elapsedSec, limit) : elapsedSec);
  if (completed <= state.snapshots.length && !done) return state;

  const closed = closeSeconds(state, completed);
  if (!done) return closed;
  return { ...closed, status: "finished", endTime: state.startTime + limit * 1000 };
}

/** Ends the test at `now` (text completed or strict failure), charting the final partial second. */
function finishAt(state: EngineState, now: number, failReason: FailReason | null): EngineState {
  const startTime = state.startTime ?? now;
  const elapsedSec = Math.max(0, (now - startTime) / 1000);
  const s = closeSeconds(state, Math.floor(elapsedSec));
  const partial = elapsedSec - s.snapshots.length;
  let { snapshots, perSecondRaw } = s;
  if (partial > 0) {
    const { correctWithSpaces } = countChars(s.words, s.wordIndex);
    snapshots = [
      ...snapshots,
      {
        second: Math.round(elapsedSec * 100) / 100,
        netWpm: netWpm(correctWithSpaces, elapsedSec),
        rawWpm: rawWpm(s.totalKeystrokes, elapsedSec),
        errors: s.bucket.errors,
      },
    ];
    if (partial >= MIN_PARTIAL_SECOND) {
      perSecondRaw = [...perSecondRaw, rawWpm(s.bucket.keystrokes, partial)];
    }
  }
  return {
    ...s,
    snapshots,
    perSecondRaw,
    bucket: { keystrokes: 0, errors: 0 },
    status: "finished",
    endTime: now,
    failReason,
  };
}

function replaceWord(words: WordEntry[], index: number, word: WordEntry): WordEntry[] {
  const next = words.slice();
  next[index] = word;
  return next;
}

function ensureBuffer(state: EngineState): EngineState {
  if (!state.endless || state.words.length - state.wordIndex >= BUFFER_THRESHOLD) return state;
  const previous = state.words[state.words.length - 1]?.target;
  const { words, seed } = moreContent(state.config, state.seed, previous);
  return {
    ...state,
    words: [...state.words, ...words.map((target) => ({ target, typed: "" }))],
    seed,
  };
}

function recordKeystroke(state: EngineState, correct: boolean): EngineState {
  return {
    ...state,
    totalKeystrokes: state.totalKeystrokes + 1,
    correctKeystrokes: state.correctKeystrokes + (correct ? 1 : 0),
    bucket: {
      keystrokes: state.bucket.keystrokes + 1,
      errors: state.bucket.errors + (correct ? 0 : 1),
    },
  };
}

/** Moves back into the previous word, only allowed if that word has an error. */
function stepBack(state: EngineState, clear: boolean): EngineState {
  if (state.wordIndex === 0) return state;
  const prevIndex = state.wordIndex - 1;
  const prev = state.words[prevIndex];
  if (!hasError(prev)) return state;
  return {
    ...state,
    wordIndex: prevIndex,
    words: clear ? replaceWord(state.words, prevIndex, { ...prev, typed: "" }) : state.words,
  };
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case "RESET":
      return createInitialState({ seed: action.seed, config: action.config ?? state.config });

    case "REPEAT":
      return createInitialState({ seed: state.startSeed, config: state.config });

    case "TICK":
      return advanceClock(state, action.now);

    case "CHAR": {
      if (state.status === "finished") return state;
      const s =
        state.status === "idle"
          ? { ...state, status: "running" as const, startTime: action.now }
          : advanceClock(state, action.now);
      if (s.status === "finished") return s;

      const word = s.words[s.wordIndex];
      if (word.typed.length >= word.target.length + MAX_EXTRA_CHARS) return s;
      const correct = word.target[word.typed.length] === action.char;
      const typed = word.typed + action.char;
      const next = recordKeystroke(
        { ...s, words: replaceWord(s.words, s.wordIndex, { ...word, typed }) },
        correct,
      );

      if (!correct && s.config.strictness === "master") return finishAt(next, action.now, "master");
      // Fixed-length text ends as soon as the last word is typed exactly.
      if (!s.endless && s.wordIndex === s.words.length - 1 && typed === word.target) {
        return finishAt(next, action.now, null);
      }
      return ensureBuffer(next);
    }

    case "SPACE": {
      if (state.status !== "running") return state;
      const s = advanceClock(state, action.now);
      if (s.status === "finished") return s;

      const word = s.words[s.wordIndex];
      if (word.typed.length === 0) return s;
      const correct = word.typed === word.target;
      const next = recordKeystroke({ ...s, wordIndex: s.wordIndex + 1 }, correct);

      if (!correct && s.config.strictness !== "normal") {
        return finishAt(next, action.now, s.config.strictness);
      }
      if (!s.endless && next.wordIndex >= s.words.length) return finishAt(next, action.now, null);
      return ensureBuffer(next);
    }

    case "BACKSPACE": {
      if (state.status !== "running") return state;
      const word = state.words[state.wordIndex];
      if (word.typed.length === 0) return stepBack(state, false);
      return {
        ...state,
        words: replaceWord(state.words, state.wordIndex, { ...word, typed: word.typed.slice(0, -1) }),
      };
    }

    case "CLEAR_WORD": {
      if (state.status !== "running") return state;
      const word = state.words[state.wordIndex];
      if (word.typed.length === 0) return stepBack(state, true);
      return { ...state, words: replaceWord(state.words, state.wordIndex, { ...word, typed: "" }) };
    }
  }
}
