// Packs dist/ into submission/trick-or-treat-rush-v<version>.zip and checks Snap's Web Lens rules:
// index.html at the zip root, relative asset paths, build <= 8 MB unzipped (My Lenses measures the
// build output itself, not the zip), index.html <= 1 MB.
import { createWriteStream, readFileSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import archiver from 'archiver';

// My Lenses reported 8.2 MB for a 7.49e6-byte build (it counts ~10% more than the bytes), so keep the
// build under 7.2e6 bytes to stay below its 8 MB.
const MB = 1024 * 1024, BUDGET = 7.2e6;
const dist = 'dist';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const fail = (msg) => { console.error(`✖ ${msg}`); process.exit(1); };

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (statSync(join(dist, 'index.html')).size > MB) fail('index.html is over 1 MB');
const abs = html.match(/(src|href)="\/[^"]*"/g);
if (abs) fail(`absolute paths in index.html: ${abs.join(', ')}`);
if (/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, ''))) console.warn('⚠ index.html mentions an http(s) URL: the Lens CSP blocks network access');

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p); else files.push(p);
  }
};
walk(dist);
const unzipped = files.reduce((n, f) => n + statSync(f).size, 0);
if (unzipped > BUDGET) fail(`build output is ${(unzipped / 1e6).toFixed(2)} MB unzipped, over our 7.2 MB target (My Lenses counts ~10% more, limit 8 MB)`);

mkdirSync('submission', { recursive: true });
const out = `submission/trick-or-treat-rush-v${version}.zip`;
const zip = archiver('zip', { zlib: { level: 9 } });
const stream = createWriteStream(out);
zip.pipe(stream);
// index.html goes first: Snap's guide checks that the listing starts with it.
files.sort((a, b) => (relative(dist, b) === 'index.html') - (relative(dist, a) === 'index.html'));
for (const f of files) zip.file(f, { name: relative(dist, f).split('\\').join('/') });
await zip.finalize();
await new Promise((res) => stream.on('close', res));

const size = statSync(out).size;
if (size > 8 * MB) fail(`${out} is ${(size / MB).toFixed(2)} MB, over the 8 MB limit`);
console.log(`✔ ${out}: build ${(unzipped / 1e6).toFixed(2)} MB unzipped (target 7.2 MB, My Lenses limit 8 MB), zip ${(size / 1e6).toFixed(2)} MB, ${files.length} files, index.html at the root`);
