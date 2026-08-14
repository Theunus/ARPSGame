import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '@pourline/sim';
import { PlayScene } from './scenes/PlayScene.ts';
import { ResultsScene } from './scenes/ResultsScene.ts';
import { theme } from './theme/theme.ts';

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
