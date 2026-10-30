// The game's moves (src/poses.js: idle, walk, run, knock, hit, cheer, sad) as a Humanoid FBX for the Meta Quest
// version: Unity imports it as a Humanoid rig and retargets the clips onto the player's Meta Avatar (its Avatars
// SDK plays Humanoid clips on the avatar through a custom animation rig). The skeleton is our own: the poses'
// T-pose in Mixamo-style names (Hips, Spine, Spine1, Neck, Head, LeftShoulder…), no mesh, nothing of anyone's
// avatar. Blender (headless) builds it: tools/quest/blender/clips.py.
//   node tools/quest/clips-fbx.mjs <out.fbx>
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOINTS, PARENT, POSES, REST, evaluate } from '../../src/poses.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// The in-between joints (a second spine, neck and pelvis joint) never turn on their own in the poses: dropping
// them keeps every other joint exactly where it was, and leaves a plain humanoid chain.
const SKIP = new Set(['C_spine0002_bind_JNT', 'C_neck0002_bind_JNT', 'C_pelvis0001_bind_JNT']);
const keep = JOINTS.map((n, i) => i).filter((i) => !SKIP.has(JOINTS[i]));
const parentOf = (i) => { let p = PARENT[i]; while (p >= 0 && SKIP.has(JOINTS[p])) p = PARENT[p]; return p; };

export function clipsData() {
  return {
    hipHeight: 0.95, // metres (a grown-up of about 1.75 m; Humanoid retargeting fits any avatar's own size)
    joints: keep.map((i) => JOINTS[i]),
    parent: keep.map((i) => keep.indexOf(parentOf(i))),
    rest: keep.map((i) => REST[i]),
    clips: Object.entries(POSES).map(([name, { length, fps }]) => {
      const n = Math.round(length * fps) + 1;
      const frames = [];
      for (let f = 0; f < n; f++) {
        const { D, pos } = evaluate(name, f / fps);
        frames.push({ q: keep.map((i) => D[i]), hips: pos[0] });
      }
      return { name, fps, frames };
    }),
  };
}

export function buildClipsFbx(out) {
  const dir = mkdtempSync(join(tmpdir(), 'clips-'));
  const json = join(dir, 'clips.json');
  writeFileSync(json, JSON.stringify(clipsData()));
  const r = spawnSync('blender', ['--background', '--factory-startup', '--python', join(HERE, 'blender/clips.py'), '--', json, resolve(out)], { encoding: 'utf8' });
  if (r.status !== 0 || !/✔ wrote/.test(r.stdout)) throw new Error(`blender: ${r.error || ''}\n${r.stdout.slice(-2000)}\n${r.stderr.slice(-2000)}`);
  return r.stdout.split('\n').filter((l) => l.startsWith('✔')).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildClipsFbx(process.argv[2] || 'clips.fbx'));
