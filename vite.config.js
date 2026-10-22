import { defineConfig } from 'vite';

export default defineConfig({
  // Snap serves Web Lenses from a private scheme: every asset path must be relative.
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 4096, // PlayCanvas alone is ~2 MB; the 8 MB zip limit is what counts
  },
  server: { host: true, port: 3000 },
});
