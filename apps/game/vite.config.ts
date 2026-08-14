import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build can be served from any path on Cloudflare Pages.
  base: './',
  server: {
    // Exposed on the LAN so the game can be opened on a real phone during
    // development. Tuning the pour by feel on a desktop mouse is worthless.
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      // Vite only bundles index.html by default. The leaderboard is a
      // separate page (apps/game/leaderboard.html) meant to run on a laptop
      // driving a stand TV, not inside the phone game — it needs its own
      // build entry or `npm run build` would silently drop it.
      input: {
        main: 'index.html',
        leaderboard: 'leaderboard.html',
      },
      output: {
        // Phaser is by far the largest dependency and never changes between
        // deploys — splitting it keeps the game chunk small and cacheable,
        // which is what matters on saturated venue wifi. The leaderboard
        // page never imports Phaser, so it isn't affected by this split.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
