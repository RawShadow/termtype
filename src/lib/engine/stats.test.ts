import { describe, expect, it } from "vitest";
import {
  accuracy,
  charStates,
  coefficientOfVariation,
  consistency,
  countChars,
  netWpm,
  rawWpm,
} from "./stats";

describe("netWpm", () => {
  it("divides chars by 5 per minute and rounds", () => {
    expect(netWpm(150, 30)).toBe(60);
    expect(netWpm(152, 30)).toBe(61); // 60.8 → 61
    expect(netWpm(151, 30)).toBe(60); // 60.4 → 60
  });
  it("returns 0 for zero or negative elapsed time", () => {
    expect(netWpm(100, 0)).toBe(0);
    expect(netWpm(100, -1)).toBe(0);
  });
  it("is never negative", () => {
    expect(netWpm(-10, 30)).toBe(0);
  });
});

describe("rawWpm", () => {
  it("uses all typed chars", () => {
    expect(rawWpm(300, 60)).toBe(60);
    expect(rawWpm(10, 1)).toBe(120);
  });
  it("returns 0 for zero elapsed time", () => {
    expect(rawWpm(10, 0)).toBe(0);
  });
});

describe("accuracy", () => {
  it("is a percentage with one decimal", () => {
    expect(accuracy(90, 100)).toBe(90);
    expect(accuracy(2, 3)).toBe(66.7);
    expect(accuracy(1, 1)).toBe(100);
  });
  it("is 0 with no keystrokes", () => {
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe("coefficientOfVariation / consistency", () => {
  it("is 0 for empty input and for a zero mean", () => {
    expect(coefficientOfVariation([])).toBe(0);
    expect(coefficientOfVariation([0, 0, 0])).toBe(0);
    expect(consistency([0, 0, 0])).toBe(100);
  });
  it("is 0 / 100 for a constant series", () => {
    expect(coefficientOfVariation([60, 60, 60])).toBe(0);
    expect(consistency([60, 60, 60])).toBe(100);
  });
  it("uses population standard deviation", () => {
    // mean 50, std dev 10 → CV 20%
    expect(coefficientOfVariation([40, 60])).toBeCloseTo(20);
    expect(consistency([40, 60])).toBe(80);
  });
  it("never goes below 0", () => {
    expect(consistency([0, 0, 0, 300])).toBe(0);
  });
});

describe("charStates", () => {
  it("marks correct, incorrect, untyped and extra chars", () => {
    expect(charStates({ target: "cat", typed: "cx" })).toEqual([
      { char: "c", state: "correct" },
      { char: "a", state: "incorrect" },
      { char: "t", state: "untyped" },
    ]);
    expect(charStates({ target: "go", typed: "goes" })).toEqual([
      { char: "g", state: "correct" },
      { char: "o", state: "correct" },
      { char: "e", state: "extra" },
      { char: "s", state: "extra" },
    ]);
  });
});

describe("countChars", () => {
  const words = [
    { target: "the", typed: "the" }, // correct: 3 + space
    { target: "cat", typed: "cxt" }, // 2 correct, 1 incorrect
    { target: "sat", typed: "s" }, // skipped: 1 correct, 2 missed
    { target: "on", typed: "only" }, // 2 correct, 2 extra
    { target: "mat", typed: "ma" }, // in progress, error-free
    { target: "now", typed: "" },
  ];

  it("breaks down committed and in-progress words", () => {
    expect(countChars(words, 4)).toEqual({
      correct: 3 + 2 + 1 + 2 + 2,
      incorrect: 1,
      extra: 2,
      missed: 2,
      correctWithSpaces: 4 + 2,
    });
  });

  it("drops the in-progress word from net chars once it has an error", () => {
    const withError = words.map((w, i) => (i === 4 ? { ...w, typed: "mx" } : w));
    expect(countChars(withError, 4).correctWithSpaces).toBe(4);
  });

  it("does not count missed chars for the in-progress word", () => {
    expect(countChars([{ target: "hello", typed: "he" }], 0).missed).toBe(0);
  });
});
