/**
 * The Pour Line simulation.
 *
 * This module is the single source of truth for what a score means. It runs
 * unchanged in the browser (rendered by Phaser) and on the server (headless, to
 * re-derive a submitted score from its seed and input log). A score that cannot
 * be reproduced here did not happen.
 *
 * Rules this file must never break:
 *   - fixed timestep, no wall-clock time, no `Date.now`
 *   - no `Math.random` — every random decision comes from `./rng.ts`
 *   - no DOM, no Phaser, no imports outside this package
 */

import {
  CHUTE_X,
  GAP_END,
  GAP_START,
  GOOD_WINDOW_MULT,
  MAX_COMBO_MULT,
  MAX_FRAMES,
  MAX_INPUT_EVENTS,
  MAX_STRIKES,
  MAX_TAIL,
  MISS_FLOOR_SLOPE,
  MISS_FLOOR_START,
  MIXES,
  MIX_CHANGE_EVERY,
  MIX_SCHEDULE,
  MOULDS,
  MOULD_SCHEDULE,
  OVER_BAND_MULT,
  PERFECT_WINDOW_END,
  PERFECT_WINDOW_START,
  RAMP_FRAMES,
  SCROLL_SPEED_PER_RAMP,
  SCROLL_SPEED_START,
  SPILL_MARGIN_SLOPE,
  SPILL_MARGIN_START,
  TIER_MULT,
  WORLD_W,
} from './config.ts';
import { nextWeighted, seedState } from './rng.ts';
import type {
  InputEvent,
  MixKind,
  Mould,
  MouldKind,
  PourOutcome,
  SimResult,
  SimState,
  Tolerance,
} from './types.ts';

const EPSILON = 1e-9;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 0 at the start of a run, 1 once full difficulty is reached, then held.
 * Drives scroll speed, spacing and which moulds and mixes appear.
 */
function rampProgress(frame: number): number {
  const p = frame / RAMP_FRAMES;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * The same ramp, deliberately uncapped. Only the judging tolerance uses it, and
 * only because it must keep tightening past full difficulty — see the note in
 * config.ts. Clamping this would let an accurate player survive indefinitely.
 *
 * Scroll speed uses this too, not because tolerance and speed are related, but
 * because both need the same "keep going forever" shape. A single unclamped
 * ramp function serves both rather than inventing a second one that behaves
 * identically.
 */
function unboundedProgress(frame: number): number {
  const p = frame / RAMP_FRAMES;
  return p < 0 ? 0 : p;
}

/**
 * Judging thresholds at a moment in the run, in fill units for a given mould.
 * Exported so the renderer draws exactly the bands the sim scores against —
 * there is no second copy of these numbers anywhere.
 */
export function toleranceFor(target: number, flow: number, frame: number): Tolerance {
  const tp = unboundedProgress(frame);
  const rp = rampProgress(frame);

  const spillFrac = Math.max(0, SPILL_MARGIN_START - SPILL_MARGIN_SLOPE * tp);
  const missFrac = Math.min(1, MISS_FLOOR_START + MISS_FLOOR_SLOPE * tp);

  const window = lerp(PERFECT_WINDOW_START, PERFECT_WINDOW_END, rp);
  const perfectUnder = flow * window;
  const perfectOver = perfectUnder * OVER_BAND_MULT;

  return {
    spillOver: target * spillFrac,
    missUnder: target * (1 - missFrac),
    perfectUnder,
    perfectOver,
    goodUnder: perfectUnder * GOOD_WINDOW_MULT,
    goodOver: perfectOver * GOOD_WINDOW_MULT,
  };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createState(seed: number): SimState {
  const s: SimState = {
    frame: 0,
    score: 0,
    strikes: 0,
    combo: 0,
    maxCombo: 0,
    mouldsCompleted: 0,
    perfects: 0,
    wasted: 0,
    over: false,

    pouring: false,
    releaseFrame: null,

    moulds: [],
    nextMouldId: 1,
    // A beat of empty track before the first mould, so the player can read the scene.
    nextSpawnX: WORLD_W + 120,
    spawnIndex: 0,

    mix: 'mortar',
    pendingMix: null,
    inFlight: 0,

    delay: new Float64Array(MAX_TAIL),
    delayLen: MAX_TAIL,

    rngState: seedState(seed),

    events: [],
  };
  return s;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Sets the pour state. Called by the client on touch, and by the replay
 * validator from the recorded log — the same code path in both cases, which is
 * what makes the two agree.
 */
export function setPouring(s: SimState, pouring: boolean): void {
  if (s.pouring === pouring) return;
  s.pouring = pouring;
  if (!pouring) s.releaseFrame = s.frame;
}

/** Cheap structural checks before a submitted log is worth simulating. */
export function validateInputLog(log: readonly InputEvent[]): { ok: boolean; reason?: string } {
  if (!Array.isArray(log)) return { ok: false, reason: 'log is not an array' };
  if (log.length > MAX_INPUT_EVENTS) return { ok: false, reason: 'log too long' };

  let last = -1;
  for (const ev of log) {
    if (!ev || (ev.type !== 'down' && ev.type !== 'up')) {
      return { ok: false, reason: 'bad event type' };
    }
    if (!Number.isInteger(ev.frame) || ev.frame < 0 || ev.frame >= MAX_FRAMES) {
      return { ok: false, reason: 'frame out of range' };
    }
    if (ev.frame < last) return { ok: false, reason: 'frames out of order' };
    last = ev.frame;
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stepping
// ---------------------------------------------------------------------------

/** The mould currently receiving concrete, if any. Also used by the renderer and bots. */
export function mouldUnderChute(s: SimState): Mould | null {
  for (const m of s.moulds) {
    if (m.evaluated) continue;
    if (m.x <= CHUTE_X && CHUTE_X <= m.x + m.width) return m;
  }
  return null;
}

/**
 * Concrete lands in whatever mould is under the chute *now*, not the one that
 * was there when it left the chute. That is physically right, and on fast scroll
 * it quietly punishes pouring too late.
 */
function deliver(s: SimState, amount: number): void {
  const m = mouldUnderChute(s);
  if (!m || m.spilled) {
    s.wasted += amount;
    return;
  }

  m.fill += amount;

  const tol = toleranceFor(m.target, MIXES[s.mix].flow, s.frame);
  if (m.fill > m.target + tol.spillOver) {
    m.spilled = true;
    registerOutcome(s, m, 'spill');
  }
}

function evaluate(s: SimState, m: Mould): void {
  const tol = toleranceFor(m.target, MIXES[s.mix].flow, s.frame);
  const delta = m.fill - m.target;

  // Order matters: the miss floor rises past the good band late in a run, so it
  // has to be checked before the softer tiers or it would never fire.
  let outcome: PourOutcome;
  if (delta < -tol.missUnder) {
    outcome = 'miss';
  } else if (delta >= -tol.perfectUnder && delta <= tol.perfectOver) {
    outcome = 'perfect';
  } else if (delta >= -tol.goodUnder && delta <= tol.goodOver) {
    outcome = 'good';
  } else {
    outcome = 'underfill';
  }

  registerOutcome(s, m, outcome);
}

function registerOutcome(s: SimState, m: Mould, outcome: PourOutcome): void {
  m.outcome = outcome;
  m.evaluated = true;

  let comboMult: number;
  if (outcome === 'perfect') {
    s.combo++;
    if (s.combo > s.maxCombo) s.maxCombo = s.combo;
    s.perfects++;
    comboMult = Math.min(s.combo, MAX_COMBO_MULT);
  } else if (outcome === 'good') {
    // Holds the combo without advancing it.
    comboMult = Math.max(1, Math.min(s.combo, MAX_COMBO_MULT));
  } else {
    s.combo = 0;
    comboMult = 1;
  }

  const points = Math.round(m.basePoints * TIER_MULT[outcome] * comboMult);
  m.awarded = points;
  s.score += points;

  if (outcome === 'perfect' || outcome === 'good' || outcome === 'underfill') {
    s.mouldsCompleted++;
  }

  s.events.push({
    frame: s.frame,
    kind: outcome === 'spill' ? 'spill' : 'outcome',
    mouldId: m.id,
    outcome,
    points,
    combo: s.combo,
  });

  if (outcome === 'spill' || outcome === 'miss') {
    s.strikes++;
    s.events.push({ frame: s.frame, kind: 'strike', mouldId: m.id });
    if (s.strikes >= MAX_STRIKES) {
      s.over = true;
      s.events.push({ frame: s.frame, kind: 'gameOver' });
    }
  }
}

function spawn(s: SimState, gap: number, progress: number): void {
  const kind = pickMould(s, progress);
  const spec = MOULDS[kind];

  s.moulds.push({
    id: s.nextMouldId++,
    kind,
    x: s.nextSpawnX,
    width: spec.width,
    height: spec.height,
    target: spec.target,
    basePoints: spec.basePoints,
    fill: 0,
    spilled: false,
    evaluated: false,
    outcome: null,
    awarded: 0,
  });

  s.nextSpawnX += spec.width + gap;
  s.spawnIndex++;

  if (s.spawnIndex % MIX_CHANGE_EVERY === 0) {
    s.pendingMix = pickMix(s, progress);
  }
}

function pickMould(s: SimState, progress: number): MouldKind {
  for (const band of MOULD_SCHEDULE) {
    if (progress < band.until) {
      const r = nextWeighted(s.rngState, band.kinds, band.weights);
      s.rngState = r.state;
      return r.value;
    }
  }
  return 'lintel';
}

function pickMix(s: SimState, progress: number): MixKind {
  for (const band of MIX_SCHEDULE) {
    if (progress < band.until) {
      const r = nextWeighted(s.rngState, band.mixes, band.weights);
      s.rngState = r.state;
      return r.value;
    }
  }
  return 'general';
}

/** Advances the simulation by exactly one logical frame. */
export function step(s: SimState): void {
  if (s.over) return;
  s.events.length = 0;

  const progress = rampProgress(s.frame);
  // Unbounded on purpose — speed never plateaus, so a run only ends when the
  // player runs out of skill, not when a timer does. See config.ts.
  const speed = SCROLL_SPEED_START + SCROLL_SPEED_PER_RAMP * unboundedProgress(s.frame);
  const gap = lerp(GAP_START, GAP_END, progress);
  const mix = MIXES[s.mix];

  // 1. Concrete emitted `tail` frames ago lands now.
  const slot = s.frame % s.delayLen;
  const arrived = s.delay[slot] ?? 0;
  if (arrived > 0) {
    s.delay[slot] = 0;
    s.inFlight -= arrived;
    if (s.inFlight < EPSILON) s.inFlight = 0;
    deliver(s, arrived);
  }

  // 2. This frame's pour enters the delay line. The gap between 1 and 2 is the
  //    tail — the reason you have to release early.
  if (s.pouring) {
    const landSlot = (s.frame + mix.tail) % s.delayLen;
    s.delay[landSlot] = (s.delay[landSlot] ?? 0) + mix.flow;
    s.inFlight += mix.flow;
  }

  // 3. A mix change waits for an idle chute, so a pour in progress is never
  //    disturbed by the flow rate changing under the player's thumb.
  if (s.pendingMix && !s.pouring && s.inFlight <= EPSILON && !mouldUnderChute(s)) {
    s.mix = s.pendingMix;
    s.pendingMix = null;
    s.events.push({ frame: s.frame, kind: 'mixChange', mix: s.mix });
  }

  // 4. Scroll.
  for (const m of s.moulds) m.x -= speed;
  s.nextSpawnX -= speed;

  // 5. Judge anything that has fully passed the chute. Feedback lands the moment
  //    the mould clears, not when it leaves the screen.
  for (const m of s.moulds) {
    if (!m.evaluated && m.x + m.width < CHUTE_X) evaluate(s, m);
  }

  // 6. Retire off-screen moulds.
  if (s.moulds.length > 0 && (s.moulds[0] as Mould).x + (s.moulds[0] as Mould).width <= -40) {
    s.moulds = s.moulds.filter((m) => m.x + m.width > -40);
  }

  // 7. Keep the track ahead of the player full.
  while (s.nextSpawnX <= WORLD_W) spawn(s, gap, progress);

  s.frame++;

  if (!s.over && s.frame >= MAX_FRAMES) {
    s.over = true;
    s.events.push({ frame: s.frame, kind: 'gameOver' });
  }
}

/**
 * Advances one frame, first applying every input event stamped for it.
 *
 * The client uses this too, feeding the same log it will later submit — so the
 * run the player sees and the run the server re-derives are the same execution.
 */
export function stepWithLog(s: SimState, log: readonly InputEvent[], cursor: { i: number }): void {
  while (cursor.i < log.length) {
    const ev = log[cursor.i];
    if (!ev || ev.frame > s.frame) break;
    setPouring(s, ev.type === 'down');
    cursor.i++;
  }
  step(s);
}

// ---------------------------------------------------------------------------
// Headless replay — this is what the server runs
// ---------------------------------------------------------------------------

export function toResult(s: SimState): SimResult {
  return {
    score: s.score,
    frames: s.frame,
    strikes: s.strikes,
    mouldsCompleted: s.mouldsCompleted,
    perfects: s.perfects,
    maxCombo: s.maxCombo,
    endedNaturally: s.strikes >= MAX_STRIKES,
  };
}

/** Replays a run from its seed and input log. Same inputs, same score, always. */
export function simulate(seed: number, log: readonly InputEvent[]): SimResult {
  const s = createState(seed);
  const cursor = { i: 0 };
  while (!s.over) stepWithLog(s, log, cursor);
  return toResult(s);
}

export interface VerifyOutcome {
  ok: boolean;
  reason?: string;
  result?: SimResult;
}

/**
 * The server-side gate. A submitted score is accepted only if replaying the
 * player's own inputs against their server-issued seed produces it exactly.
 */
export function verifyRun(
  seed: number,
  log: readonly InputEvent[],
  claimedScore: number,
): VerifyOutcome {
  const structural = validateInputLog(log);
  if (!structural.ok) return { ok: false, reason: structural.reason };

  const result = simulate(seed, log);
  if (result.score !== claimedScore) {
    return { ok: false, reason: `score mismatch: claimed ${claimedScore}, replayed ${result.score}`, result };
  }
  return { ok: true, result };
}
