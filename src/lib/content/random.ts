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

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Current seed, to hand back to the engine state. */
  readonly seed: number;
}

/** A local, deterministic generator. Functions that use it stay pure: same seed in, same output. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    const [value, nextSeed] = nextRandom(state);
    state = nextSeed;
    return value;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    get seed() {
      return state;
    },
  };
}
