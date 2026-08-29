import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '@pourline/sim';
import { consumeStaffCodeFromUrl, isDemoMode } from './demo.ts';
import { PlayScene } from './scenes/PlayScene.ts';
import { ResultsScene } from './scenes/ResultsScene.ts';
import { loadSession, nextToken } from './session.ts';
import { applyBrandText, applyThemeVars } from './theme/cssVars.ts';
import { theme } from './theme/theme.ts';

// Must settle demo-mode state (from ?staff=) before the gate check reads it.
consumeStaffCodeFromUrl();

/** Demo/staff mode always plays; everyone else needs an unused attempt. */
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
    // FIT keeps the playfield identical on every device — a competition can't
    // have a taller phone seeing more of the track.
    scale: {
      parent: 'game',
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_W,
      height: WORLD_H,
      expandParent: true,
    },
    scene: [PlayScene, ResultsScene],
    render: { antialias: true, roundPixels: false },
  });

  // Phaser can latch a zero canvas size if it measures its parent before layout
  // settles; refresh on boot and on every viewport change to recover.
  const refreshScale = () => game.scale.refresh();
  window.addEventListener('resize', refreshScale);
  window.addEventListener('orientationchange', refreshScale);
  window.visualViewport?.addEventListener('resize', refreshScale);
  game.events.once(Phaser.Core.Events.READY, () => {
    refreshScale();
    requestAnimationFrame(refreshScale);
  });

  if (import.meta.env.DEV) {
    (globalThis as Record<string, unknown>).__pourline = game;
  }
}

/** Shown instead of the game when this device can't play. Phaser never boots. */
function showGate(): void {
  applyThemeVars();
  applyBrandText();

  document.getElementById('gate')?.classList.add('visible');

  const title = document.getElementById('gate-title');
  const message = document.getElementById('gate-message');
  // A cached session means "already used all three" rather than "never registered".
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
