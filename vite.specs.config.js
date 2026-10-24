// The Specs build (WebXR, opened in the glasses' browser): the same game code, its own page, its own folder.
// `npm run build:specs` → dist-specs/ with index.html at the root, ready for any static https host.
import { renameSync } from 'node:fs';
import { defineConfig } from 'vite';
import lens from './vite.config.js';

export default defineConfig({
  ...lens,
  plugins: [...(lens.plugins ?? []), { name: 'specs-index', apply: 'build', closeBundle() { renameSync('dist-specs/specs.html', 'dist-specs/index.html'); } }],
  build: { ...lens.build, outDir: 'dist-specs', rollupOptions: { input: 'specs.html' } },
});
