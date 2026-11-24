import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type TestConfig } from "@/lib/engine/config";
import { ALL_SNIPPETS, MAX_TOKEN_LENGTH, SNIPPETS } from "./code";
import { initialContent, moreContent } from "./index";
import { applyNumbers, applyPunctuation, closeSentence, endsSentence } from "./modifiers";
import { QUOTES, quoteLengthOf, quotesFor, wordCount } from "./quotes";
import { createRng } from "./random";

const cfg = (patch: Partial<TestConfig>): TestConfig => ({ ...DEFAULT_CONFIG, ...patch });
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

describe("quotes", () => {
  it("are clean single-spaced ASCII with an author", () => {
    for (const q of QUOTES) {
      expect(q.text, q.text).toMatch(PRINTABLE_ASCII);
      expect(q.text, q.text).not.toMatch(/\s{2,}|^\s|\s$/);
      expect(q.author.length).toBeGreaterThan(0);
    }
  });

  it("are unique", () => {
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
  });

  it("fill every length bucket", () => {
    for (const length of ["short", "medium", "long"] as const) {
      const bucket = quotesFor(length);
      expect(bucket.length, length).toBeGreaterThanOrEqual(5);
      for (const q of bucket) expect(quoteLengthOf(q)).toBe(length);
    }
    expect(quotesFor("all")).toHaveLength(QUOTES.length);
    expect(wordCount("a b c")).toBe(3);
  });
});

describe("code snippets", () => {
  it("cover every group with realistic, unique single-line text", () => {
    for (const [group, list] of Object.entries(SNIPPETS)) {
      expect(list.length, group).toBeGreaterThanOrEqual(15);
    }
    expect(new Set(ALL_SNIPPETS).size).toBe(ALL_SNIPPETS.length);
    expect(ALL_SNIPPETS.length).toBeGreaterThanOrEqual(120);
  });

  it("are ASCII, single-spaced, and every token fits on a line", () => {
    for (const snippet of ALL_SNIPPETS) {
      expect(snippet, snippet).toMatch(PRINTABLE_ASCII);
      expect(snippet, snippet).not.toMatch(/\s{2,}|^\s|\s$/);
      for (const token of snippet.split(" ")) {
        expect(token.length, `${token} in ${snippet}`).toBeLessThanOrEqual(MAX_TOKEN_LENGTH);
      }
    }
  });
});

describe("modifiers", () => {
  const plain = Array.from({ length: 300 }, (_, i) => ["the", "do", "it", "world"][i % 4]);

  it("adds capitals and punctuation deterministically", () => {
    const a = applyPunctuation(plain, createRng(3));
    expect(a).toEqual(applyPunctuation(plain, createRng(3)));
    expect(a[0][0]).toBe("T"); // first word starts a sentence
    expect(a.some((w) => /[.?!]$/.test(w))).toBe(true);
    expect(a.some((w) => /,$/.test(w))).toBe(true);
    expect(a.some((w) => w.includes("'"))).toBe(true);
    // Every word after a sentence end is capitalized.
    for (let i = 1; i < a.length; i++) {
      if (/[.?!]$/.test(a[i - 1])) expect(a[i], `${a[i - 1]} ${a[i]}`).toMatch(/^["(]?[A-Z]/);
    }
  });

  it("continues sentences across batches", () => {
    expect(applyPunctuation(["more"], createRng(1), "end.")[0]).toMatch(/^["(]?M/);
    expect(applyPunctuation(["more"], createRng(1), "middle")[0]).toMatch(/^["(]?m/);
    expect(endsSentence(undefined)).toBe(true);
    expect(endsSentence('"done."')).toBe(true);
  });

  it("closes the final sentence", () => {
    expect(closeSentence(["Hi", "there,"])).toEqual(["Hi", "there."]);
    expect(closeSentence(["Done!"])).toEqual(["Done!"]);
  });

  it("mixes in realistic numbers", () => {
    const out = applyNumbers(plain, createRng(8));
    const numbers = out.filter((w) => /\d/.test(w));
    expect(numbers.length).toBeGreaterThan(10);
    expect(numbers.length).toBeLessThan(80);
    for (const n of numbers) expect(n).toMatch(/^(\d+|\d+\.\d{2}|\d+%|\d{1,2}:\d{2})$/);
  });
});

describe("initialContent / moreContent", () => {
  it("is deterministic for config + seed", () => {
    for (const mode of ["time", "words", "quote", "code"] as const) {
      expect(initialContent(cfg({ mode }), 42)).toEqual(initialContent(cfg({ mode }), 42));
    }
  });

  it("gives words mode exactly N words, ending a sentence with --punct", () => {
    for (const words of [10, 25, 50, 100] as const) {
      const c = initialContent(cfg({ mode: "words", words, punct: true }), 7);
      expect(c.words).toHaveLength(words);
      expect(c.endless).toBe(false);
      expect(c.words[c.words.length - 1]).toMatch(/[.?!]$/);
    }
  });

  it("gives quote mode one whole quote of the requested length", () => {
    const c = initialContent(cfg({ mode: "quote", quoteLength: "long" }), 11);
    expect(c.quote).not.toBeNull();
    expect(quoteLengthOf(c.quote!)).toBe("long");
    expect(c.words.join(" ")).toBe(c.quote!.text);
    expect(c.endless).toBe(false);
  });

  it("streams whole code snippets endlessly", () => {
    const c = initialContent(cfg({ mode: "code" }), 5);
    expect(c.endless).toBe(true);
    expect(c.words.length).toBeGreaterThanOrEqual(80);
    // The stream is made of complete snippets.
    const text = c.words.join(" ");
    expect(ALL_SNIPPETS.some((s) => text.startsWith(s))).toBe(true);
    const more = moreContent(cfg({ mode: "code" }), c.seed, c.words[c.words.length - 1]);
    expect(more.words.length).toBeGreaterThanOrEqual(40);
  });

  it("ignores --punct / --nums outside time and words", () => {
    const plainQuote = initialContent(cfg({ mode: "quote" }), 9);
    expect(initialContent(cfg({ mode: "quote", punct: true, nums: true }), 9)).toEqual(plainQuote);
  });

  it("applies --nums and --punct to time mode", () => {
    const c = initialContent(cfg({ mode: "time", punct: true, nums: true }), 2);
    expect(c.words.some((w) => /\d/.test(w))).toBe(true);
    expect(c.words.some((w) => /^[A-Z]/.test(w))).toBe(true);
  });
});
