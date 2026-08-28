import Phaser from 'phaser';
import {
  CHUTE_X,
  CHUTE_Y,
  GROUND_Y,
  MAX_STRIKES,
  MIXES,
  TICK_MS,
  WORLD_H,
  WORLD_W,
  createState,
  mouldUnderChute,
  stepWithLog,
  toleranceFor,
} from '@pourline/sim';
import type { InputEvent, Mould, SimState } from '@pourline/sim';
import { isDemoMode } from '../demo.ts';
import { css, theme } from '../theme/theme.ts';

/** Largest catch-up allowed after a stall, so a backgrounded tab can't fast-forward a run. */
const MAX_CATCHUP_MS = 250;

export class PlayScene extends Phaser.Scene {
  private state!: SimState;
  private log!: InputEvent[];
  private cursor!: { i: number };
  private seed = 1;
  /** Snapshot at run start so a mid-run localStorage change can't retag a run. */
  private demo = false;

  private acc = 0;
  /** Frames of deliberate freeze after a spill. Sells the mistake. */
  private hitch = 0;
  /** Touches currently down. A second finger must not cancel the pour. */
  private touches = 0;

  private g!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private mixText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  init(data: { seed?: number; demo?: boolean }): void {
    // In the real game this seed arrives inside a signed, server-issued play
    // token. Until then it is random per run, which is fine for tuning.
    this.seed = data.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.demo = data.demo ?? isDemoMode();
    this.state = createState(this.seed);
    this.log = [];
    this.cursor = { i: 0 };
    this.acc = 0;
    this.hitch = 0;
    this.touches = 0;
  }

  create(): void {
    const c = theme.colors;
    this.cameras.main.setBackgroundColor(c.bg);

    this.g = this.add.graphics();

    this.scoreText = this.add
      .text(24, 28, '0', {
        fontFamily: theme.fonts.display,
        fontSize: '54px',
        color: css(c.text),
        letterSpacing: 1,
      })
      .setOrigin(0, 0);

    this.comboText = this.add
      .text(24, 90, '', {
        fontFamily: theme.fonts.display,
        fontSize: '26px',
        fontStyle: 'bold',
        color: css(c.accent),
        letterSpacing: 2,
      })
      .setOrigin(0, 0);

    // Mix name as a wide-spaced eyebrow, echoing the letter-spaced ARPS tagline.
    // Sits just above the chute funnel and below the combo row so the two never
    // collide when a combo is running.
    this.mixText = this.add
      .text(WORLD_W / 2, CHUTE_Y - 86, '', {
        fontFamily: theme.fonts.body,
        fontSize: '20px',
        color: css(c.textDim),
        letterSpacing: 4,
      })
      .setOrigin(0.5, 0);

    this.hintText = this.add
      .text(WORLD_W / 2, GROUND_Y + 70, 'HOLD TO POUR — release early', {
        fontFamily: theme.fonts.body,
        fontSize: '24px',
        color: css(c.textDim),
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);

    // Visible on every frame of a demo run, not just the results screen — a
    // showcase run must never be mistaken for a real competitive entry by
    // whoever is watching over the demoing staff member's shoulder.
    if (this.demo) {
      this.add
        .text(WORLD_W / 2, 8, 'DEMO MODE — SCORE NOT SAVED', {
          fontFamily: theme.fonts.body,
          fontSize: '16px',
          fontStyle: 'bold',
          color: css(c.onAccent),
          backgroundColor: css(c.accent),
          letterSpacing: 1.5,
          padding: { x: 11, y: 5 },
        })
        .setOrigin(0.5, 0);
    }

    // Multiple pointers, because people rest a second thumb on the screen and
    // a naive pointerup handler would read that as a release.
    this.input.addPointer(2);
    this.input.on('pointerdown', () => {
      this.touches++;
      this.setPour(true);
    });
    const release = () => {
      this.touches = Math.max(0, this.touches - 1);
      if (this.touches === 0) this.setPour(false);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => {
      this.touches = 0;
      this.setPour(false);
    });

    // A phone that locks, or a notification that steals focus, takes the finger
    // off the glass without ever firing pointerup. Without this the sim resumes
    // still pouring and instantly spills a mould the player never touched.
    const onHide = () => {
      if (document.hidden) {
        this.touches = 0;
        this.setPour(false);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHide);
    });

    // Desktop convenience while tuning. Never the primary input.
    const space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    space?.on('down', () => this.setPour(true));
    space?.on('up', () => this.setPour(false));
  }

  /**
   * Records the transition and lets the sim consume it on the next frame.
   *
   * The client never sets `pouring` directly — it appends to the same log it
   * will later submit, and the sim reads it. That means the run the player sees
   * is literally the run the server will replay, not a parallel implementation
   * that happens to agree.
   */
  private setPour(down: boolean): void {
    if (this.state.over) return;
    const last = this.log[this.log.length - 1];
    if (last && last.type === (down ? 'down' : 'up')) return;
    this.log.push({ frame: this.state.frame, type: down ? 'down' : 'up' });
  }

  override update(_time: number, delta: number): void {
    if (this.state.over) return;

    if (this.hitch > 0) {
      this.hitch--;
      this.draw();
      return;
    }

    this.acc = Math.min(this.acc + delta, MAX_CATCHUP_MS);

    while (this.acc >= TICK_MS && !this.state.over && this.hitch === 0) {
      stepWithLog(this.state, this.log, this.cursor);
      this.consumeEvents();
      this.acc -= TICK_MS;
    }

    this.draw();

    if (this.state.over) {
      this.time.delayedCall(600, () => {
        this.scene.start('Results', {
          state: this.state,
          log: this.log,
          seed: this.seed,
          demo: this.demo,
        });
      });
    }
  }

  /**
   * Dev-only: advance the simulation without waiting on requestAnimationFrame,
   * so the game can be driven and screenshotted in a headless browser where the
   * tab is backgrounded and rAF is throttled to a standstill.
   */
  debugAdvance(frames: number, pouring?: boolean): void {
    if (pouring !== undefined) this.setPour(pouring);
    for (let i = 0; i < frames && !this.state.over; i++) {
      stepWithLog(this.state, this.log, this.cursor);
      this.consumeEvents();
    }
    this.draw();
  }

  /** Dev-only: a snapshot of what the sim thinks is happening. */
  debugState(): Record<string, unknown> {
    const m = mouldUnderChute(this.state);
    return {
      frame: this.state.frame,
      score: this.state.score,
      strikes: this.state.strikes,
      combo: this.state.combo,
      pouring: this.state.pouring,
      inFlight: Number(this.state.inFlight.toFixed(2)),
      mix: this.state.mix,
      moulds: this.state.moulds.length,
      underChute: m ? { kind: m.kind, fill: Number(m.fill.toFixed(1)), target: m.target } : null,
      over: this.state.over,
    };
  }

  private consumeEvents(): void {
    for (const ev of this.state.events) {
      if (ev.kind === 'spill') {
        this.cameras.main.shake(200, 0.014);
        this.hitch = 5;
        this.popText(ev.mouldId, 'SPILL', theme.colors.danger);
      } else if (ev.kind === 'outcome') {
        if (ev.outcome === 'perfect') {
          this.cameras.main.flash(90, 60, 220, 130, false);
          this.popText(ev.mouldId, `PERFECT +${ev.points}`, theme.colors.perfectBand);
        } else if (ev.outcome === 'good') {
          this.popText(ev.mouldId, `+${ev.points}`, theme.colors.text);
        } else if (ev.outcome === 'underfill') {
          this.popText(ev.mouldId, 'SHORT', theme.colors.textDim);
        } else if (ev.outcome === 'miss') {
          this.cameras.main.shake(160, 0.01);
          this.popText(ev.mouldId, 'MISSED', theme.colors.danger);
        }
      } else if (ev.kind === 'mixChange') {
        this.mixText.setAlpha(0);
        this.tweens.add({ targets: this.mixText, alpha: 1, duration: 260 });
      }
    }
  }

  private popText(mouldId: number | undefined, label: string, color: number): void {
    const m = this.state.moulds.find((x) => x.id === mouldId);
    const x = m ? m.x + m.width / 2 : CHUTE_X;
    const y = m ? GROUND_Y - m.height - 30 : GROUND_Y - 120;

    const t = this.add
      .text(x, y, label, {
        fontFamily: theme.fonts.display,
        fontSize: '28px',
        fontStyle: 'bold',
        color: css(color),
        letterSpacing: 1,
      })
      .setOrigin(0.5, 1);

    this.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private draw(): void {
    const s = this.state;
    const c = theme.colors;
    this.g.clear();

    this.g.fillStyle(c.ground, 1);
    this.g.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
    this.g.fillStyle(c.groundLine, 1);
    this.g.fillRect(0, GROUND_Y - 2, WORLD_W, 2);

    for (const m of s.moulds) this.drawMould(m);

    this.drawChute();
    this.drawPour();
    this.drawStrikes();

    this.scoreText.setText(s.score.toLocaleString('en-ZA'));
    this.comboText.setText(s.combo > 1 ? `x${Math.min(s.combo, 8)} COMBO` : '');
    this.mixText.setText(theme.productNames[s.mix].toUpperCase());

    if (s.frame > 240) this.hintText.setAlpha(0);
  }

  private drawMould(m: Mould): void {
    const s = this.state;
    const c = theme.colors;

    // Bands come straight from the sim, so what the player aims at is exactly
    // what gets scored. There is no second copy of these numbers.
    const tol = toleranceFor(m.target, MIXES[s.mix].flow, s.frame);
    const brimUnits = m.target + tol.spillOver;
    const top = GROUND_Y - m.height;
    const u = m.height / Math.max(brimUnits, 1);

    this.g.fillStyle(c.bgAccent, 1);
    this.g.fillRect(m.x, top, m.width, m.height);

    // Formwork walls sit proud of the mould, so the shape reads as a container.
    this.g.fillStyle(c.formworkDim, 1);
    this.g.fillRect(m.x - 7, top - 4, 7, m.height + 4);
    this.g.fillRect(m.x + m.width, top - 4, 7, m.height + 4);

    // The perfect band is the single most important thing on screen — it is the
    // affordance that tells a stranger where to stop. It has to survive expo
    // lighting and a phone on low brightness, so it is drawn as a filled zone
    // with hard edges rather than a faint tint.
    if (!m.evaluated) {
      const bandLo = GROUND_Y - Math.max(m.target - tol.perfectUnder, 0) * u;
      const bandHi = GROUND_Y - (m.target + tol.perfectOver) * u;
      this.g.fillStyle(c.perfectBand, 0.3);
      this.g.fillRect(m.x, bandHi, m.width, bandLo - bandHi);
      this.g.fillStyle(c.perfectBand, 0.85);
      this.g.fillRect(m.x, bandHi, m.width, 1.5);
      this.g.fillRect(m.x, bandLo - 1.5, m.width, 1.5);
    }

    const fillUnits = Math.min(m.fill, brimUnits);
    const fh = fillUnits * u;
    if (fh > 0) {
      this.g.fillStyle(m.spilled ? c.danger : c.concrete, 1);
      this.g.fillRect(m.x, GROUND_Y - fh, m.width, fh);
      // Wet surface, so a filling mould reads as moving rather than static.
      this.g.fillStyle(c.concreteWet, 1);
      this.g.fillRect(m.x, GROUND_Y - fh, m.width, 3);
    }

    const ty = GROUND_Y - m.target * u;
    this.g.fillStyle(c.targetLine, 1);
    this.g.fillRect(m.x - 10, ty - 1.5, m.width + 20, 3);

    this.g.lineStyle(2, m.evaluated ? c.formworkDim : c.formwork, 1);
    this.g.strokeRect(m.x, top, m.width, m.height);
  }

  private drawChute(): void {
    const c = theme.colors;
    const active = mouldUnderChute(this.state) !== null;

    this.g.fillStyle(c.chute, 1);
    this.g.fillPoints(
      [
        new Phaser.Geom.Point(CHUTE_X - 74, CHUTE_Y - 66),
        new Phaser.Geom.Point(CHUTE_X + 74, CHUTE_Y - 66),
        new Phaser.Geom.Point(CHUTE_X + 17, CHUTE_Y),
        new Phaser.Geom.Point(CHUTE_X - 17, CHUTE_Y),
      ],
      true,
    );

    this.g.fillStyle(active ? c.accent : c.chuteMouth, 1);
    this.g.fillRect(CHUTE_X - 19, CHUTE_Y - 5, 38, 7);

    // Guide line to the landing point. Without it the chute reads as floating
    // and players struggle to connect the pour to the mould underneath.
    this.g.lineStyle(1, c.groundLine, 0.5);
    this.g.lineBetween(CHUTE_X, CHUTE_Y, CHUTE_X, GROUND_Y);
  }

  /**
   * The tail, made visible.
   *
   * While pouring, a full column. After release, the column's top descends over
   * exactly `tail` frames — the same frames the sim will keep delivering for.
   * If a player can't see why they overfilled, the mechanic reads as random.
   */
  private drawPour(): void {
    const s = this.state;
    const c = theme.colors;
    const tail = MIXES[s.mix].tail;
    const w = 34;

    let topY: number | null = null;
    if (s.pouring) {
      topY = CHUTE_Y;
    } else if (s.inFlight > 1e-9 && s.releaseFrame !== null) {
      const t = Math.min(Math.max((s.frame - s.releaseFrame) / tail, 0), 1);
      topY = CHUTE_Y + t * (GROUND_Y - CHUTE_Y);
    }
    if (topY === null) return;

    // The column lands on the concrete surface rather than punching through to
    // the ground. Drawing it full height would cover the fill level — the one
    // thing the player has to read to time the release.
    const landingY = this.surfaceUnderChute();
    if (topY >= landingY) return;

    this.g.fillStyle(c.concreteWet, 0.95);
    this.g.fillRect(CHUTE_X - w / 2, topY, w, landingY - topY);

    // Impact splash, so the landing point reads even on a nearly full mould.
    this.g.fillStyle(c.concreteWet, 0.5);
    this.g.fillRect(CHUTE_X - w / 2 - 9, landingY - 4, w + 18, 5);
  }

  /** Y of whatever the falling concrete is about to hit. */
  private surfaceUnderChute(): number {
    const m = mouldUnderChute(this.state);
    if (!m) return GROUND_Y;

    const tol = toleranceFor(m.target, MIXES[this.state.mix].flow, this.state.frame);
    const brimUnits = m.target + tol.spillOver;
    const u = m.height / Math.max(brimUnits, 1);
    return GROUND_Y - Math.min(m.fill, brimUnits) * u;
  }

  private drawStrikes(): void {
    const c = theme.colors;
    const size = 26;
    const gap = 12;
    const right = WORLD_W - 24;

    for (let i = 0; i < MAX_STRIKES; i++) {
      const x = right - (MAX_STRIKES - i) * (size + gap) + gap;
      const lost = i < this.state.strikes;
      this.g.fillStyle(lost ? c.danger : c.formworkDim, lost ? 1 : 0.5);
      this.g.fillRect(x, 34, size, size);
    }
  }
}
