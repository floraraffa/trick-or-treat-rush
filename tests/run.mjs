// npm test: the authority's rules and the texts in every language (fast, no browser).
// npm run test:e2e: also a solo night, a three-player room and the Specs version in an emulated headset, in
// headless Chromium (slow: software WebGL).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const run = (args, env = {}) => {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['tests/authority.test.mjs']);
run(['tests/i18n.test.mjs']);
if (process.argv.includes('--e2e')) {
  mkdirSync('tests/out', { recursive: true });
  const port = 3300 + Math.floor(Math.random() * 500);
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 4000));
  try {
    run(['tests/play.mjs', 'tests/out'], { URL: `http://localhost:${port}/` });
    run(['tests/room.mjs', 'tests/out'], { URL: `http://localhost:${port}/` });
    run(['tests/specs.mjs', 'tests/out'], { URL: `http://localhost:${port}/` });
  } finally { vite.kill(); }
}
