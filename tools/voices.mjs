// The Bitmoji's cries for the phone game: the Spectacles Lens's Assets/Audio/voice-*.wav (cut from the voices of a
// Lenslist video, without its background, by that repository's tools/cut-voices.py) as small MP3s in
// public/assets/voice/ (mono, 22 kHz, 48 kbps: about 30 KB in all). Not cleared yet: see CREDITS.md.
//   npm run voices [-- <the Lens Studio project> = ../trick-or-treat-rush-spectacles]   (needs ffmpeg)
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lens = resolve(process.argv[2] ?? join(ROOT, '../trick-or-treat-rush-spectacles'));
const OUT = join(ROOT, 'public/assets/voice');
// (the ones the phone game cries: no boo here, the phone has no boo skill)
const CRIES = ['scream', 'nooo', 'ohno', 'aah-1', 'aah-2', 'aah-3'];
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const n of CRIES) {
  const src = join(lens, 'Assets/Audio', `voice-${n}.wav`), dst = join(OUT, `${n}.mp3`);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', '22050', '-codec:a', 'libmp3lame', '-b:a', '48k', dst], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${src}`);
  total += statSync(dst).size;
}
console.log(`✔ ${CRIES.length} cries in public/assets/voice (${(total / 1024).toFixed(0)} KB)`);
