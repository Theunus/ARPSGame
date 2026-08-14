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

import { MAX_INPUT_EVENTS, TICK_HZ } from '../src/config.ts';
import { createState, simulate, step, validateInputLog, verifyRun } from '../src/simulate.ts';
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
    // Pouring forever spills every mould it reaches.
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
