/**
 * Tuning harness. Run with:  npm run tune --workspace=@pourline/sim
 *
 * Plays synthetic players of varying accuracy across many seeds and reports the
 * resulting score and run-length distributions. This is a sighting shot, not a
 * substitute for real thumbs — but it catches the things playtesting is too slow
 * to catch, like a difficulty ramp that makes a mould literally unfillable.
 *
 * Targets, from artifacts/grill-me/PourLine-Grill-Me-2.md:
 *   - median run 35-45s
 *   - scores in the thousands, well spread so ties at the top are rare
 *   - speed climbs forever (Piano Tiles-style), so nothing here should show a
 *     hard plateau in run length for the top tiers — see the wall table below
 *     for what eventually ends even a flawless run
 */

import {
  MIXES,
  MIX_SCHEDULE,
  MOULDS,
  RAMP_FRAMES,
  SCROLL_SPEED_PER_RAMP,
  SCROLL_SPEED_START,
  TICK_HZ,
} from '../src/config.ts';
import { botRun } from '../test/bot.ts';
import type { MixKind } from '../src/types.ts';

const SEED_COUNT = 200;

/** Accuracy in fill units. Lower is better; these approximate skill tiers. */
const TIERS: ReadonlyArray<{ name: string; sloppiness: number }> = [
  { name: 'Expert   ', sloppiness: 1 },
  { name: 'Good     ', sloppiness: 3 },
  { name: 'Average  ', sloppiness: 6 },
  { name: 'First run', sloppiness: 11 },
];

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? 0;
  return a + (b - a) * (i - lo);
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n);
}

console.log(`\nPour Line — tuning report  (${SEED_COUNT} seeds per tier)\n`);
console.log('Tier        median    p90    max  |  median   p90    max  |  perfect%  ties@top');
console.log('             score  score  score  |    secs  secs   secs  |');
console.log('-'.repeat(84));

for (const tier of TIERS) {
  const scores: number[] = [];
  const secs: number[] = [];
  let perfects = 0;
  let moulds = 0;

  for (let seed = 1; seed <= SEED_COUNT; seed++) {
    const { result } = botRun(seed * 7919, tier.sloppiness);
    scores.push(result.score);
    secs.push(result.frames / TICK_HZ);
    perfects += result.perfects;
    moulds += result.mouldsCompleted;
  }

  scores.sort((a, b) => a - b);
  secs.sort((a, b) => a - b);

  // How many of the top 20 scores collide — a proxy for how often a prize would
  // come down to the tie-break rule.
  const top = scores.slice(-20);
  const ties = top.length - new Set(top).size;

  console.log(
    `${tier.name}  ${pad(Math.round(quantile(scores, 0.5)), 6)} ${pad(
      Math.round(quantile(scores, 0.9)),
      6,
    )} ${pad(scores[scores.length - 1] ?? 0, 6)}  |  ${pad(quantile(secs, 0.5).toFixed(1), 6)} ${pad(
      quantile(secs, 0.9).toFixed(1),
      5,
    )} ${pad((secs[secs.length - 1] ?? 0).toFixed(1), 6)}  |  ${pad(
      ((perfects / Math.max(moulds, 1)) * 100).toFixed(0) + '%',
      8,
    )}  ${pad(ties, 8)}`,
  );
}

// Speed no longer has a ceiling, so every mould/mix pair becomes infeasible
// *eventually* — dwell time (width / speed) keeps falling while fill time
// (target / flow) stays fixed. That is by design: it is the wall a flawless
// player eventually hits. The question worth asking isn't "is this ever
// infeasible" (always, now) but "how long does it take to get there, and is the
// mix still reachable when it does" — a mix that retired from the schedule
// long before its wall arrives can never actually cause the problem.
//
// Solve dwell/fill = 1.1 for the time at which each pair crosses the line:
//   width / (START + PER_RAMP * t/RAMP_SECONDS) = 1.1 * target / flow
const RAMP_SECONDS = RAMP_FRAMES / TICK_HZ;

function wallSeconds(width: number, target: number, flow: number): number {
  const speedAtWall = (width * flow) / (1.1 * target);
  return (RAMP_SECONDS * (speedAtWall - SCROLL_SPEED_START)) / SCROLL_SPEED_PER_RAMP;
}

/**
 * Last moment a mix can still be picked, in seconds. A mix present in a
 * schedule band with `until >= 1` is selectable forever, because ramp progress
 * clamps at 1 and never leaves that final band — see rampProgress in simulate.ts.
 */
function retiresAt(mix: MixKind): number {
  let last = 0;
  for (const band of MIX_SCHEDULE) {
    if (band.mixes.includes(mix)) {
      if (band.until >= 1) return Infinity;
      last = Math.max(last, band.until);
    }
  }
  return last * RAMP_SECONDS;
}

const LATE_WALL_S = 200; // above this the wall is irrelevant — no run gets there

// Pacing floor for mixes that never retire (general, screed). They have no
// schedule escape, so their wall must simply land well past where real runs
// end — comfortably beyond the top tier's p90 in the table above, so the wall
// reads as "you broke the game" rather than "you got an unfair strike at your
// normal death time".
const PACING_FLOOR_S = 100;

console.log('\nThe wall — seconds of survival before dwell time drops below fill time:\n');
console.log(
  'mould         |  ' + Object.keys(MIXES).map((m) => m.slice(0, 7).padStart(9)).join(''),
);
console.log('-'.repeat(84));

let problems = 0;
for (const mould of Object.values(MOULDS)) {
  const cells = Object.values(MIXES).map((mix) => {
    const wall = wallSeconds(mould.width, mould.target, mix.flow);
    const retires = retiresAt(mix.kind);

    // A retiring mix is only a problem if the wall arrives before it retires —
    // otherwise it is gone from the schedule long before it would matter. A
    // non-retiring mix has no such escape, so it is judged against the pacing
    // floor instead.
    const bad = retires === Infinity ? wall < PACING_FLOOR_S : wall < retires;
    if (bad) problems++;

    if (retires !== Infinity && wall >= retires) return 'retires'.padStart(9);
    return `${wall > LATE_WALL_S ? '>' + LATE_WALL_S : wall.toFixed(0) + 's'}${bad ? '!' : ''}`.padStart(9);
  });
  console.log(`${mould.kind.padEnd(13)} |  ${cells.join('')}`);
}

console.log(
  problems > 0
    ? `\n  ${problems} combination(s) marked '!' — either the wall arrives while a retiring mix\n  is still live, or a non-retiring mix (general, screed) walls before ${PACING_FLOOR_S}s.\n  Both are an unwinnable strike, not difficulty. Lower SCROLL_SPEED_PER_RAMP or\n  raise a mould's width.\n`
    : `\n  Every retiring mix (mortar, high-strength) is gone from the schedule before\n  its wall. Every non-retiring mix (general, screed) walls past ${PACING_FLOOR_S}s —\n  only a flawless, very long run ever reaches it.\n`,
);
