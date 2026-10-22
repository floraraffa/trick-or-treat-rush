// writeGlb() from bitmoji-mixamo's converter (MIT, Copyright (c) 2026 Baruch Geuze,
// https://github.com/bgeuze/bitmoji-mixamo): writes clips in the format bitmoji-anim.js plays.
import { JOINTS, PARENT } from '../../src/poses.js';

const FORMAT = "bitmoji-mixamo";
const VERSION = 3;

export function writeGlb(clips) {
  const NJ = JOINTS.length;
  // Every clip under its own name: a second "idle" becomes "idle_2".
  const used = new Map();
  const names = clips.map((c) => { const n = used.get(c.name) ?? 0; used.set(c.name, n + 1); return n ? `${c.name}_${n + 1}` : c.name; });
  const chunks = [];
  let byteLength = 0;
  const bufferViews = [], accessors = [];
  const push = (typed, accessor) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (byteLength % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); byteLength += pad; }
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength });
    chunks.push(bytes);
    byteLength += bytes.byteLength;
    accessors.push({ bufferView: bufferViews.length - 1, ...accessor });
    return accessors.length - 1;
  };

  const animations = clips.map((c, ci) => {
    const times = new Float32Array(c.frames);
    for (let f = 0; f < c.frames; f++) times[f] = f / c.fps;
    const input = push(times, { componentType: 5126, count: c.frames, type: "SCALAR", min: [0], max: [times[c.frames - 1]] });
    const samplers = [], channels = [];
    for (let j = 0; j < NJ; j++) {
      if (!c.rest[j]) continue;
      const q = new Int16Array(c.frames * 4);
      for (let f = 0; f < c.frames; f++) {
        for (let k = 0; k < 4; k++) q[f * 4 + k] = Math.round(Math.max(-1, Math.min(1, c.rot[(f * NJ + j) * 4 + k])) * 32767);
      }
      samplers.push({ input, output: push(q, { componentType: 5122, normalized: true, count: c.frames, type: "VEC4" }), interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: j, path: "rotation" } });
    }
    samplers.push({ input, output: push(c.hips, { componentType: 5126, count: c.frames, type: "VEC3" }), interpolation: "LINEAR" });
    channels.push({ sampler: samplers.length - 1, target: { node: 0, path: "translation" } });
    return { name: names[ci], samplers, channels, extras: { loop: c.loop, fps: c.fps, rest: c.rest } };
  });

  const nodes = JOINTS.map((name, j) => {
    const children = PARENT.map((p, i) => (p === j ? i : -1)).filter((i) => i >= 0);
    return { name, ...(children.length ? { children } : {}) };
  });

  const json = {
    asset: { version: "2.0", generator: `${FORMAT} ${VERSION}` },
    extras: {
      format: FORMAT,
      version: VERSION,
      parent: PARENT,
      // Rotations: each joint's turn from the source's T-pose, in character space (Y up, facing
      // +Z). rest (per animation): the T-pose, each joint's position in hip heights. The Hips'
      // translation: in hip heights, the origin on the floor.
      space: "character",
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    animations,
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  };

  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  if (jsonPad) jsonBytes = enc.encode(JSON.stringify(json) + " ".repeat(jsonPad));
  const binPad = (4 - (byteLength % 4)) % 4;
  const total = 12 + 8 + jsonBytes.byteLength + 8 + byteLength + binPad;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.byteLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  let o = 20 + jsonBytes.byteLength;
  dv.setUint32(o, byteLength + binPad, true);
  dv.setUint32(o + 4, 0x004e4942, true);
  o += 8;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}
