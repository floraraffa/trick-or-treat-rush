// Walking poses on the Bitmoji rig, written once and used twice: tools/make-clips.mjs bakes them
// into assets/clips.glb for the player's real Bitmoji (played by bitmoji-anim.js), and the
// stand-in character poses itself from the same data at runtime.
//
// Format (bitmoji-mixamo, MIT, Baruch Geuze): each joint stores its turn away from a T-pose in
// character space (Y up, facing +Z, the character's left on +X); hips position in hip heights.

export const JOINTS = ['Hips', 'Spine', 'C_spine0002_bind_JNT', 'Spine1', 'Neck', 'C_neck0002_bind_JNT', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'C_pelvis0001_bind_JNT', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
export const PARENT = [-1, 0, 1, 2, 3, 4, 5, 3, 7, 8, 9, 3, 11, 12, 13, 0, 15, 16, 17, 18, 15, 20, 21, 22];

// T-pose joint positions in hip heights (from bitmoji-mixamo's sample clips).
const REST_L = {
  Hips: [0, 1, 0], Spine: [0, 1.04, 0], C_spine0002_bind_JNT: [0, 1.12, 0], Spine1: [0, 1.2, 0], Neck: [0, 1.5, 0],
  C_neck0002_bind_JNT: [0, 1.56, 0], Head: [0, 1.65, 0], C_pelvis0001_bind_JNT: [0, 1, 0],
  LeftShoulder: [0.08, 1.42, 0], LeftArm: [0.22, 1.44, 0], LeftForeArm: [0.52, 1.44, 0], LeftHand: [0.82, 1.44, 0],
  LeftUpLeg: [0.12, 0.9, 0], LeftLeg: [0.12, 0.5, 0], LeftFoot: [0.12, 0.07, 0], LeftToeBase: [0.12, -0.02, 0.18],
};
for (const [n, p] of Object.entries(REST_L)) if (n.startsWith('Left')) REST_L[n.replace('Left', 'Right')] = [-p[0], p[1], p[2]];
export const REST = JOINTS.map((n) => REST_L[n]);
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));

// --- quaternion maths ([x, y, z, w]) ------------------------------------------
const D2R = Math.PI / 180;
export const qid = () => [0, 0, 0, 1];
export function qaxis(axis, deg) {
  const h = deg * D2R * 0.5, s = Math.sin(h);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)];
}
export function qmul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
const norm = (q) => { const l = Math.hypot(...q); return q.map((c) => c / l); };

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const R = (axis, deg) => qaxis(axis, deg);
/** Several turns, applied right to left (the last one first) in the joint's frame. */
const T = (...turns) => turns.reduce((a, b) => qmul(a, b), qid());

// --- poses: t is time in seconds, each returns { joint: quaternion } -------------
// Arms hang with R(Z, ∓74); a turn about X applied after that swings them (negative = forward).
// Thighs: negative X = forward; knees and elbows flex with positive X / ±Y.
const TAU = Math.PI * 2;
const armsDown = { LeftArm: R(Z, -74), RightArm: R(Z, 74), LeftForeArm: R(Y, -12), RightForeArm: R(Y, 12) };
const pos = (v) => Math.max(0, v);

export const POSES = {
  idle: {
    length: 3, fps: 20,
    pose: (t) => {
      const s = Math.sin((TAU * t) / 3);
      return { ...armsDown, Spine: R(X, 2.5 * s), Head: T(R(Y, 8 * Math.sin((TAU * t) / 3 + 1)), R(X, -2 * s)) };
    },
  },
  // A cautious night-time walk: one stride per second, arms swinging against the legs.
  walk: {
    length: 1, fps: 24,
    pose: (t) => {
      const a = (TAU * t) / 1, s = Math.sin(a), c = Math.cos(a);
      return {
        Spine: T(R(X, 4), R(Y, 5 * s)), Spine1: R(Y, -3 * s), Head: T(R(Y, -3 * s), R(X, -3)),
        LeftUpLeg: R(X, -26 * s), RightUpLeg: R(X, 26 * s),
        LeftLeg: R(X, 6 + 42 * pos(c)), RightLeg: R(X, 6 + 42 * pos(-c)),
        LeftFoot: R(X, -8 * s), RightFoot: R(X, 8 * s),
        LeftArm: T(R(X, 22 * s), R(Z, -76)), RightArm: T(R(X, -22 * s), R(Z, 76)),
        LeftForeArm: R(Y, -18 - 10 * pos(-s)), RightForeArm: R(Y, 18 + 10 * pos(s)),
      };
    },
  },
  // Running: leaning in, knees high, elbows bent and pumping.
  run: {
    length: 0.64, fps: 30,
    pose: (t) => {
      const a = (TAU * t) / 0.64, s = Math.sin(a), c = Math.cos(a);
      return {
        Spine: T(R(X, 14), R(Y, 8 * s)), Spine1: R(Y, -5 * s), Neck: R(X, -8), Head: R(X, -6),
        LeftUpLeg: R(X, -10 - 44 * s), RightUpLeg: R(X, -10 + 44 * s),
        LeftLeg: R(X, 20 + 80 * pos(c)), RightLeg: R(X, 20 + 80 * pos(-c)),
        LeftFoot: R(X, -14 * s), RightFoot: R(X, 14 * s),
        LeftArm: T(R(X, 48 * s), R(Z, -70)), RightArm: T(R(X, -48 * s), R(Z, 70)),
        LeftForeArm: R(Y, -78), RightForeArm: R(Y, 78),
      };
    },
  },
  // Trick or treat! Knocking on the door with the right hand, the left holding the candy bag out.
  knock: {
    length: 0.5, fps: 24,
    pose: (t) => {
      const k = Math.pow(Math.abs(Math.sin((TAU * t) / 1)), 3); // two raps per cycle
      return {
        Spine: R(X, 4), Head: R(X, -6),
        RightArm: T(R(X, -72 - 6 * k), R(Z, 74)), RightForeArm: R(Y, 62 + 26 * k), RightHand: R(X, -20),
        LeftArm: T(R(X, -42), R(Z, -72)), LeftForeArm: R(Y, -48), LeftHand: R(X, 10),
        LeftUpLeg: R(X, -4), RightUpLeg: R(X, 4),
      };
    },
  },
  // Spooked by a monster: leaning back, arms thrown up.
  hit: {
    length: 0.6, fps: 24,
    pose: (t) => {
      const s = Math.sin((TAU * t) / 0.6);
      return {
        Spine: R(X, -18), Spine1: R(Z, 8 * s), Head: R(X, 14),
        LeftUpLeg: R(X, -30), RightUpLeg: R(X, -6), LeftLeg: R(X, 36), RightLeg: R(X, 12),
        LeftArm: R(Z, 40 + 36 * s), LeftForeArm: R(Z, 30 * s),
        RightArm: R(Z, -40 + 36 * s), RightForeArm: R(Z, 30 * s),
      };
    },
  },
  // Winner: both arms up, bouncing.
  cheer: {
    length: 0.8, fps: 24,
    pose: (t) => {
      const s = Math.sin((TAU * t) / 0.8);
      return {
        Spine: R(X, -6), Head: R(X, -10),
        LeftArm: R(Z, 62 + 10 * s), LeftForeArm: R(Z, 12),
        RightArm: R(Z, -62 - 10 * s), RightForeArm: R(Z, -12),
        LeftUpLeg: R(X, -8 * pos(s)), RightUpLeg: R(X, -8 * pos(s)),
        LeftLeg: R(X, 16 * pos(s)), RightLeg: R(X, 16 * pos(s)),
      };
    },
  },
  // Not this time: head down, shoulders slumped, a slow sigh.
  sad: {
    length: 2.4, fps: 20,
    pose: (t) => {
      const s = Math.sin((TAU * t) / 2.4);
      return {
        ...armsDown, Spine: R(X, 10 + 2 * s), Spine1: R(X, 6), Neck: R(X, 16), Head: T(R(X, 14), R(Y, 10 * s)),
        LeftShoulder: R(Z, -6), RightShoulder: R(Z, 6),
      };
    },
  },
};

/**
 * Evaluates a pose at time t: D[j] (each joint's turn in character space), the joint positions
 * and the hips height that keeps the lowest foot on the ground (or the pose's own `hipsY`). Units are hip heights.
 */
export function evaluate(name, t) {
  const extra = POSES[name].pose(t);
  const D = [], pos = [];
  for (let j = 0; j < JOINTS.length; j++) {
    const p = PARENT[j];
    D[j] = norm(qmul(p < 0 ? qid() : D[p], extra[JOINTS[j]] ?? qid()));
    if (p < 0) pos[j] = [0, 0, 0];
    else {
      const off = qrot(D[p], REST[j].map((c, k) => c - REST[p][k]));
      pos[j] = pos[p].map((c, k) => c + off[k]);
    }
  }
  // Ground the lowest point of either foot (ankle or toe).
  const lowest = Math.min(...['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase'].map((n) => pos[J[n]][1]));
  const hipsY = POSES[name].hipsY ?? -lowest + 0.02;
  return { D, pos: pos.map((p) => [p[0], p[1] + hipsY, p[2]]), hipsY };
}
