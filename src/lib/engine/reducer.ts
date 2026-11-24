import { countChars, hasError, netWpm, rawWpm } from "./stats";
import type { EngineAction, EngineState, Snapshot, WordEntry } from "./types";
import { generateWords } from "./words";

export const DEFAULT_DURATION_SEC = 30;
/** Max characters a user can type past the end of a word. */
export const MAX_EXTRA_CHARS = 10;
const INITIAL_WORD_COUNT = 100;
/** Append more words once fewer than this many remain ahead of the caret. */
const BUFFER_THRESHOLD = 40;
const EXTEND_BY = 50;

export function createInitialState(options: {
  seed: number;
  durationSec?: number;
}): EngineState {
  const { words, seed } = generateWords(INITIAL_WORD_COUNT, options.seed);
  return {
    words: words.map((target) => ({ target, typed: "" })),
    wordIndex: 0,
    status: "idle",
    durationSec: options.durationSec ?? DEFAULT_DURATION_SEC,
    startTime: null,
    endTime: null,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    snapshots: [],
    perSecondRaw: [],
    bucket: { keystrokes: 0, errors: 0 },
    seed,
  };
}

/**
 * Closes every whole second that has elapsed since the last snapshot and
 * finishes the test once the duration is reached. Returns the same object
 * when nothing changed so React can skip re-rendering.
 */
export function advanceClock(state: EngineState, now: number): EngineState {
  if (state.status !== "running" || state.startTime === null) return state;
  const elapsedSec = (now - state.startTime) / 1000;
  const completed = Math.floor(Math.min(elapsedSec, state.durationSec));
  const done = elapsedSec >= state.durationSec;
  if (completed <= state.snapshots.length && !done) return state;

  const snapshots: Snapshot[] = [...state.snapshots];
  const perSecondRaw = [...state.perSecondRaw];
  let bucket = state.bucket;
  if (completed > snapshots.length) {
    const { correctWithSpaces } = countChars(state.words, state.wordIndex);
    for (let second = snapshots.length + 1; second <= completed; second++) {
      snapshots.push({
        second,
        netWpm: netWpm(correctWithSpaces, second),
        rawWpm: rawWpm(state.totalKeystrokes, second),
        errors: bucket.errors,
      });
      perSecondRaw.push(rawWpm(bucket.keystrokes, 1));
      bucket = { keystrokes: 0, errors: 0 };
    }
  }

  return {
    ...state,
    snapshots,
    perSecondRaw,
    bucket,
    ...(done
      ? { status: "finished" as const, endTime: state.startTime + state.durationSec * 1000 }
      : {}),
  };
}

function replaceWord(words: WordEntry[], index: number, word: WordEntry): WordEntry[] {
  const next = words.slice();
  next[index] = word;
  return next;
}

function ensureBuffer(state: EngineState): EngineState {
  if (state.words.length - state.wordIndex >= BUFFER_THRESHOLD) return state;
  const previous = state.words[state.words.length - 1]?.target;
  const { words, seed } = generateWords(EXTEND_BY, state.seed, previous);
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
      return createInitialState({ seed: action.seed, durationSec: state.durationSec });

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
      const words = replaceWord(s.words, s.wordIndex, { ...word, typed: word.typed + action.char });
      return ensureBuffer(recordKeystroke({ ...s, words }, correct));
    }

    case "SPACE": {
      if (state.status !== "running") return state;
      const s = advanceClock(state, action.now);
      if (s.status === "finished") return s;

      const word = s.words[s.wordIndex];
      if (word.typed.length === 0) return s;
      const correct = word.typed === word.target;
      return ensureBuffer(recordKeystroke({ ...s, wordIndex: s.wordIndex + 1 }, correct));
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
