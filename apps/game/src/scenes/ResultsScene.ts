import Phaser from 'phaser';
import { TICK_HZ, WORLD_H, WORLD_W, toResult } from '@pourline/sim';
import type { InputEvent, SimState } from '@pourline/sim';
import { ApiError, submitRun } from '../api.ts';
import { consumeToken, nextToken } from '../session.ts';
import { css, theme } from '../theme/theme.ts';

const CLIENT_VERSION = 'pourline-web-1';

interface ResultsData {
  state: SimState;
  log: InputEvent[];
  seed: number;
  demo: boolean;
  token?: string | null;
}

export class ResultsScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Results');
  }

  create(data: ResultsData): void {
    const c = theme.colors;
    const result = toResult(data.state);
    this.cameras.main.setBackgroundColor(c.bg);

    this.drawBrandTriangles();

    let y = 96;

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

    y += 24;

    if (data.demo) {
      this.renderFooter(true);
      return;
    }

    if (!data.token) {
      this.statusText = this.add
        .text(WORLD_W / 2, y, 'No active attempt — this score could not be saved.', {
          fontFamily: theme.fonts.body,
          fontSize: '17px',
          color: css(c.danger),
          align: 'center',
          wordWrap: { width: WORLD_W - 100 },
        })
        .setOrigin(0.5, 0);
      this.renderFooter(false);
      return;
    }

    this.statusText = this.add
      .text(WORLD_W / 2, y, 'Submitting score…', {
        fontFamily: theme.fonts.body,
        fontSize: '17px',
        color: css(c.textDim),
        align: 'center',
      })
      .setOrigin(0.5, 0);

    void this.submitAndSettle(data, result.score, result.frames);
  }

  /**
   * Sends the run to submit-run, which replays it server-side and decides what
   * counts. On a network failure the token is untouched, so a retry is offered.
   */
  private async submitAndSettle(data: ResultsData, claimedScore: number, durationFrames: number): Promise<void> {
    const token = data.token as string;
    const c = theme.colors;
    try {
      const res = await submitRun({
        token,
        inputLog: data.log,
        claimedScore,
        durationFrames,
        clientVersion: CLIENT_VERSION,
      });

      consumeToken(token);

      if (res.ok) {
        this.statusText.setText('Score saved ✓');
        this.statusText.setColor(css(c.good));
      } else {
        this.statusText.setText(`Not saved — ${res.reason ?? 'verification failed'}`);
        this.statusText.setColor(css(c.danger));
      }
      this.renderFooter(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // Never reached the server, so the attempt is still good — let them retry.
        this.statusText.setText("Couldn't reach the server — your attempt hasn't been used yet.");
        this.statusText.setColor(css(c.danger));
        this.renderRetry(data, claimedScore, durationFrames);
      } else {
        consumeToken(token);
        this.statusText.setText(`Couldn't save this score — ${(err as Error).message}`);
        this.statusText.setColor(css(c.danger));
        this.renderFooter(false);
      }
    }
  }

  private renderRetry(data: ResultsData, claimedScore: number, durationFrames: number): void {
    const c = theme.colors;
    const y = WORLD_H - 210;
    const button = this.add
      .rectangle(WORLD_W / 2, y, 220, 60, c.formworkDim)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(WORLD_W / 2, y, 'RETRY', {
        fontFamily: theme.fonts.display,
        fontSize: '22px',
        fontStyle: 'bold',
        color: css(c.text),
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    button.on('pointerup', () => {
      button.destroy();
      label.destroy();
      this.statusText.setText('Submitting score…');
      this.statusText.setColor(css(c.textDim));
      void this.submitAndSettle(data, claimedScore, durationFrames);
    });
  }

  /** Faint corner triangles echoing the ARPS logo motif. */
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

  /** Pour Again (when an attempt remains) or the exhausted message, plus the leaderboard link. */
  private renderFooter(demo: boolean): void {
    const c = theme.colors;
    const y = WORLD_H - 160;

    const canPlayAgain = demo || nextToken() !== null;
    let leaderboardY = y + 72;

    if (canPlayAgain) {
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

      if (demo) {
        this.add
          .text(WORLD_W / 2, y + 56, 'demo mode — unlimited replays, never saved', {
            fontFamily: theme.fonts.body,
            fontSize: '16px',
            color: css(c.textDim),
          })
          .setOrigin(0.5);
        leaderboardY = y + 100;
      }

      button.on('pointerup', () => this.scene.start('Play', { demo }));
    } else {
      this.add
        .text(WORLD_W / 2, y - 10, "You've used all 3 attempts — good luck!", {
          fontFamily: theme.fonts.body,
          fontSize: '19px',
          fontStyle: 'bold',
          color: css(c.textDim),
          align: 'center',
          wordWrap: { width: WORLD_W - 100 },
        })
        .setOrigin(0.5);
      leaderboardY = y + 70;
    }

    this.addLeaderboardLink(leaderboardY);
  }

  private addLeaderboardLink(y: number): void {
    const c = theme.colors;
    const button = this.add
      .rectangle(WORLD_W / 2, y, WORLD_W - 140, 64, c.bgAccent)
      .setStrokeStyle(1, c.groundLine)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(WORLD_W / 2, y, 'VIEW LEADERBOARD', {
        fontFamily: theme.fonts.display,
        fontSize: '20px',
        fontStyle: 'bold',
        color: css(c.text),
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    button.on('pointerup', () => {
      window.location.href = 'leaderboard.html';
    });
  }
}
