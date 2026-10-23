// Every language has every string the English has (same keys, same rows, same {placeholders}).
import assert from 'node:assert/strict';
import { LANGS, STRINGS } from '../src/ui/i18n.js';

const holes = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
function same(a, b, path) {
  if (typeof a === 'string') { assert.equal(typeof b, 'string', `${path} is missing`); assert.ok(b.trim(), `${path} is empty`); assert.equal(holes(b), holes(a), `${path}: placeholders differ`); return; }
  if (Array.isArray(a)) { assert.ok(Array.isArray(b) && b.length === a.length, `${path}: ${a.length} rows in English`); a.forEach((x, i) => same(x, b[i], `${path}[${i}]`)); return; }
  for (const k of Object.keys(a)) same(a[k], b?.[k], `${path}.${k}`);
  for (const k of Object.keys(b)) assert.ok(k in a, `${path}.${k} is not in English`);
}
assert.deepEqual(Object.keys(STRINGS).sort(), Object.keys(LANGS).sort(), 'one set of strings per language in the picker');
for (const l of Object.keys(LANGS)) if (l !== 'en') same(STRINGS.en, STRINGS[l], l);
console.log(`✔ texts: ${Object.values(LANGS).join(', ')} all complete`);
