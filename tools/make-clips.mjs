// Bakes the walking poses in src/poses.js into public/assets/clips.glb for the player's Bitmoji.
//   node tools/make-clips.mjs
import { statSync, writeFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder } from 'meshoptimizer';
import { JOINTS, POSES, REST, evaluate } from '../src/poses.js';
import { writeGlb } from './lib/write-clips.mjs';

const NJ = JOINTS.length;
const clips = Object.entries(POSES).map(([name, { length, fps }]) => {
  const frames = Math.round(length * fps) + 1;
  const rot = new Float32Array(frames * NJ * 4), hips = new Float32Array(frames * 3);
  for (let f = 0; f < frames; f++) {
    const { D, hipsY } = evaluate(name, f / fps);
    for (let j = 0; j < NJ; j++) rot.set(D[j], (f * NJ + j) * 4);
    hips.set([0, hipsY, 0], f * 3);
  }
  return { name, fps, loop: true, frames, rot, hips, rest: REST };
});
const out = new URL('../public/assets/clips.glb', import.meta.url);
writeFileSync(out, writeGlb(clips));
// Meshopt byte compression, values untouched (no quantizing): the game unpacks it on load (src/lib/meshopt-glb.js).
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(out.pathname);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out.pathname, doc);
console.log(`wrote public/assets/clips.glb (${(statSync(out).size / 1024).toFixed(0)} KB): ${clips.map((c) => c.name).join(', ')}`);
