import Phaser from 'phaser';
import {
  CHUTE_X,
  CHUTE_Y,
  GROUND_SPILL_LIMIT,
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
import { nextToken } from '../session.ts';
import { css, theme } from '../theme/theme.ts';

/** Largest catch-up allowed after a stall, so a backgrounded tab can't fast-forward a run. */
const MAX_CATCHUP_MS = 250;

export class PlayScene extends Phaser.Scene {
  private state!: SimState;
  private log!: InputEvent[];
  private cursor!: { i: number };
  private seed = 1;
  private demo = false;
  /** Server-issued play token for this run, or null in demo mode. */
  private token: string | null = null;

  private acc = 0;
  /** Frames of deliberate freeze after a spill, to sell the mistake. */
  private hitch = 0;
  /** Touches currently down, so a second finger doesn't cancel the pour. */
  private touches = 0;

  private g!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private mixText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super('Play');
  }

  init(data: { demo?: boolean } = {}): void {
    this.demo = data.demo ?? isDemoMode();

    if (this.demo) {
      this.seed = Math.floor(Math.random() * 2 ** 31);
      this.token = null;
    } else {
      const t = nextToken();
      this.seed = t?.seed ?? 0;
      this.token = t?.token ?? null;
    }

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

    // Track multiple pointers so a resting second thumb isn't read as a release.
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

    // A phone lock or notification steals focus without firing pointerup;
    // stop pouring so the sim doesn't spill a mould the player never touched.
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

    // Desktop tuning convenience, never the primary input.
    const space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    space?.on('down', () => this.setPour(true));
    space?.on('up', () => this.setPour(false));
  }

  /** Records a pour transition into the input log the sim reads and the server replays. */
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
          token: this.token,
        });
      });
    }
  }

  /** Dev-only: advance the sim without rAF, for headless/automated driving. */
  debugAdvance(frames: number, pouring?: boolean): void {
    if (pouring !== undefined) this.setPour(pouring);
    for (let i = 0; i < frames && !this.state.over; i++) {
      stepWithLog(this.state, this.log, this.cursor);
      this.consumeEvents();
    }
    this.draw();
  }

  /** Dev-only: a snapshot of the sim state. */
  debugState(): Record<string, unknown> {
    const m = mouldUnderChute(this.state);
    return {
      frame: this.state.frame,
      score: this.state.score,
      strikes: this.state.strikes,
      combo: this.state.combo,
      pouring: this.state.pouring,
      inFlight: Number(this.state.inFlight.toFixed(2)),
      groundSpill: Number(this.state.groundSpill.toFixed(2)),
      mix: this.state.mix,
      moulds: this.state.moulds.length,
      underChute: m ? { kind: m.kind, fill: Number(m.fill.toFixed(1)), target: m.target } : null,
      over: this.state.over,
      demo: this.demo,
      hasToken: this.token !== null,
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

  private draw(): void {
    const s = this.state;
    const c = theme.colors;
    this.g.clear();

    this.g.fillStyle(c.ground, 1);
    this.g.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
    this.g.fillStyle(c.groundLine, 1);
    this.g.fillRect(0, GROUND_Y - 2, WORLD_W, 2);

    this.drawGroundPuddle();
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

    // Bands come from the sim, so the player aims at exactly what gets scored.
    const tol = toleranceFor(m.target, MIXES[s.mix].flow, s.frame);
    const brimUnits = m.target + tol.spillOver;
    const top = GROUND_Y - m.height;
    const u = m.height / Math.max(brimUnits, 1);

    this.g.fillStyle(c.bgAccent, 1);
    this.g.fillRect(m.x, top, m.width, m.height);

    // Formwork walls proud of the mould, so the shape reads as a container.
    this.g.fillStyle(c.formworkDim, 1);
    this.g.fillRect(m.x - 7, top - 4, 7, m.height + 4);
    this.g.fillRect(m.x + m.width, top - 4, 7, m.height + 4);

    // The perfect band — a filled zone with hard edges so it survives bright light.
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
      this.g.fillStyle(c.concreteWet, 1);
      this.g.fillRect(m.x, GROUND_Y - fh, m.width, 3);
    }

    const ty = GROUND_Y - m.target * u;
    this.g.fillStyle(c.targetLine, 1);
    this.g.fillRect(m.x - 10, ty - 1.5, m.width + 20, 3);

    this.g.lineStyle(2, m.evaluated ? c.formworkDim : c.formwork, 1);
    this.g.strokeRect(m.x, top, m.width, m.height);
  }

  /** A puddle at the chute base that grows and reddens as ground-spillage nears a strike. */
  private drawGroundPuddle(): void {
    const s = this.state;
    if (s.groundSpill <= 0) return;
    const c = theme.colors;

    const t = Math.min(s.groundSpill / GROUND_SPILL_LIMIT, 1);
    const w = 34 + t * 150;
    const color = t > 0.6 ? c.danger : c.formworkDim;
    this.g.fillStyle(color, 0.45 + t * 0.4);
    this.g.fillEllipse(CHUTE_X, GROUND_Y + 4, w, 18);
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

    // Guide line connecting the chute to its landing point.
    this.g.lineStyle(1, c.groundLine, 0.5);
    this.g.lineBetween(CHUTE_X, CHUTE_Y, CHUTE_X, GROUND_Y);
  }

  /** The falling column — full while pouring, descending over `tail` frames after release. */
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

    // Land on the concrete surface, not the ground, so the fill level stays visible.
    const landingY = this.surfaceUnderChute();
    if (topY >= landingY) return;

    this.g.fillStyle(c.concreteWet, 0.95);
    this.g.fillRect(CHUTE_X - w / 2, topY, w, landingY - topY);

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
