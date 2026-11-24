import { ENGLISH_200 } from "@/lib/words/english-200";
import { createRng, type Rng } from "./random";

/** Picks `count` words, never repeating the same word twice in a row (also across batches via `previous`). */
export function pickWords(
  count: number,
  rng: Rng,
  previous?: string,
  list: readonly string[] = ENGLISH_200,
): string[] {
  const words: string[] = [];
  let last = previous;
  for (let i = 0; i < count; i++) {
    let index = Math.floor(rng.next() * list.length);
    if (list[index] === last && list.length > 1) index = (index + 1) % list.length;
    words.push(list[index]);
    last = list[index];
  }
  return words;
}

/** Seed-in, seed-out wrapper around {@link pickWords}. */
export function generateWords(
  count: number,
  seed: number,
  previous?: string,
  list: readonly string[] = ENGLISH_200,
): { words: string[]; seed: number } {
  const rng = createRng(seed);
  const words = pickWords(count, rng, previous, list);
  return { words, seed: rng.seed };
}
