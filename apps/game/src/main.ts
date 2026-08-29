import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '@pourline/sim';
import { consumeStaffCodeFromUrl, isDemoMode } from './demo.ts';
import { PlayScene } from './scenes/PlayScene.ts';
import { ResultsScene } from './scenes/ResultsScene.ts';
import { loadSession, nextToken } from './session.ts';
import { applyBrandText, applyThemeVars } from './theme/cssVars.ts';
import { theme } from './theme/theme.ts';

// Must run before anything below: PlayScene and the gate check both read
// demo-mode state from localStorage.
consumeStaffCodeFromUrl();

/**
 * The actual "you can't play" enforcement. Staff/demo mode always passes;
 * everyone else needs a real unused attempt, which only exists if they came
 * through register.html and haven't already spent all three. This is a
 * client-side convenience gate, not the security boundary — submit-run
 * enforces the real limit — but it's what stops someone from being led into
 * playing a full run that was never going to be accepted.
 */
function canPlay(): boolean {
  return isDemoMode() || nextToken() !== null;
}

if (canPlay()) {
  bootGame();
} else {
  showGate();
}

function bootGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: theme.colors.bg,
    // Portrait design resolution, letterboxed to fit whatever phone shows up.
    // FIT rather than RESIZE so the playfield is identical on every device —
    // a competition cannot have a taller phone seeing more of the track.
    scale: {
      parent: 'game',
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_W,
      height: WORLD_H,
      expandParent: true,
    },
    // No physics engine. The simulation owns all motion, and Arcade Physics would
    // introduce variable-timestep behaviour the server could not reproduce.
    scene: [PlayScene, ResultsScene],
    render: { antialias: true, roundPixels: false },
  });

  /**
   * Keep the canvas sized to the viewport.
   *
   * Phaser measures its parent once at boot. If that happens before layout has
   * settled it can latch a zero size and never recover — a black screen with no
   * console error, which is the worst possible failure at an event stand.
   *
   * The same refresh covers the things that genuinely happen on a phone mid-run:
   * rotating the device, and iOS collapsing or restoring its URL bar (which fires
   * on visualViewport, not window).
   */
  function refreshScale(): void {
    game.scale.refresh();
  }

  window.addEventListener('resize', refreshScale);
  window.addEventListener('orientationchange', refreshScale);
  window.visualViewport?.addEventListener('resize', refreshScale);

  game.events.once(Phaser.Core.Events.READY, () => {
    refreshScale();
    requestAnimationFrame(refreshScale);
  });

  // Development handle for driving the game from the console or an automated
  // browser. Stripped from production builds by the DEV guard.
  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>).__pourline = game;
  }
}

/**
 * Shown instead of the game — Phaser is never constructed in this branch.
 * There's no reason to boot a canvas engine and load a ~340KB chunk just to
 * display a sentence and two buttons to someone who can't play anyway.
 */
function showGate(): void {
  applyThemeVars();
  applyBrandText();

  document.getElementById('gate')?.classList.add('visible');

  const title = document.getElementById('gate-title');
  const message = document.getElementById('gate-message');
  // Distinguishes "never registered" from "already used all three" — the
  // second is a very different message: they don't need to register again,
  // and telling them to would be actively confusing. A cached session
  // existing at all is what tells them apart.
  if (loadSession() && title && message) {
    title.textContent = "You've used all 3 attempts";
    message.textContent = "Good luck! You can check the leaderboard to see how you're doing.";
    document.getElementById('gate-register')?.remove();
  }

  document.getElementById('gate-register')?.addEventListener('click', () => {
    window.location.href = 'register.html';
  });
  document.getElementById('gate-leaderboard')?.addEventListener('click', () => {
    window.location.href = 'leaderboard.html';
  });
}
