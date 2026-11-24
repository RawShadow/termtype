import { describe, expect, it } from "vitest";
import { ENGLISH_200 } from "@/lib/words/english-200";
import { generateWords, nextRandom } from "./words";

describe("ENGLISH_200", () => {
  it("has 200 unique lowercase words", () => {
    expect(ENGLISH_200).toHaveLength(200);
    expect(new Set(ENGLISH_200).size).toBe(200);
    for (const word of ENGLISH_200) expect(word).toMatch(/^[a-z]+$/);
  });
});

describe("nextRandom", () => {
  it("returns values in [0, 1)", () => {
    let seed = 42;
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextRandom(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      seed = next;
    }
  });
});

describe("generateWords", () => {
  it("is deterministic for a seed", () => {
    expect(generateWords(50, 123)).toEqual(generateWords(50, 123));
    expect(generateWords(50, 123).words).not.toEqual(generateWords(50, 124).words);
  });

  it("only uses words from the list", () => {
    for (const word of generateWords(500, 7).words) expect(ENGLISH_200).toContain(word);
  });

  it("never repeats a word back to back, including across batches", () => {
    const first = generateWords(1, 1);
    const second = generateWords(500, first.seed, first.words[0]);
    const all = [...first.words, ...second.words];
    for (let i = 1; i < all.length; i++) expect(all[i]).not.toBe(all[i - 1]);

    // With a 2-word list, the generator has to alternate.
    const tiny = generateWords(20, 9, undefined, ["a", "b"]).words;
    for (let i = 1; i < tiny.length; i++) expect(tiny[i]).not.toBe(tiny[i - 1]);
  });
});
