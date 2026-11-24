import { ENGLISH_200 } from "@/lib/words/english-200";

/**
 * One step of the mulberry32 PRNG. Returns a float in [0, 1) and the next
 * seed, so callers can keep the generator state in immutable data.
 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextSeed];
}

/**
 * Picks `count` words from `list`, never repeating the same word twice in a
 * row (including across batches when `previous` is given).
 */
export function generateWords(
  count: number,
  seed: number,
  previous?: string,
  list: readonly string[] = ENGLISH_200,
): { words: string[]; seed: number } {
  const words: string[] = [];
  let current = seed >>> 0;
  let last = previous;
  for (let i = 0; i < count; i++) {
    const [value, next] = nextRandom(current);
    current = next;
    let index = Math.floor(value * list.length);
    if (list[index] === last && list.length > 1) index = (index + 1) % list.length;
    const word = list[index];
    words.push(word);
    last = word;
  }
  return { words, seed: current };
}
