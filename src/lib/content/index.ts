import type { TestConfig } from "@/lib/engine/config";
import { ALL_SNIPPETS } from "./code";
import { applyNumbers, applyPunctuation, closeSentence } from "./modifiers";
import { quotesFor, type Quote } from "./quotes";
import { createRng, type Rng } from "./random";
import { pickWords } from "./words";

export interface Content {
  words: string[];
  /** RNG state after generating, for later {@link moreContent} calls. */
  seed: number;
  /** Endless content (time, code) keeps growing as the user types. */
  endless: boolean;
  quote: Quote | null;
}

const INITIAL_WORDS = 100;
const MORE_WORDS = 50;
const INITIAL_CODE_TOKENS = 80;
const MORE_CODE_TOKENS = 40;

function wordStream(config: TestConfig, count: number, rng: Rng, previous?: string): string[] {
  let words = pickWords(count, rng, previous);
  if (config.nums) words = applyNumbers(words, rng);
  if (config.punct) words = applyPunctuation(words, rng, previous);
  return words;
}

/** Appends whole snippets until at least `minTokens` tokens, never repeating a snippet back to back. */
function codeStream(minTokens: number, rng: Rng, previous?: string): string[] {
  const tokens: string[] = [];
  let lastIndex = -1;
  while (tokens.length < minTokens) {
    let index = Math.floor(rng.next() * ALL_SNIPPETS.length);
    if (index === lastIndex) index = (index + 1) % ALL_SNIPPETS.length;
    const snippet = ALL_SNIPPETS[index].split(" ");
    // Avoid continuing a batch with the snippet that just ended the previous one.
    if (tokens.length === 0 && previous !== undefined && snippet[snippet.length - 1] === previous) {
      continue;
    }
    tokens.push(...snippet);
    lastIndex = index;
  }
  return tokens;
}

/** The full text (or the start of an endless stream) for a new test. Pure: same config + seed, same text. */
export function initialContent(config: TestConfig, seed: number): Content {
  const rng = createRng(seed);
  switch (config.mode) {
    case "time":
      return { words: wordStream(config, INITIAL_WORDS, rng), seed: rng.seed, endless: true, quote: null };
    case "words": {
      let words = wordStream(config, config.words, rng);
      if (config.punct) words = closeSentence(words);
      return { words, seed: rng.seed, endless: false, quote: null };
    }
    case "quote": {
      const quote = rng.pick(quotesFor(config.quoteLength));
      return { words: quote.text.split(" "), seed: rng.seed, endless: false, quote };
    }
    case "code":
      return { words: codeStream(INITIAL_CODE_TOKENS, rng), seed: rng.seed, endless: true, quote: null };
  }
}

/** The next batch for endless modes; `previous` is the last word already on screen. */
export function moreContent(
  config: TestConfig,
  seed: number,
  previous?: string,
): { words: string[]; seed: number } {
  const rng = createRng(seed);
  const words =
    config.mode === "code"
      ? codeStream(MORE_CODE_TOKENS, rng, previous)
      : wordStream(config, MORE_WORDS, rng, previous);
  return { words, seed: rng.seed };
}

export type { Quote } from "./quotes";
