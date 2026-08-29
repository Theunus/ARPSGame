import Phaser from 'phaser';
import { TICK_HZ, WORLD_H, WORLD_W, toResult, verifyRun } from '@pourline/sim';
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
  /** Absent only if main.ts somehow let a non-demo run start with no attempt — see PlayScene. */
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

    y += 24;

    if (data.demo) {
      // Real players get real server verification below instead — this panel
      // is a tuning/dev tool (see drawReplayCheck) that would just be clutter
      // and unexplained jargon on a real competitive result.
      this.drawReplayCheck(data, result.score, y);
      this.renderFooter(data.demo);
      return;
    }

    if (!data.token) {
      // Shouldn't happen — main.ts only ever starts a non-demo run with a
      // real token — but fail safely rather than pretend a score was saved.
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
   * The actual anti-cheat handoff: send the token and the recorded input log
   * to submit-run, which replays them server-side with the same
   * packages/sim module and only then decides what counts. Whatever comes
   * back, the token is spent — either the server confirms that (ok:true or
   * ok:false), or the request never arrived and the token stays usable so a
   * retry can still go through.
   */
  private async submitAndSettle(data: ResultsData, claimedScore: number, durationFrames: number): Promise<void> {
    const token = data.token as string;
    try {
      const res = await submitRun({
        token,
        inputLog: data.log,
        claimedScore,
        durationFrames,
        clientVersion: CLIENT_VERSION,
      });

      consumeToken(token);

      const c = theme.colors;
      if (res.ok) {
        this.statusText.setText('Score saved ✓');
        this.statusText.setColor(css(c.good));
      } else {
        this.statusText.setText(`Not saved — ${res.reason ?? 'verification failed'}`);
        this.statusText.setColor(css(c.danger));
      }
      this.renderFooter(false);
    } catch (err) {
      const c = theme.colors;
      if (err instanceof ApiError && err.status === 0) {
        // Network failure only — the token was never claimed server-side, so
        // it's still good. No offline queue yet (see Grill-Me-6); this is the
        // honest, retryable stand-in for it.
        this.statusText.setText("Couldn't reach the server — your attempt hasn't been used yet.");
        this.statusText.setColor(css(c.danger));
        this.renderRetry(data, claimedScore, durationFrames);
      } else {
        // The server responded but something else went wrong (bad/expired
        // token, already submitted). Treat it as spent either way — safer
        // than silently offering another play the server will just reject.
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
   * whether it reproduces. Demo mode only now — real players get the actual
   * server verification above instead of a debug panel.
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

  /**
   * The primary call to action, decided by whether an attempt is actually
   * left — never just "unlimited", except in demo mode. Only called once the
   * real post-submission attempts count is known (or in demo mode, where
   * there's nothing to wait on).
   */
  private renderFooter(demo: boolean): void {
    const c = theme.colors;
    const y = WORLD_H - 160;

    const remaining = demo ? Infinity : (nextToken() ? 1 : 0);
    const canPlayAgain = demo || remaining > 0;
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

      // Only demo mode gets a caption here — it carries information the
      // button alone doesn't ("unlimited, never saved"). For a real player
      // "POUR AGAIN" already says everything, and the extra line left no
      // room for the leaderboard button below it without the two colliding.
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
