// Headless Chromium for the browser tests: a local `playwright` (npm i -D playwright) if there is one,
// else the copy preinstalled in Claude Code's cloud containers. Software WebGL, so no GPU is needed.
import { createRequire } from 'node:module';

export async function launch() {
  let pw;
  try { pw = await import('playwright'); } catch { pw = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright'); }
  return pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
