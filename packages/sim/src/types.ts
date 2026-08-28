/**
 * Shared types for the Pour Line simulation.
 *
 * Deliberately no `enum` anywhere in this package — Node's native type stripping
 * cannot handle enums, and the sim must run unmodified under Node, Deno and the
 * browser. Const objects plus union types give the same ergonomics.
 */

export type InputEventType = 'down' | 'up';

/** A single touch transition, stamped with the logical frame it occurred on. */
export interface InputEvent {
  frame: number;
  type: InputEventType;
}

export type MouldKind = 'slab' | 'lintel' | 'column' | 'foundation';

export type MixKind = 'mortar' | 'highStrength' | 'general' | 'screed';

/**
 * How a mould was judged when it passed the chute.
 * `miss` means it left badly underfilled — including never poured into at all.
 */
export type PourOutcome = 'perfect' | 'good' | 'underfill' | 'miss' | 'spill';

export interface MouldSpec {
  kind: MouldKind;
  /** World-space width in px. Together with scroll speed this sets the dwell time. */
  width: number;
  height: number;
  /** Fill units required to reach the target line. */
  target: number;
  basePoints: number;
}

/**
 * The judging thresholds in force at a given moment, in fill units.
 * Derived from ramp progress, so they tighten as the run goes on.
 * The renderer draws its bands from exactly these numbers.
 */
export interface Tolerance {
  /** Fill above target at which concrete goes over the brim. */
  spillOver: number;
  /** Fill below target under which the mould counts as a miss. */
  missUnder: number;
  perfectUnder: number;
  perfectOver: number;
  goodUnder: number;
  goodOver: number;
}

export interface MixSpec {
  kind: MixKind;
  /** Fill units emitted per frame while pouring. */
  flow: number;
  /**
   * Frames between leaving the chute and landing in the mould.
   * This is the tail — the whole skill ceiling of the game lives here.
   */
  tail: number;
  /** Display label. Replaced with real ARPS product names via the theme layer. */
  label: string;
}

/** A mould instance in flight through the world. */
export interface Mould {
  id: number;
  kind: MouldKind;
  x: number;
  width: number;
  height: number;
  target: number;
  basePoints: number;
  fill: number;
  spilled: boolean;
  evaluated: boolean;
  outcome: PourOutcome | null;
  /** Points awarded, for the floating score popup. */
  awarded: number;
}

/** Emitted for one frame only, so the renderer can react without polling state. */
export interface SimEvent {
  frame: number;
  kind: 'outcome' | 'spill' | 'strike' | 'mixChange' | 'gameOver';
  mouldId?: number;
  outcome?: PourOutcome;
  points?: number;
  combo?: number;
  mix?: MixKind;
}

export interface SimState {
  frame: number;
  score: number;
  strikes: number;
  /** Consecutive perfects. Drives the multiplier. */
  combo: number;
  maxCombo: number;
  mouldsCompleted: number;
  perfects: number;
  /** Fill units poured onto the ground with no mould under the chute (lifetime). */
  wasted: number;
  /**
   * Fill units of the *current* run of ground-spillage — concrete landing with
   * no mould under the chute. Resets when concrete next lands in a mould, and
   * when it crosses GROUND_SPILL_LIMIT it costs a strike. Drives the puddle.
   */
  groundSpill: number;
  over: boolean;

  pouring: boolean;
  /** Frame the player last released, or null if never / currently pouring. */
  releaseFrame: number | null;

  moulds: Mould[];
  nextMouldId: number;
  nextSpawnX: number;
  spawnIndex: number;

  mix: MixKind;
  /** Queued mix change, applied once the chute is idle so a live pour is never disturbed. */
  pendingMix: MixKind | null;
  /** Fill units currently between the chute and the ground. Renderer uses this. */
  inFlight: number;

  /** Ring buffer: units due to land on frame `(index)` modulo its length. */
  delay: Float64Array;
  delayLen: number;

  rngState: number;

  /** Cleared at the start of every step. Read it after stepping. */
  events: SimEvent[];
}

export interface SimResult {
  score: number;
  frames: number;
  strikes: number;
  mouldsCompleted: number;
  perfects: number;
  maxCombo: number;
  /** False when the run hit the safety frame cap rather than three strikes. */
  endedNaturally: boolean;
}
