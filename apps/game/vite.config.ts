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
      output: {
        // Phaser is by far the largest dependency and never changes between
        // deploys — splitting it keeps the game chunk small and cacheable,
        // which is what matters on saturated venue wifi.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
