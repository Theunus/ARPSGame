/**
 * These tests are the load-bearing ones.
 *
 * The entire anti-cheat design rests on a single claim: the same seed and the
 * same inputs always produce the same score, in any V8 runtime. If that ever
 * stops being true, forged scores become undetectable and the leaderboard is
 * worthless. Treat a failure here as a stop-the-line event.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GROUND_SPILL_LIMIT, MAX_INPUT_EVENTS, MIXES, TICK_HZ } from '../src/config.ts';
import {
  createState,
  mouldUnderChute,
  setPouring,
  simulate,
  step,
  validateInputLog,
  verifyRun,
} from '../src/simulate.ts';
import type { InputEvent } from '../src/types.ts';
import { botRun } from './bot.ts';

const SEEDS = [1, 42, 1337, 900_001, 2_147_483_647];

describe('determinism', () => {
  it('replays a bot run to an identical result', () => {
    for (const seed of SEEDS) {
      const { result, log } = botRun(seed, 2);
      const replayed = simulate(seed, log);
      assert.deepEqual(replayed, result, `seed ${seed} did not replay identically`);
    }
  });

  it('is stable across repeated replays of the same log', () => {
    const { log } = botRun(4242, 3);
    const a = simulate(4242, log);
    const b = simulate(4242, log);
    const c = simulate(4242, log);
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  });

  it('produces different worlds for different seeds', () => {
    const scores = new Set(SEEDS.map((seed) => botRun(seed, 4).result.score));
    assert.ok(scores.size > 1, 'every seed produced the same score — the seed is not being used');
  });

  it('never mutates the world from wall-clock time', () => {
    // Two runs of the same seed with an artificial delay between them. Any use
    // of Date.now or Math.random inside the sim would show up here.
    const a = simulate(777, botRun(777, 1).log);
    const start = Date.now();
    while (Date.now() - start < 5) {
      /* burn a few ms */
    }
    const b = simulate(777, botRun(777, 1).log);
    assert.deepEqual(a, b);
  });
});

describe('verifyRun', () => {
  it('accepts a genuine run', () => {
    const { result, log } = botRun(31337, 2);
    const outcome = verifyRun(31337, log, result.score);
    assert.equal(outcome.ok, true, outcome.reason ?? 'verification failed');
    assert.equal(outcome.result?.score, result.score);
  });

  it('rejects an inflated score', () => {
    const { result, log } = botRun(31337, 2);
    const outcome = verifyRun(31337, log, result.score + 1);
    assert.equal(outcome.ok, false);
    assert.match(outcome.reason ?? '', /score mismatch/);
  });

  it('rejects a run replayed against the wrong seed', () => {
    const { result, log } = botRun(31337, 2);
    const outcome = verifyRun(99999, log, result.score);
    assert.equal(outcome.ok, false);
  });

  it('rejects an empty log claiming a high score', () => {
    const outcome = verifyRun(31337, [], 50_000);
    assert.equal(outcome.ok, false);
  });
});

describe('validateInputLog', () => {
  it('accepts a well-formed log', () => {
    const { log } = botRun(5, 2);
    assert.equal(validateInputLog(log).ok, true);
  });

  it('rejects out-of-order frames', () => {
    const log: InputEvent[] = [
      { frame: 10, type: 'down' },
      { frame: 5, type: 'up' },
    ];
    assert.equal(validateInputLog(log).ok, false);
  });

  it('rejects non-integer and negative frames', () => {
    assert.equal(validateInputLog([{ frame: 1.5, type: 'down' }]).ok, false);
    assert.equal(validateInputLog([{ frame: -1, type: 'down' }]).ok, false);
  });

  it('rejects an oversized log', () => {
    const log: InputEvent[] = Array.from({ length: MAX_INPUT_EVENTS + 1 }, (_, i) => ({
      frame: i,
      type: i % 2 === 0 ? ('down' as const) : ('up' as const),
    }));
    assert.equal(validateInputLog(log).ok, false);
  });
});

describe('rules', () => {
  it('ends a run after three strikes', () => {
    // Never touching the screen misses every mould, so the run must end at three.
    const result = simulate(2024, []);
    assert.equal(result.strikes, 3);
    assert.equal(result.score, 0);
    assert.equal(result.endedNaturally, true);
  });

  it('ends an idle run quickly enough to keep a queue moving', () => {
    const result = simulate(2024, []);
    assert.ok(
      result.frames < TICK_HZ * 25,
      `an idle run took ${(result.frames / TICK_HZ).toFixed(1)}s to end`,
    );
  });

  it('rewards accuracy — a tighter player outscores a sloppier one', () => {
    let tightWins = 0;
    for (const seed of SEEDS) {
      const tight = botRun(seed, 1).result.score;
      const sloppy = botRun(seed, 8).result.score;
      if (tight > sloppy) tightWins++;
    }
    assert.ok(
      tightWins >= SEEDS.length - 1,
      `accuracy only paid off on ${tightWins}/${SEEDS.length} seeds`,
    );
  });

  it('cannot score by holding the pour open', () => {
    // Pouring forever hits the ground-spill limit before any mould even
    // arrives, then spills every mould it reaches after that.
    const result = simulate(2024, [{ frame: 0, type: 'down' }]);
    assert.equal(result.strikes, 3);
    assert.equal(result.score, 0);
  });

  it('does not let the state machine stall', () => {
    const s = createState(11);
    let guard = 0;
    while (!s.over && guard < 100_000) {
      step(s);
      guard++;
    }
    assert.ok(s.over, 'simulation never terminated');
  });
});

describe('ground spill', () => {
  // No mould exists this early — nextSpawnX starts well off-screen — so every
  // test here is exercising concrete landing with nothing under the chute.

  it('forgives a brief tap into empty space', () => {
    const s = createState(9001);
    setPouring(s, true);
    for (let i = 0; i < 8; i++) step(s); // well under the limit at any mix's flow rate
    setPouring(s, false);
    for (let i = 0; i < 20; i++) step(s); // let the tail's tail-end land
    assert.equal(s.strikes, 0, `a brief tap should not strike, got ${s.strikes} strikes`);
  });

  it('strikes for a sustained pour into empty space', () => {
    const s = createState(9001);
    setPouring(s, true);

    let strikeFrame: number | null = null;
    let guard = 0;
    while (s.strikes === 0 && guard++ < 500) {
      step(s);
      if (s.events.some((e) => e.kind === 'strike')) strikeFrame = s.frame;
    }

    assert.equal(s.strikes, 1);
    assert.ok(strikeFrame !== null, 'no strike event was emitted');
    // Confirms this struck via ground spill, not a mould overflowing — no
    // mould can possibly have arrived yet at this speed.
    assert.ok(
      (strikeFrame as number) < 200,
      `strike fired at frame ${strikeFrame}, too late to be ground spill`,
    );
  });

  it('resets the streak once concrete lands in a live mould', () => {
    const s = createState(9001);

    // Bleed some ground spill, short of the limit, then stop.
    setPouring(s, true);
    for (let i = 0; i < 8; i++) step(s);
    setPouring(s, false);
    for (let i = 0; i < 5; i++) step(s);
    assert.ok(s.groundSpill > 0, 'test setup should have left some ground spill');

    // Fast-forward to the first mould and pour into it.
    let guard = 0;
    while (!mouldUnderChute(s) && guard++ < 2000) step(s);
    assert.ok(mouldUnderChute(s), 'a mould never arrived — test setup is wrong');

    setPouring(s, true);
    for (let i = 0; i < 20; i++) step(s); // long enough for a delivery to land

    assert.equal(s.groundSpill, 0, 'landing in a live mould should clear the streak');
  });

  it('does not double-count an overflowing mould as a ground spill', () => {
    const s = createState(9001);
    let guard = 0;
    while (!mouldUnderChute(s) && guard++ < 2000) step(s);

    setPouring(s, true);
    let strikeCount = 0;
    guard = 0;
    // Pour well past the mould's brim.
    while (strikeCount === 0 && guard++ < 400) {
      step(s);
      strikeCount += s.events.filter((e) => e.kind === 'strike').length;
    }

    assert.equal(strikeCount, 1, 'an overflowing mould should cost exactly one strike');
    assert.equal(s.groundSpill, 0, 'a mould overflow is not ground spill');
  });

  it('is deterministic — same seed, same log, same strikes', () => {
    const log: InputEvent[] = [
      { frame: 0, type: 'down' },
      { frame: 6, type: 'up' },
    ];
    const a = simulate(9001, log);
    const b = simulate(9001, log);
    assert.deepEqual(a, b);
  });

  it('the tunable limit is a sane positive number', () => {
    // Guards against a future edit accidentally zeroing or negating this —
    // either would make every touch, or no touch, strike instantly.
    assert.ok(GROUND_SPILL_LIMIT > 0);
  });

  /**
   * A well-timed early press must never touch this limit, at any flow rate —
   * otherwise anticipating the tail correctly (the entire skill the game
   * teaches) would itself be punished. Delivery is deferred by `tail`, so
   * concrete poured up to exactly `tail` frames before a mould arrives lands
   * the instant the mould does, contributing nothing to `groundSpill`
   * regardless of how large or small the limit is tuned to.
   *
   * Screed is the case to check: fastest flow (most fill per frame of
   * "too early") and longest tail (the largest legitimate anticipation
   * window), so it is the mix most likely to trip this if the interaction
   * were ever wrong.
   */
  it('never strikes a press timed exactly to the tail, even for the tightest mix', () => {
    const tail = MIXES.screed.tail;

    const probe = createState(42);
    probe.mix = 'screed';
    let guard = 0;
    while (!mouldUnderChute(probe) && guard++ < 3000) step(probe);
    const arrivalFrame = probe.frame;

    const s = createState(42);
    s.mix = 'screed';
    guard = 0;
    while (s.frame < arrivalFrame - tail && guard++ < 3000) step(s);
    setPouring(s, true);
    for (let i = 0; i < 40 && !s.over; i++) step(s);

    assert.equal(s.strikes, 0);
    assert.equal(s.groundSpill, 0);
    assert.equal(s.wasted, 0, 'a perfectly-timed early press should waste nothing');
  });

  it('strikes proportionally to how much too early a press is', () => {
    const tail = MIXES.screed.tail;
    const tooEarlyBy = 10;

    const probe = createState(42);
    probe.mix = 'screed';
    let guard = 0;
    while (!mouldUnderChute(probe) && guard++ < 3000) step(probe);
    const arrivalFrame = probe.frame;

    const s = createState(42);
    s.mix = 'screed';
    guard = 0;
    while (s.frame < arrivalFrame - tail - tooEarlyBy && guard++ < 3000) step(s);
    setPouring(s, true);
    for (let i = 0; i < 60 && !s.over; i++) step(s);

    assert.equal(s.strikes, 1);
    // The strike resets groundSpill, but total waste before that reset should
    // match what a tooEarlyBy-frame head start delivers onto the ground
    // before the mould shows up. assert.equal on floats here would be
    // fragile — this is float accumulation (0.75 × 18 etc.), not integers.
    assert.ok(
      Math.abs(s.wasted - tooEarlyBy * MIXES.screed.flow) < 1e-9,
      `expected wasted ≈ ${tooEarlyBy * MIXES.screed.flow}, got ${s.wasted}`,
    );
  });
});
