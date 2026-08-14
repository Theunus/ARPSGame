/**
 * Every tuning number in the game lives here.
 *
 * These are a considered first pass, not final values. The pour has to be tuned
 * against real thumbs — see docs/TUNING.md. Nothing outside this file should
 * contain a magic number that affects gameplay.
 */

import type { MixKind, MixSpec, MouldKind, MouldSpec, PourOutcome } from './types.ts';

// ---------------------------------------------------------------------------
// Timing and world
// ---------------------------------------------------------------------------

/** Logical ticks per second. The sim never sees a variable delta. */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Portrait design resolution. The renderer scales this to fit the device. */
export const WORLD_W = 540;
export const WORLD_H = 960;

/** The chute is fixed. Moulds come to the player. */
export const CHUTE_X = 270;
export const CHUTE_Y = 210;
/** Y of the ground line the moulds sit on. */
export const GROUND_Y = 800;

/** Safety cap so a malicious input log cannot pin a server CPU. 5 minutes. */
export const MAX_FRAMES = TICK_HZ * 60 * 5;
/** A legitimate run cannot plausibly contain more transitions than this. */
export const MAX_INPUT_EVENTS = 2000;

export const MAX_STRIKES = 3;

// ---------------------------------------------------------------------------
// Difficulty ramp
// ---------------------------------------------------------------------------

/** Frames to reach full difficulty. Expert runs then sit at max for their last stretch. */
export const RAMP_FRAMES = TICK_HZ * 60;

export const SCROLL_SPEED_START = 1.8;
export const SCROLL_SPEED_END = 2.7;

/** Gap between moulds in px, shrinking as the run progresses. */
export const GAP_START = 150;
export const GAP_END = 70;

/**
 * The perfect band is defined as a *time* window, not a fraction of the mould.
 * Human release precision is measured in frames, so tuning in frames is the only
 * way to keep small moulds fair. Band in fill units = flow * window.
 */
export const PERFECT_WINDOW_START = 7;
export const PERFECT_WINDOW_END = 3;
/** The good band is a multiple of the perfect window. */
export const GOOD_WINDOW_MULT = 3;

/**
 * The survivable window closes from both sides as the run goes on: the brim
 * drops toward the target line, and the minimum acceptable fill rises toward it.
 *
 * This — not scroll speed — is what guarantees a run ends. Speed alone cannot
 * kill an accurate player, because pouring slightly short never costs a strike;
 * they would simply underfill forever. A closing tolerance means any player with
 * a fixed precision eventually runs out of room, and the window reaches zero
 * around the 85-second mark, which is the queue guarantee the event needs.
 *
 * Both ramp past progress 1.0 deliberately. Do not clamp them.
 */
export const SPILL_MARGIN_START = 0.28;
export const SPILL_MARGIN_SLOPE = 0.2;

export const MISS_FLOOR_START = 0.45;
export const MISS_FLOOR_SLOPE = 0.4;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const TIER_MULT: Record<PourOutcome, number> = {
  perfect: 1.0,
  good: 0.45,
  underfill: 0.1,
  miss: 0,
  spill: 0,
};

export const MAX_COMBO_MULT = 8;

/**
 * The perfect band is asymmetric: the tolerance above the target line is half
 * that below it. Without this, the band's upper edge sits close enough to the
 * brim that "pour until it nearly spills" becomes a reliable way to score
 * perfect, which would delete the precision the whole game is built on.
 */
export const OVER_BAND_MULT = 0.5;

// ---------------------------------------------------------------------------
// Moulds
// ---------------------------------------------------------------------------

/**
 * `height` is purely cosmetic — it maps fill units to pixels and never enters
 * the simulation. Taller moulds simply give the player more vertical resolution
 * to read the fill against the target line.
 *
 * Dwell time under the chute is width / scrollSpeed. Fill time is target / flow.
 * Every mould is tuned so dwell comfortably exceeds fill time even at the fastest
 * scroll speed, otherwise the mould becomes literally impossible rather than hard.
 */
export const MOULDS: Record<MouldKind, MouldSpec> = {
  slab: {
    kind: 'slab',
    width: 220,
    height: 88,
    target: 60,
    basePoints: 100,
  },
  lintel: {
    kind: 'lintel',
    width: 150,
    height: 108,
    target: 41,
    basePoints: 150,
  },
  // Narrow and quick to fill, so the tail is a large fraction of the target.
  // This is the mould that separates good players from lucky ones.
  column: {
    kind: 'column',
    width: 80,
    height: 158,
    target: 22,
    basePoints: 260,
  },
  // Long pour. Tests holding steady rather than reacting.
  foundation: {
    kind: 'foundation',
    width: 300,
    height: 78,
    target: 82,
    basePoints: 190,
  },
};

// ---------------------------------------------------------------------------
// Mixes
// ---------------------------------------------------------------------------

/**
 * Labels are placeholders. Real ARPS product names drop in through the theme
 * layer once the brand pack lands — see apps/game/src/theme.
 *
 * Mixes are ordered easy to hard. Flow rates stay in a narrow band because the
 * slowest mix has to remain fillable at the fastest scroll speed; the interesting
 * axis is the tail, not the flow.
 */
export const MIXES: Record<MixKind, MixSpec> = {
  mortar: { kind: 'mortar', flow: 0.75, tail: 3, label: 'Mortar Mix' },
  highStrength: { kind: 'highStrength', flow: 0.85, tail: 5, label: 'High-Strength' },
  general: { kind: 'general', flow: 1.0, tail: 8, label: 'General Purpose' },
  screed: { kind: 'screed', flow: 1.35, tail: 11, label: 'Screed' },
};

/** Ring buffer size for the delay line. Must exceed the longest tail. */
export const MAX_TAIL = 16;

/**
 * Which mixes can appear, by ramp progress.
 *
 * Deliberately back-loaded: the fast-flowing, long-tailed mixes arrive late, so
 * late game means maximum overshoot pressure. It also keeps the slow mixes away
 * from the fastest scroll speeds, where they would be unfillable.
 */
export const MIX_SCHEDULE: ReadonlyArray<{
  until: number;
  mixes: readonly MixKind[];
  weights: readonly number[];
}> = [
  { until: 0.15, mixes: ['mortar', 'highStrength'], weights: [3, 1] },
  { until: 0.45, mixes: ['highStrength', 'general'], weights: [2, 2] },
  { until: 0.75, mixes: ['general', 'screed'], weights: [3, 2] },
  { until: 1.01, mixes: ['general', 'screed'], weights: [2, 3] },
];

/** How many moulds pass between chute mix changes. Changes are telegraphed. */
export const MIX_CHANGE_EVERY = 4;

/**
 * Mould mix by ramp progress. Columns ramp up, slabs ramp down, so the run gets
 * narrower and more punishing rather than just faster.
 */
export const MOULD_SCHEDULE: ReadonlyArray<{
  until: number;
  kinds: readonly MouldKind[];
  weights: readonly number[];
}> = [
  { until: 0.2, kinds: ['slab', 'lintel'], weights: [3, 2] },
  { until: 0.5, kinds: ['slab', 'lintel', 'column', 'foundation'], weights: [3, 4, 1, 1] },
  { until: 0.8, kinds: ['slab', 'lintel', 'column', 'foundation'], weights: [2, 4, 3, 1] },
  { until: 1.01, kinds: ['slab', 'lintel', 'column', 'foundation'], weights: [1, 3, 4, 1] },
];
