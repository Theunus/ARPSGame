/** Deterministic PRNG (mulberry32) — the sim's only source of randomness. */

/** Advances the state and returns a float in [0, 1). */
export function nextFloat(state: number): { state: number; value: number } {
  let t = (state + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: next, value };
}

/** Weighted pick; `weights` matches `items` in length and sums to > 0. */
export function nextWeighted<T>(
  state: number,
  items: readonly T[],
  weights: readonly number[],
): { state: number; value: T } {
  let total = 0;
  for (const w of weights) total += w;

  const r = nextFloat(state);
  let roll = r.value * total;

  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return { state: r.state, value: items[i] as T };
  }
  return { state: r.state, value: items[items.length - 1] as T };
}

/** Turns an arbitrary seed into a well-mixed 32-bit starting state. */
export function seedState(seed: number): number {
  let h = seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad);
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}
