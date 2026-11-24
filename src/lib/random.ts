/** A fresh 32-bit seed for the word generator. Impure by design: call it per request or per restart. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}
