// Turns the Lens build (dist/) into a page for a claude.ai artifact, a quick way to play the game in
// any browser before Snap has reviewed the Lens:   npm run build && node tools/artifact.mjs <outdir>
// The artifact host wraps the page in its own document and refuses WebAssembly-heavy work, so the
// page is written without its <html>/<head>/<body> tags, and the GLBs (a type artifacts don't serve)
// ship unpacked, as base64 in <name>.glb.json, which src/actors/avatar.js falls back to.
import { cpSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unpackGlb } from '../src/lib/meshopt-glb.js';

const out = process.argv[2];
if (!out) { console.error('usage: node tools/artifact.mjs <outdir>'); process.exit(1); }
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('dist', out, { recursive: true });

for (const f of ['assets/avatar_default.glb', 'assets/clips.glb']) {
  const src = readFileSync(join('dist', f));
  const plain = Buffer.from(await unpackGlb(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength)));
  unlinkSync(join(out, f));
  writeFileSync(join(out, `${f}.json`), JSON.stringify({ base64: plain.toString('base64') }));
  console.log(`${f}: ${(src.length / 1024).toFixed(0)} KB → ${(plain.length / 1024).toFixed(0)} KB unpacked, as ${f}.json`);
}

const html = readFileSync('dist/index.html', 'utf8')
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?(html|head|body)[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace('<title>', '<style>:root { color-scheme: dark; }</style>\n    <title>');
writeFileSync(join(out, 'index.html'), html.trim() + '\n');
console.log(`artifact page written to ${out}`);
