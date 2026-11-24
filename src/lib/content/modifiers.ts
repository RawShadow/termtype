import type { Rng } from "./random";

const CONTRACTIONS: Record<string, string> = {
  do: "don't",
  can: "can't",
  will: "won't",
  would: "wouldn't",
  could: "couldn't",
  should: "shouldn't",
  have: "haven't",
  it: "it's",
  that: "that's",
  there: "there's",
  you: "you're",
  they: "they're",
  we: "we're",
  is: "isn't",
};

const SENTENCE_END = /[.?!]["')]?$/;

/** True when the next word should start a new sentence. */
export function endsSentence(word: string | undefined): boolean {
  return word === undefined || SENTENCE_END.test(word);
}

function capitalize(word: string): string {
  const i = word.search(/[a-z]/);
  return i === -1 ? word : word.slice(0, i) + word[i].toUpperCase() + word.slice(i + 1);
}

/**
 * Adds capitalization and punctuation: sentence-start capitals, endings
 * (`. , ? ! ; :`), occasional quoted or parenthesized words and contractions.
 * `previous` is the word before this batch, so sentences continue across batches.
 */
export function applyPunctuation(words: readonly string[], rng: Rng, previous?: string): string[] {
  const out: string[] = [];
  let capitalizeNext = endsSentence(previous);
  let sinceSentenceStart = 0;

  for (const original of words) {
    let word = original;
    if (CONTRACTIONS[word] && rng.next() < 0.08) word = CONTRACTIONS[word];
    if (capitalizeNext) word = capitalize(word);

    const wrap = rng.next();
    if (wrap < 0.03) word = `"${word}"`;
    else if (wrap < 0.05) word = `(${word})`;

    sinceSentenceStart++;
    const roll = rng.next();
    // Sentences get likelier to end the longer they run.
    const endChance = sinceSentenceStart < 3 ? 0 : Math.min(0.08 + sinceSentenceStart * 0.015, 0.3);
    let ending = "";
    if (roll < endChance) {
      const kind = rng.next();
      ending = kind < 0.75 ? "." : kind < 0.9 ? "?" : "!";
    } else if (roll < endChance + 0.1) {
      const kind = rng.next();
      ending = kind < 0.8 ? "," : kind < 0.9 ? ";" : ":";
    }
    word += ending;

    capitalizeNext = endsSentence(word) && ending !== "";
    if (capitalizeNext) sinceSentenceStart = 0;
    out.push(word);
  }
  return out;
}

/** Ends the text with a full stop (used by fixed-length words tests). */
export function closeSentence(words: string[]): string[] {
  if (words.length === 0) return words;
  const last = words[words.length - 1];
  if (/[.?!]$/.test(last)) return words;
  return [...words.slice(0, -1), last.replace(/[,;:]$/, "") + "."];
}

/** A realistic number token: small ints, larger ints, years, decimals, percents, times. */
export function randomNumberToken(rng: Rng): string {
  const kind = rng.next();
  if (kind < 0.35) return String(rng.int(0, 99));
  if (kind < 0.55) return String(rng.int(100, 9999));
  if (kind < 0.7) return String(rng.int(1970, 2030));
  if (kind < 0.8) return `${rng.int(0, 99)}.${String(rng.int(0, 99)).padStart(2, "0")}`;
  if (kind < 0.9) return `${rng.int(1, 100)}%`;
  return `${rng.int(1, 12)}:${String(rng.int(0, 59)).padStart(2, "0")}`;
}

/** Replaces roughly 12% of words with number tokens. */
export function applyNumbers(words: readonly string[], rng: Rng): string[] {
  return words.map((word) => (rng.next() < 0.12 ? randomNumberToken(rng) : word));
}
