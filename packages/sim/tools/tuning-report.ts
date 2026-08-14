/**
 * Tuning harness. Run with:  npm run tune --workspace=@pourline/sim
 *
 * Plays synthetic players of varying accuracy across many seeds and reports the
 * resulting score and run-length distributions. This is a sighting shot, not a
 * substitute for real thumbs — but it catches the things playtesting is too slow
 * to catch, like a difficulty ramp that makes a mould literally unfillable.
 *
 * Targets, from artifacts/grill-me/PourLine-Grill-Me-2.md:
 *   - median run 35-45s, strong players capped near 90s
 *   - scores in the thousands, well spread so ties at the top are rare
 */

import {
  MIXES,
  MIX_SCHEDULE,
  MOULDS,
  SCROLL_SPEED_END,
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

// A mould whose dwell time is shorter than its fill time is unwinnable, not hard.
// This is the failure mode most likely to slip past playtesting, because it only
// appears deep into a run that few testers reach.
//
// The check is schedule-aware: each mix is measured at the fastest scroll speed
// it can actually be encountered at, not at the global maximum. Mortar never
// meets a fast line, so judging it there would be a false alarm — and a tuning
// tool that cries wolf gets ignored, which is worse than not having one.
function lastProgressFor(mix: MixKind): number {
  let last = 0;
  for (const band of MIX_SCHEDULE) {
    if (band.mixes.includes(mix)) last = Math.max(last, Math.min(band.until, 1));
  }
  return last;
}

function speedAt(progress: number): number {
  return SCROLL_SPEED_START + (SCROLL_SPEED_END - SCROLL_SPEED_START) * Math.min(progress, 1);
}

console.log('\nFeasibility — dwell vs fill at the fastest speed each mix can appear at:\n');
console.log(
  'mould         |  ' + Object.keys(MIXES).map((m) => m.slice(0, 7).padStart(9)).join(''),
);
console.log(
  '              |  ' +
    Object.keys(MIXES)
      .map((m) => `@${speedAt(lastProgressFor(m as MixKind)).toFixed(1)}`.padStart(9))
      .join(''),
);
console.log('-'.repeat(84));

let infeasible = 0;
for (const mould of Object.values(MOULDS)) {
  const cells = Object.values(MIXES).map((mix) => {
    const dwell = mould.width / speedAt(lastProgressFor(mix.kind));
    const ratio = dwell / (mould.target / mix.flow);
    if (ratio < 1.1) infeasible++;
    return `${ratio.toFixed(2)}x`.padStart(9);
  });
  console.log(`${mould.kind.padEnd(13)} |  ${cells.join('')}`);
}

console.log(
  infeasible > 0
    ? `\n  ${infeasible} combination(s) below 1.1x — near-impossible, not merely hard. Retune.\n`
    : '\n  Every mould stays fillable by every mix it can meet.\n',
);
