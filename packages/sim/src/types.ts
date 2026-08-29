/**
 * Shared types for the Pour Line simulation. No `enum` — Node's type stripping
 * can't handle it, and the sim must run under Node, Deno and the browser alike.
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
  /** World-space width in px, which sets the dwell time. */
  width: number;
  height: number;
  /** Fill units required to reach the target line. */
  target: number;
  basePoints: number;
}

/** Judging thresholds in fill units, tightening as the run goes on. */
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
  /** Frames between leaving the chute and landing — the tail. */
  tail: number;
  /** Placeholder display label. */
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
  /** Lifetime fill units poured onto the ground. */
  wasted: number;
  /** Current unbroken run of ground-spillage; a strike when it crosses the limit. */
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
  /** Queued mix change, applied once the chute is idle. */
  pendingMix: MixKind | null;
  /** Fill units currently between the chute and the ground. */
  inFlight: number;

  /** Ring buffer: units due to land on frame `(index)` modulo its length. */
  delay: Float64Array;
  delayLen: number;

  rngState: number;

  /** Events from the most recent step; cleared at the start of each step. */
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
