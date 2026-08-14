/**
 * A synthetic player, used by the tests and the tuning report.
 *
 * The bot pours while the mould still needs concrete, accounting for what is
 * already in the air — which is exactly the calculation a skilled human learns
 * to do by feel. `sloppiness` perturbs its aim in fill units, so a value of 0 is
 * a theoretical perfect player and larger values approximate worse ones.
 */

import { MIXES } from '../src/config.ts';
import { nextFloat, seedState } from '../src/rng.ts';
import { createState, mouldUnderChute, setPouring, step, toResult } from '../src/simulate.ts';
import type { InputEvent, SimResult } from '../src/types.ts';

export interface BotRun {
  result: SimResult;
  log: InputEvent[];
}

export function botRun(seed: number, sloppiness = 0): BotRun {
  const s = createState(seed);
  const log: InputEvent[] = [];

  // The bot's own randomness is kept well away from the sim's stream.
  let rng = seedState(seed ^ 0x9e3779b9);

  // Re-rolled per mould so error is consistent within a pour, like a human's is.
  let aimError = 0;
  let aimedAt = -1;

  while (!s.over) {
    const m = mouldUnderChute(s);
    let want = false;

    if (m) {
      if (m.id !== aimedAt) {
        aimedAt = m.id;
        const r = nextFloat(rng);
        rng = r.state;
        aimError = (r.value * 2 - 1) * sloppiness;
      }
      const flow = MIXES[s.mix].flow;
      const remaining = m.target + aimError - m.fill - s.inFlight;
      want = remaining > flow * 0.5;
    }

    if (want !== s.pouring) {
      log.push({ frame: s.frame, type: want ? 'down' : 'up' });
      setPouring(s, want);
    }

    step(s);
  }

  return { result: toResult(s), log };
}
