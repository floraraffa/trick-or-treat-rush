// Unpacks GLBs compressed with EXT_meshopt_compression (tools/bake-gltf.mjs, tools/slim-avatar.mjs) into
// plain GLBs PlayCanvas can load: the Lens budget counts the build unzipped, and meshopt shrinks geometry
// three to four times where zip alone can't. Uses the MIT decoder from meshoptimizer (WASM, ~25 KB).
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';

const EXT = 'EXT_meshopt_compression';
const align4 = (n) => (n + 3) & ~3;

/** A GLB (ArrayBuffer) without meshopt compression; GLBs that don't use it come back untouched. */
export async function unpackGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf; // not a GLB
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  if (!json.extensionsUsed?.includes(EXT)) return buf;
  await MeshoptDecoder.ready;
  const binStart = 20 + jsonLen + 8;
  const bin = new Uint8Array(buf, binStart, dv.getUint32(20 + jsonLen, true));

  // Every buffer view, decoded where compressed, laid out again in one fresh binary chunk.
  const parts = json.bufferViews.map((v) => {
    const m = v.extensions?.[EXT];
    if (!m) return new Uint8Array(buf, binStart + (v.byteOffset ?? 0), v.byteLength); // GLB views all live in buffer 0
    const out = new Uint8Array(m.count * m.byteStride);
    const src = new Uint8Array(bin.buffer, bin.byteOffset + (m.byteOffset ?? 0), m.byteLength);
    MeshoptDecoder.decodeGltfBuffer(out, m.count, m.byteStride, src, m.mode, m.filter ?? 'NONE');
    return out;
  });
  let size = 0;
  json.bufferViews.forEach((v, i) => {
    v.buffer = 0;
    v.byteOffset = size;
    v.byteLength = parts[i].byteLength;
    if (v.extensions) { delete v.extensions[EXT]; if (!Object.keys(v.extensions).length) delete v.extensions; }
    size = align4(size + parts[i].byteLength);
  });
  json.buffers = [{ byteLength: size }];
  json.extensionsUsed = json.extensionsUsed.filter((e) => e !== EXT);
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter((e) => e !== EXT);

  const newBin = new Uint8Array(size);
  json.bufferViews.forEach((v, i) => newBin.set(parts[i], v.byteOffset));
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = align4(text.length) - text.length;
  if (pad) { const t = new Uint8Array(text.length + pad).fill(0x20); t.set(text); text = t; }
  const total = 12 + 8 + text.length + 8 + size;
  const out = new ArrayBuffer(total), o = new DataView(out), u = new Uint8Array(out);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
  o.setUint32(12, text.length, true); o.setUint32(16, 0x4e4f534a, true); u.set(text, 20);
  o.setUint32(20 + text.length, size, true); o.setUint32(24 + text.length, 0x004e4942, true); u.set(newBin, 28 + text.length);
  return out;
}

/** Fetches (or takes) a GLB and returns a blob URL of its unpacked copy, for loaders that want a URL. */
export async function unpackedGlbUrl(src) {
  const buf = typeof src === 'string' ? await (await fetch(src)).arrayBuffer()
    : ArrayBuffer.isView(src) ? src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) : src;
  return URL.createObjectURL(new Blob([await unpackGlb(buf)], { type: 'model/gltf-binary' }));
}
