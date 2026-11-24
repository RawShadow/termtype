import { describe, expect, it } from "vitest";
import { createInitialState, engineReducer, MAX_EXTRA_CHARS } from "./reducer";
import { getResult } from "./results";
import type { EngineAction, EngineState } from "./types";

/** State with a fixed word list (plus filler so the buffer never extends). */
function stateWith(targets: string[]): EngineState {
  const base = createInitialState({ seed: 1 });
  const filler = Array.from({ length: 100 }, () => ({ target: "zzz", typed: "" }));
  return { ...base, words: [...targets.map((target) => ({ target, typed: "" })), ...filler] };
}

function run(state: EngineState, actions: EngineAction[]): EngineState {
  return actions.reduce(engineReducer, state);
}

/** Types a string at time `now` ("_" style: spaces become SPACE actions). */
function type(text: string, now = 0): EngineAction[] {
  return [...text].map((char) =>
    char === " " ? { type: "SPACE", now } : { type: "CHAR", char, now },
  );
}

describe("starting", () => {
  it("starts on the first character keystroke", () => {
    const s = run(stateWith(["hi"]), [{ type: "CHAR", char: "h", now: 500 }]);
    expect(s.status).toBe("running");
    expect(s.startTime).toBe(500);
  });

  it("does not start on space, backspace or tick", () => {
    const s = run(stateWith(["hi"]), [
      { type: "SPACE", now: 0 },
      { type: "BACKSPACE" },
      { type: "CLEAR_WORD" },
      { type: "TICK", now: 5000 },
    ]);
    expect(s.status).toBe("idle");
    expect(s.wordIndex).toBe(0);
    expect(s.totalKeystrokes).toBe(0);
  });
});

describe("typing", () => {
  it("records correct and incorrect keystrokes", () => {
    const s = run(stateWith(["cat"]), type("cxt"));
    expect(s.words[0].typed).toBe("cxt");
    expect(s.totalKeystrokes).toBe(3);
    expect(s.correctKeystrokes).toBe(2);
  });

  it("caps extra characters per word", () => {
    const s = run(stateWith(["go"]), type("go" + "x".repeat(MAX_EXTRA_CHARS + 5)));
    expect(s.words[0].typed).toHaveLength(2 + MAX_EXTRA_CHARS);
    expect(s.totalKeystrokes).toBe(2 + MAX_EXTRA_CHARS);
  });
});

describe("space", () => {
  it("is ignored on an empty word", () => {
    const s = run(stateWith(["a", "b"]), [...type("a "), { type: "SPACE", now: 0 }]);
    expect(s.wordIndex).toBe(1);
    expect(s.totalKeystrokes).toBe(2);
  });

  it("is a correct keystroke only when the word matches", () => {
    const good = run(stateWith(["ab", "c"]), type("ab "));
    expect(good.correctKeystrokes).toBe(3);
    const bad = run(stateWith(["ab", "c"]), type("a "));
    expect(bad.wordIndex).toBe(1);
    expect(bad.correctKeystrokes).toBe(1);
    expect(bad.totalKeystrokes).toBe(2);
  });

  it("counts the rest of a skipped word as missed", () => {
    const s = run(stateWith(["hello", "x"]), type("he "));
    expect(getResult(s).chars.missed).toBe(3);
  });
});

describe("backspace", () => {
  it("deletes the last character", () => {
    const s = run(stateWith(["cat"]), [...type("ca"), { type: "BACKSPACE" }]);
    expect(s.words[0].typed).toBe("c");
  });

  it("does not go back into a correct previous word", () => {
    const s = run(stateWith(["ab", "cd"]), [...type("ab "), { type: "BACKSPACE" }]);
    expect(s.wordIndex).toBe(1);
  });

  it("goes back into a previous word that has an error", () => {
    const s = run(stateWith(["ab", "cd"]), [...type("ax "), { type: "BACKSPACE" }]);
    expect(s.wordIndex).toBe(0);
    expect(s.words[0].typed).toBe("ax");
    const fixed = run(s, [{ type: "BACKSPACE" }, ...type("b")]);
    expect(fixed.words[0].typed).toBe("ab");
  });

  it("goes back into a previous word that was skipped", () => {
    const s = run(stateWith(["abc", "d"]), [...type("ab "), { type: "BACKSPACE" }]);
    expect(s.wordIndex).toBe(0);
  });

  it("does nothing at the very first position", () => {
    const s = run(stateWith(["a"]), [...type("a"), { type: "BACKSPACE" }, { type: "BACKSPACE" }]);
    expect(s.wordIndex).toBe(0);
    expect(s.words[0].typed).toBe("");
  });
});

describe("clear word (ctrl/alt + backspace)", () => {
  it("clears the current word", () => {
    const s = run(stateWith(["hello"]), [...type("hel"), { type: "CLEAR_WORD" }]);
    expect(s.words[0].typed).toBe("");
  });

  it("clears the previous word when it has an error and the current one is empty", () => {
    const s = run(stateWith(["ab", "cd"]), [...type("ax "), { type: "CLEAR_WORD" }]);
    expect(s.wordIndex).toBe(0);
    expect(s.words[0].typed).toBe("");
  });

  it("does not touch a correct previous word", () => {
    const s = run(stateWith(["ab", "cd"]), [...type("ab "), { type: "CLEAR_WORD" }]);
    expect(s.wordIndex).toBe(1);
    expect(s.words[0].typed).toBe("ab");
  });
});

describe("clock", () => {
  it("writes one snapshot per completed second", () => {
    let s = run(stateWith(["the", "cat"]), [{ type: "CHAR", char: "t", now: 0 }]);
    s = run(s, [...type("he ", 200), { type: "CHAR", char: "x", now: 900 }]);
    s = engineReducer(s, { type: "TICK", now: 1000 });
    expect(s.snapshots).toEqual([{ second: 1, netWpm: 48, rawWpm: 60, errors: 1 }]);
    expect(s.perSecondRaw).toEqual([60]);
    expect(s.bucket).toEqual({ keystrokes: 0, errors: 0 });

    s = engineReducer(s, { type: "TICK", now: 3500 });
    expect(s.snapshots.map((x) => x.second)).toEqual([1, 2, 3]);
    expect(s.perSecondRaw).toEqual([60, 0, 0]);
  });

  it("returns the same state when no second has completed", () => {
    const s = run(stateWith(["a"]), [{ type: "CHAR", char: "a", now: 0 }]);
    expect(engineReducer(s, { type: "TICK", now: 400 })).toBe(s);
  });

  it("finishes at the duration and ignores input afterwards", () => {
    let s = run(stateWith(["a"]), [{ type: "CHAR", char: "a", now: 0 }]);
    s = engineReducer(s, { type: "TICK", now: 30_050 });
    expect(s.status).toBe("finished");
    expect(s.endTime).toBe(30_000);
    expect(s.snapshots).toHaveLength(30);

    const after = run(s, [...type("b c", 31_000), { type: "BACKSPACE" }, { type: "CLEAR_WORD" }]);
    expect(after).toBe(s);
  });

  it("finishes on a late keystroke without recording it", () => {
    let s = run(stateWith(["ab"]), [{ type: "CHAR", char: "a", now: 0 }]);
    s = engineReducer(s, { type: "CHAR", char: "b", now: 30_200 });
    expect(s.status).toBe("finished");
    expect(s.words[0].typed).toBe("a");
    expect(s.totalKeystrokes).toBe(1);
  });
});

describe("word buffer", () => {
  it("appends more words as the caret approaches the end", () => {
    let s = createInitialState({ seed: 5 });
    const initial = s.words.length;
    for (let i = 0; i < 80; i++) {
      const target = s.words[s.wordIndex].target;
      s = run(s, type(target + " ", 0));
    }
    expect(s.words.length).toBeGreaterThan(initial);
    expect(s.words.length - s.wordIndex).toBeGreaterThanOrEqual(40);
    for (let i = 1; i < s.words.length; i++) {
      expect(s.words[i].target).not.toBe(s.words[i - 1].target);
    }
  });
});

describe("reset", () => {
  it("returns a fresh idle state with new words", () => {
    let s = run(stateWith(["a"]), [{ type: "CHAR", char: "a", now: 0 }]);
    s = engineReducer(s, { type: "RESET", seed: 99 });
    expect(s).toEqual(createInitialState({ seed: 99 }));
  });
});

describe("getResult", () => {
  it("scores a finished test", () => {
    // "the cat " correct (8 chars incl. spaces), then "sx" wrong in progress.
    let s = run(stateWith(["the", "cat", "sat"]), type("the cat sx", 0));
    s = engineReducer(s, { type: "TICK", now: 30_000 });
    const r = getResult(s);
    expect(r.netWpm).toBe(Math.round(8 / 5 / 0.5)); // 3
    expect(r.rawWpm).toBe(Math.round(10 / 5 / 0.5)); // 4
    expect(r.accuracy).toBe(90);
    expect(r.chars).toMatchObject({ correct: 7, incorrect: 1, extra: 0, missed: 0 });
  });
});
