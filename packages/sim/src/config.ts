/** Every gameplay tuning number. Nothing outside this file affects the sim. */

import type { MixKind, MixSpec, MouldKind, MouldSpec, PourOutcome } from './types.ts';

// Timing and world ----------------------------------------------------------

/** Logical ticks per second (fixed timestep). */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Portrait design resolution, scaled to fit the device. */
export const WORLD_W = 540;
export const WORLD_H = 960;

/** The chute is fixed; moulds scroll to it. */
export const CHUTE_X = 270;
export const CHUTE_Y = 210;
/** Y of the ground line the moulds sit on. */
export const GROUND_Y = 800;

/** Safety cap so a malicious input log can't pin a server CPU (5 minutes). */
export const MAX_FRAMES = TICK_HZ * 60 * 5;
export const MAX_INPUT_EVENTS = 2000;

export const MAX_STRIKES = 3;

/** Fill units pourable onto the ground before it costs a strike. */
export const GROUND_SPILL_LIMIT = 12;

// Difficulty ramp -----------------------------------------------------------

/** Reference period for the ramps; most reach full difficulty here and hold. */
export const RAMP_FRAMES = TICK_HZ * 60;

export const SCROLL_SPEED_START = 1.8;
/** Speed gained per RAMP_FRAMES, unbounded — the line never stops accelerating. */
export const SCROLL_SPEED_PER_RAMP = 0.75;

/** Gap between moulds in px, clamped (unlike speed). */
export const GAP_START = 150;
export const GAP_END = 70;

/** Perfect band, as a time window in frames (band in fill units = flow * window). */
export const PERFECT_WINDOW_START = 7;
export const PERFECT_WINDOW_END = 3;
/** The good band is a multiple of the perfect window. */
export const GOOD_WINDOW_MULT = 3;

/**
 * The survivable window closes from both sides over a run: the spill brim drops
 * toward the target and the miss floor rises toward it. Uncapped by design —
 * this, not speed, is what guarantees an accurate player eventually runs out.
 */
export const SPILL_MARGIN_START = 0.28;
export const SPILL_MARGIN_SLOPE = 0.2;

export const MISS_FLOOR_START = 0.45;
export const MISS_FLOOR_SLOPE = 0.4;

// Scoring -------------------------------------------------------------------

export const TIER_MULT: Record<PourOutcome, number> = {
  perfect: 1.0,
  good: 0.45,
  underfill: 0.1,
  miss: 0,
  spill: 0,
};

export const MAX_COMBO_MULT = 8;

/** Tolerance above the target line is half that below, so "pour to the brim" can't fake a perfect. */
export const OVER_BAND_MULT = 0.5;

// Moulds --------------------------------------------------------------------
// `height` is purely cosmetic (fill-to-pixel mapping); it never enters the sim.

export const MOULDS: Record<MouldKind, MouldSpec> = {
  slab: { kind: 'slab', width: 220, height: 88, target: 60, basePoints: 100 },
  lintel: { kind: 'lintel', width: 150, height: 108, target: 41, basePoints: 150 },
  column: { kind: 'column', width: 80, height: 158, target: 22, basePoints: 260 },
  foundation: { kind: 'foundation', width: 300, height: 78, target: 82, basePoints: 190 },
};

// Mixes ---------------------------------------------------------------------
// Labels are placeholders, replaced with real product names via the theme.

export const MIXES: Record<MixKind, MixSpec> = {
  mortar: { kind: 'mortar', flow: 0.75, tail: 3, label: 'Mortar Mix' },
  highStrength: { kind: 'highStrength', flow: 0.85, tail: 5, label: 'High-Strength' },
  general: { kind: 'general', flow: 1.0, tail: 8, label: 'General Purpose' },
  screed: { kind: 'screed', flow: 1.35, tail: 11, label: 'Screed' },
};

/** Delay-line ring buffer size; must exceed the longest tail. */
export const MAX_TAIL = 16;

/** Which mixes can appear by ramp progress — back-loaded toward the long-tailed ones. */
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

/** Moulds between chute mix changes. */
export const MIX_CHANGE_EVERY = 4;

/** Which moulds appear by ramp progress — columns ramp up, slabs ramp down. */
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
