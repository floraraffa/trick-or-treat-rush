// The team's monster drawings (art/creatures/<name>.jpg, 1556×2000) → the textures the game projects onto
// its creature puppets: public/assets/monsters/<name>.webp, the whole drawing scaled to 1024 px wide (the
// puppets map drawing pixels by proportion, so any size works).   node tools/make-creatures.mjs
import { mkdirSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

mkdirSync('public/assets/monsters', { recursive: true });
for (const f of readdirSync('art/creatures').filter((f) => f.endsWith('.jpg'))) {
  const name = f.replace(/\.jpg$/, '');
  const info = await sharp(`art/creatures/${f}`).resize(1024).webp({ quality: 80 }).toFile(`public/assets/monsters/${name}.webp`);
  console.log(`${name.padEnd(9)} ${(info.size / 1024).toFixed(0)} KB`);
}
