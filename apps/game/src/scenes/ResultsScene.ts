import Phaser from 'phaser';
import { TICK_HZ, WORLD_H, WORLD_W, toResult, verifyRun } from '@pourline/sim';
import type { InputEvent, SimState } from '@pourline/sim';
import { css, theme } from '../theme/theme.ts';

interface ResultsData {
  state: SimState;
  log: InputEvent[];
  seed: number;
  demo: boolean;
}

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    const c = theme.colors;
    const result = toResult(data.state);
    this.cameras.main.setBackgroundColor(c.bg);

    this.drawBrandTriangles();

    let y = 96;

    // ARPS brand eyebrow — widely spaced caps in hazard orange, echoing the
    // logo's letter-spaced lockup.
    if (theme.brand) {
      this.add
        .text(WORLD_W / 2, y, theme.brand, {
          fontFamily: theme.fonts.display,
          fontSize: '20px',
          fontStyle: 'bold',
          color: css(c.accent),
          letterSpacing: 9,
        })
        .setOrigin(0.5);
      y += 42;
    }

    if (data.demo) {
      this.add
        .text(WORLD_W / 2, y, 'DEMO RUN — NOT SAVED', {
          fontFamily: theme.fonts.body,
          fontSize: '18px',
          fontStyle: 'bold',
          color: css(c.onAccent),
          backgroundColor: css(c.accent),
          letterSpacing: 1.5,
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5);
      y += 56;
    }

    this.add
      .text(WORLD_W / 2, y, 'POUR COMPLETE', {
        fontFamily: theme.fonts.body,
        fontSize: '26px',
        color: css(c.textDim),
        letterSpacing: 5,
      })
      .setOrigin(0.5);
    y += 72;

    this.add
      .text(WORLD_W / 2, y, result.score.toLocaleString('en-ZA'), {
        fontFamily: theme.fonts.display,
        fontSize: '94px',
        fontStyle: 'bold',
        color: css(c.text),
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    y += 74;

    // The brand's underline motif — the orange rule beneath the ARPS wordmark.
    this.add.rectangle(WORLD_W / 2, y, 88, 4, c.accent);
    y += 44;

    const rows: Array<[string, string]> = [
      ['Moulds placed', String(result.mouldsCompleted)],
      ['Perfect pours', String(result.perfects)],
      ['Best combo', `x${Math.min(result.maxCombo, 8)}`],
      ['Time on the line', `${(result.frames / TICK_HZ).toFixed(1)}s`],
    ];

    for (const [label, value] of rows) {
      this.add
        .text(80, y, label, { fontFamily: theme.fonts.body, fontSize: '26px', color: css(c.textDim) })
        .setOrigin(0, 0.5);
      this.add
        .text(WORLD_W - 80, y, value, {
          fontFamily: theme.fonts.display,
          fontSize: '26px',
          color: css(c.text),
          letterSpacing: 0.5,
        })
        .setOrigin(1, 0.5);
      y += 46;
    }

    this.drawReplayCheck(data, result.score, y + 28);
    this.addPlayAgain(data.demo);
  }

  /**
   * Faint corner triangles echoing the ARPS logo's geometric motif. Low alpha
   * and pushed into the extreme corners so they read as brand texture behind
   * the layout, never competing with the score or the button.
   */
  private drawBrandTriangles(): void {
    const c = theme.colors;
    const g = this.add.graphics();

    const tri = (px: number, py: number, size: number, color: number, alpha: number, corner: 'tl' | 'br') => {
      g.fillStyle(color, alpha);
      const pts =
        corner === 'tl'
          ? [
              new Phaser.Geom.Point(px, py),
              new Phaser.Geom.Point(px + size, py),
              new Phaser.Geom.Point(px, py + size),
            ]
          : [
              new Phaser.Geom.Point(px + size, py + size),
              new Phaser.Geom.Point(px, py + size),
              new Phaser.Geom.Point(px + size, py),
            ];
      g.fillPoints(pts, true);
    };

    tri(-30, -30, 150, c.accent, 0.14, 'tl');
    tri(64, -46, 96, c.formwork, 0.08, 'tl');
    tri(WORLD_W - 120, WORLD_H - 120, 150, c.accent, 0.12, 'br');
    tri(WORLD_W - 190, WORLD_H - 64, 96, c.formwork, 0.08, 'br');
  }

  /**
   * Development readout: replays the run the way the server will and shows
   * whether it reproduces.
   *
   * Not security — a client verifying itself proves nothing, and this panel comes
   * out before launch. It is here because a determinism regression is silent
   * otherwise, and seeing it fail during tuning is far cheaper than discovering
   * it when a finalist's score won't validate on event day.
   */
  private drawReplayCheck(data: ResultsData, score: number, y: number): void {
    const c = theme.colors;
    const font = 'ui-monospace, SFMono-Regular, Menlo, monospace';

    const started = performance.now();
    const outcome = verifyRun(data.seed, data.log, score);
    const took = performance.now() - started;

    const ok = outcome.ok;
    this.add
      .text(
        WORLD_W / 2,
        y,
        [
          ok ? 'replay ✓ reproduces' : 'replay ✗ MISMATCH',
          `seed ${data.seed}  ·  ${data.log.length} inputs  ·  ${took.toFixed(0)}ms`,
          ok ? '' : (outcome.reason ?? ''),
        ]
          .filter(Boolean)
          .join('\n'),
        {
          fontFamily: font,
          fontSize: '17px',
          color: css(ok ? c.good : c.danger),
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5, 0);
  }

  private addPlayAgain(demo: boolean): void {
    const c = theme.colors;
    const y = WORLD_H - 130;

    const button = this.add
      .rectangle(WORLD_W / 2, y, WORLD_W - 140, 84, c.accent)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(WORLD_W / 2, y, 'POUR AGAIN', {
        fontFamily: theme.fonts.display,
        fontSize: '32px',
        fontStyle: 'bold',
        color: css(c.onAccent),
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    // Attempts are unlimited here on purpose. The three-attempt limit will be
    // enforced server-side against a normalised email — never in the client,
    // where it would be one devtools call away from meaningless. Demo mode
    // gets its own honest caption rather than implying a limit that, for this
    // device, does not apply.
    this.add
      .text(
        WORLD_W / 2,
        y + 68,
        demo ? 'demo mode — unlimited replays, never saved' : 'attempt limits are enforced server-side',
        { fontFamily: theme.fonts.body, fontSize: '18px', color: css(c.textDim) },
      )
      .setOrigin(0.5);

    button.on('pointerup', () => this.scene.start('Play', { demo }));
  }
}
