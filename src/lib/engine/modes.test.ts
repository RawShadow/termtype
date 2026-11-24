import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type TestConfig } from "./config";
import { createInitialState, engineReducer } from "./reducer";
import { getResult } from "./results";
import type { EngineAction, EngineState } from "./types";

const cfg = (patch: Partial<TestConfig>): TestConfig => ({ ...DEFAULT_CONFIG, ...patch });

/** A fixed-text state (words-mode shaped) with the given targets. */
function fixed(targets: string[], patch: Partial<TestConfig> = {}): EngineState {
  const base = createInitialState({ seed: 1, config: cfg({ mode: "words", words: 10, ...patch }) });
  return { ...base, words: targets.map((target) => ({ target, typed: "" })) };
}

function run(state: EngineState, actions: EngineAction[]): EngineState {
  return actions.reduce(engineReducer, state);
}

function type(text: string, now = 0): EngineAction[] {
  return [...text].map((char) => (char === " " ? { type: "SPACE", now } : { type: "CHAR", char, now }));
}

describe("fixed-length modes", () => {
  it("finish as soon as the last word is typed exactly", () => {
    let s = run(fixed(["ab", "cd"]), [...type("ab c", 0)]);
    expect(s.status).toBe("running");
    s = engineReducer(s, { type: "CHAR", char: "d", now: 2500 });
    expect(s.status).toBe("finished");
    expect(s.endTime).toBe(2500);
    expect(s.failReason).toBeNull();
  });

  it("finish on space after a wrong last word", () => {
    const s = run(fixed(["ab", "cd"]), [...type("ab cx", 0), { type: "SPACE", now: 1000 }]);
    expect(s.status).toBe("finished");
    expect(getResult(s).chars.incorrect).toBe(1);
  });

  it("do not finish on a wrong last word until space", () => {
    const s = run(fixed(["ab", "cd"]), type("ab cx", 0));
    expect(s.status).toBe("running");
  });

  it("score over the real elapsed time and chart the partial last second", () => {
    let s = run(fixed(["hello", "world"]), [{ type: "CHAR", char: "h", now: 0 }]);
    s = run(s, type("ello worl", 1000));
    s = engineReducer(s, { type: "CHAR", char: "d", now: 2500 });
    expect(s.snapshots.map((x) => x.second)).toEqual([1, 2, 2.5]);
    expect(s.perSecondRaw).toHaveLength(3); // partial 0.5s counts toward consistency
    const r = getResult(s);
    expect(r.durationSec).toBe(2.5);
    expect(r.netWpm).toBe(Math.round(11 / 5 / (2.5 / 60))); // "hello " + "world"
    expect(r.subMode).toBe("10");
  });

  it("leave a very short partial second out of consistency", () => {
    let s = run(fixed(["ab"]), [{ type: "CHAR", char: "a", now: 0 }]);
    s = engineReducer(s, { type: "CHAR", char: "b", now: 1100 });
    expect(s.snapshots.map((x) => x.second)).toEqual([1, 1.1]);
    expect(s.perSecondRaw).toHaveLength(1);
  });

  it("never grow the word list", () => {
    const start = createInitialState({ seed: 4, config: cfg({ mode: "words", words: 10 }) });
    let s = start;
    for (const w of start.words.slice(0, 9)) s = run(s, type(w.target + " "));
    expect(s.words).toHaveLength(10);
  });

  it("ignore time limits", () => {
    let s = run(fixed(["ab", "cd"]), [{ type: "CHAR", char: "a", now: 0 }]);
    s = engineReducer(s, { type: "TICK", now: 500_000 });
    expect(s.status).toBe("running");
    expect(s.snapshots).toHaveLength(500);
  });

  it("finish a quote at its last word", () => {
    let s = createInitialState({ seed: 3, config: cfg({ mode: "quote", quoteLength: "short" }) });
    expect(s.quote).not.toBeNull();
    s = run(s, type(s.quote!.text, 0));
    expect(s.status).toBe("finished");
    expect(getResult(s).accuracy).toBe(100);
  });
});

describe("strictness", () => {
  it("expert fails when a word with an error is submitted", () => {
    let s = run(fixed(["ab", "cd", "ef"], { strictness: "expert" }), type("ax", 0));
    expect(s.status).toBe("running"); // the error alone is fine...
    s = engineReducer(s, { type: "SPACE", now: 1200 });
    expect(s.status).toBe("finished"); // ...submitting it is not
    expect(s.failReason).toBe("expert");
    expect(getResult(s).failReason).toBe("expert");
    expect(getResult(s).durationSec).toBe(1.2);
  });

  it("expert lets you fix a word before submitting it", () => {
    const s = run(fixed(["ab", "cd"], { strictness: "expert" }), [
      ...type("ax", 0),
      { type: "BACKSPACE" },
      ...type("b c", 0),
    ]);
    expect(s.status).toBe("running");
  });

  it("expert fails on a skipped word", () => {
    const s = run(fixed(["abc", "d"], { strictness: "expert" }), type("ab ", 0));
    expect(s.failReason).toBe("expert");
  });

  it("master fails on the first wrong keystroke, including extras", () => {
    const wrong = run(fixed(["ab", "cd"], { strictness: "master" }), type("ax", 0));
    expect(wrong.failReason).toBe("master");
    expect(wrong.words[0].typed).toBe("ax");

    const extra = run(fixed(["ab", "cd"], { strictness: "master" }), type("abz", 0));
    expect(extra.failReason).toBe("master");
  });

  it("master fails on a skipped word", () => {
    const s = run(fixed(["abc", "d"], { strictness: "master" }), type("ab ", 0));
    expect(s.failReason).toBe("master");
  });

  it("failing a timed test scores the actual time", () => {
    let s = createInitialState({ seed: 2, config: cfg({ mode: "time", strictness: "master" }) });
    const first = s.words[0].target;
    s = run(s, [{ type: "CHAR", char: first[0], now: 0 }]);
    s = engineReducer(s, { type: "CHAR", char: "#", now: 4000 });
    expect(s.failReason).toBe("master");
    expect(getResult(s).durationSec).toBe(4);
  });

  it("ignores input after failing", () => {
    const s = run(fixed(["ab", "cd"], { strictness: "master" }), type("ax", 0));
    expect(run(s, type("b cd", 10))).toBe(s);
  });
});

describe("timed modes", () => {
  it("code mode runs for its duration and streams more tokens", () => {
    let s = createInitialState({ seed: 8, config: cfg({ mode: "code", codeTime: 15 }) });
    expect(s.durationSec).toBe(15);
    const initial = s.words.length;
    for (let i = 0; i < initial - 20; i++) s = run(s, type(s.words[s.wordIndex].target + " ", 0));
    expect(s.words.length).toBeGreaterThan(initial);
    s = engineReducer(s, { type: "TICK", now: 15_000 });
    expect(s.status).toBe("finished");
    expect(getResult(s).subMode).toBe("code_15");
  });
});

describe("reset and repeat", () => {
  it("REPEAT rebuilds the exact same text with the same config", () => {
    const start = createInitialState({ seed: 77, config: cfg({ mode: "words", words: 25, punct: true }) });
    let s = run(start, type(start.words[0].target + " x", 0));
    s = engineReducer(s, { type: "REPEAT" });
    expect(s).toEqual(start);
  });

  it("RESET can switch config", () => {
    const s = engineReducer(createInitialState({ seed: 1 }), {
      type: "RESET",
      seed: 5,
      config: cfg({ mode: "quote" }),
    });
    expect(s.config.mode).toBe("quote");
    expect(s.durationSec).toBeNull();
    expect(s.startSeed).toBe(5);
  });

  it("RESET without config keeps the current one", () => {
    const start = createInitialState({ seed: 1, config: cfg({ mode: "words", words: 50 }) });
    expect(engineReducer(start, { type: "RESET", seed: 2 }).config).toEqual(start.config);
  });
});
