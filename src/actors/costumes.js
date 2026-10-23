// Halloween costumes worn over the Bitmoji, made to look like the real thing: a crumpled velvet witch
// hat with a drooping tip, a satin band and a brass buckle; a ribbed jack-o'-lantern hat carved and lit
// from inside; glossy ridged devil horns; a vampire's velvet cape lined in red satin, fitted close to
// the Bitmoji's back (from its own measurements) with a pointed hem and a tall Dracula collar. They
// are separate meshes riding on the avatar's head (or upper spine) joint, so they never change the
// Bitmoji itself and come off with a tap. Each piece is split by material (velvet, satin, gold...).
import { Color, calculateNormals } from 'playcanvas';
import { Geo, blob, box, texturedMaterial, trs } from '../geo.js';
import { flat, lathe, tube } from '../world/shapes.js';

export const COSTUMES = ['witch', 'pumpkin', 'horns', 'cape', 'none'];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** The costume materials, shared by every avatar. */
export function costumeMaterials(tex) {
  if (tex.costumeMats) return tex.costumeMats;
  const velvet = texturedMaterial(tex.velvet ?? tex.plain, { normal: tex.normals?.velvet, gloss: 0.22, bumpiness: 0.8, tiling: 2.5 });
  velvet.useSheen = true; velvet.sheen = new Color(0.32, 0.27, 0.4); velvet.sheenGloss = 0.35; velvet.update(); // velvet glows at the edges
  const glow = texturedMaterial(tex.plain, { emissive: new Color(1, 1, 1), gloss: 0.3 });
  glow.emissiveIntensity = 2.4; glow.update();
  tex.costumeMats = {
    velvet,
    satin: texturedMaterial(tex.plain, { gloss: 0.8 }),
    gold: texturedMaterial(tex.plain, { gloss: 0.82, metal: 1 }),
    horn: texturedMaterial(tex.plain, { gloss: 0.75 }),
    rind: texturedMaterial(tex.plain, { gloss: 0.55 }),
    matte: texturedMaterial(tex.plain, { gloss: 0.15 }),
    glow,
  };
  return tex.costumeMats;
}

/**
 * A surface f(u, v) → [x, y, z] over u, v in 0..1, smooth normals, its front turned towards `facing`
 * (a direction checked at the middle of the sheet).
 */
function sheet(f, cols, rows, facing, uvScale = 1) {
  const m = { p: [], n: [], uv: [], i: [] };
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) { m.p.push(...f(c / cols, r / rows)); m.uv.push((c / cols) * uvScale, (r / rows) * uvScale); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + cols + 1; m.i.push(a, b, a + 1, a + 1, b, b + 1); }
  m.n = Array.from(calculateNormals(m.p, m.i));
  const mid = ((rows >> 1) * (cols + 1) + (cols >> 1)) * 3;
  if (m.n[mid] * facing[0] + m.n[mid + 1] * facing[1] + m.n[mid + 2] * facing[2] < 0) {
    for (let k = 0; k < m.i.length; k += 3) [m.i[k + 1], m.i[k + 2]] = [m.i[k + 2], m.i[k + 1]];
    m.n = m.n.map((v) => -v);
  }
  return m;
}

/** A cone bent along a curve, its rings crumpled like old felt: the witch's hat crown. */
function crookedCone(rings = 26, segs = 22) {
  const spine = (t) => [0.75 * t ** 3, 0.08 + 2.75 * t - 0.75 * t ** 3, 0.1 * t - 0.95 * t ** 3];
  return sheet((u, v) => {
    const t = v, a = u * Math.PI * 2, c = spine(t);
    const d = spine(Math.min(1, t + 0.01)), e = spine(Math.max(0, t - 0.01));
    const tan = [d[0] - e[0], d[1] - e[1], d[2] - e[2]], tl = Math.hypot(...tan);
    const T = tan.map((x) => x / tl), X = [T[1], -T[0], 0], xl = Math.hypot(...X); // a frame round the bent spine
    const N = X.map((x) => x / xl), B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
    const crumple = 1 + 0.07 * Math.sin(3 * a + 7 * t) * Math.sin(Math.PI * Math.min(1, t * 2.2)) + 0.03 * Math.sin(7 * a - 3 * t);
    const r = (0.94 * (1 - t) ** 0.95 + 0.025) * crumple;
    return [c[0] + (N[0] * Math.cos(a) + B[0] * Math.sin(a)) * r, c[1] + (N[1] * Math.cos(a) + B[1] * Math.sin(a)) * r, c[2] + (N[2] * Math.cos(a) + B[2] * Math.sin(a)) * r];
  }, segs, rings, [-1, 0, 0], 0.5); // (the middle of the sheet is on the crown's -X side)
}

/**
 * The pieces of a hat or horns, by material key, in the head's frame: origin on top of the head, +Z
 * forward, unit = head radius. (The cape is built by capeParts.)
 */
export function costumeParts(id) {
  const P = {};
  const part = (k) => (P[k] ??= new Geo());
  if (id === 'witch') {
    const felt = [0.17, 0.1, 0.24];
    // brim: wide, with a lazy wave and an edge that droops
    part('velvet').add(lathe([[0.86, 0.06], [1.3, 0.035], [1.8, -0.01], [2.12, -0.09], [2.16, -0.13], [2.08, -0.12], [1.75, -0.04], [1.25, 0.0], [0.86, 0.02]], 40,
      { shape: (a) => 1 + 0.05 * Math.sin(5 * a + 1) + 0.025 * Math.sin(9 * a), wave: (a, v) => (v > 0.2 && v < 0.8 ? -0.05 * Math.sin(3 * a + 0.5) : 0), uvScale: 0.5 }), trs(0, 0.02, 0, -7, 0, 0), felt);
    part('velvet').add(crookedCone(), trs(0, 0, 0, -7, 0, 0), felt);
    // satin band with a brass buckle at the front
    part('satin').add(lathe([[0.9, 0.11], [0.91, 0.36], [0.86, 0.38], [0.85, 0.12]], 30), trs(0, 0, 0, -7, 0, 0), [0.85, 0.32, 0.08]);
    const B = trs(0, 0.24, 0.9, -12, 0, 0);
    for (const [w, h, x, y] of [[0.34, 0.05, 0, 0.13], [0.34, 0.05, 0, -0.13], [0.05, 0.31, 0.15, 0], [0.05, 0.31, -0.15, 0]]) part('gold').add(box(w, h, 0.05), B.clone().mul(trs(x, y, 0)), [1, 0.78, 0.35]);
    part('gold').add(box(0.04, 0.26, 0.04), B.clone().mul(trs(0, 0, 0.02)), [1, 0.78, 0.35]); // the prong
  } else if (id === 'pumpkin') {
    // a squat, deeply ribbed pumpkin sitting over the crown of the head, its top sunk round the stem
    const rib = (a) => Math.abs(Math.cos(4 * a)) ** 0.55;
    const prof = [];
    for (let k = 0; k <= 14; k++) {
      const phi = ((60 + (120 * k) / 14) * Math.PI) / 180;
      prof.push([1.28 * Math.sin(phi) + (k === 14 ? 0 : 0.0), 0.12 - 1.12 * Math.cos(phi) - 0.16 * Math.exp(-(((180 - (60 + (120 * k) / 14)) / 22) ** 2))]);
    }
    part('rind').add(lathe(prof, 48, { shape: (a) => 0.86 + 0.14 * rib(a) }), null, (x, y, z) => {
      const a = Math.atan2(z, x), k = rib(a);
      return mix([0.62, 0.22, 0.03], [1, 0.5, 0.09], k).map((c) => c * (0.85 + 0.15 * Math.min(1, (y + 0.4) / 1.2)));
    });
    // inside the rim, darker flesh
    part('rind').add(lathe([[1.1, -0.43], [1.02, -0.4], [0.95, -0.3]], 32), null, [0.45, 0.2, 0.05]);
    // carved face: a dark cut edge round each hole, candle-light inside it
    const front = (y) => { const phi = Math.acos(Math.max(-1, Math.min(1, (0.12 - y) / 1.12))); return 1.28 * Math.sin(phi); };
    // (each piece sits on the rind where it is cut: turned to its own spot round the pumpkin)
    const carve = (outline, y, at = 0) => {
      const r0 = front(y), yaw = Math.asin(Math.max(-0.9, Math.min(0.9, at / r0))), r = r0 * (0.86 + 0.14 * rib(Math.PI / 2 - yaw));
      const M = trs(Math.sin(yaw) * r, y, Math.cos(yaw) * r, -8 * Math.sign(y - 0.12) * Math.min(1, Math.abs(y - 0.12) * 3), (yaw * 180) / Math.PI, 0);
      const local = outline.map(([x, yy]) => [x - at, yy]);
      part('matte').add(flat(local.map(([x, yy]) => [x * 1.25, yy * 1.25])), M.clone().mul(trs(0, 0, 0.022)), [0.12, 0.04, 0.01]);
      part('glow').add(flat(local), M.clone().mul(trs(0, 0, 0.03)), [1, 0.68, 0.22]);
    };
    for (const s of [-1, 1]) carve([[s * 0.4 - 0.17, 0.4], [s * 0.4 + 0.17, 0.4], [s * 0.4 + 0.02 * s, 0.67]].map(([x, y]) => [x, y - 0.5]), 0.5, s * 0.4); // eyes
    carve([[-0.07, -0.06], [0.07, -0.06], [0, 0.07]], 0.3); // nose
    const mouth = [[-0.5, 0.06], [-0.32, -0.05], [-0.16, 0.0], [0, -0.07], [0.16, 0.0], [0.32, -0.05], [0.5, 0.06]];
    for (let k = 0; k < 6; k++) carve([mouth[k], [mouth[k][0] * 0.72, -0.2], [mouth[k + 1][0] * 0.72, -0.2], mouth[k + 1]], 0.06, (mouth[k][0] + mouth[k + 1][0]) * 0.43);
    // a twisted, ridged stem and a curly tendril
    const stem = [[0, 0.95, 0], [0.03, 1.12, 0.01], [0.1, 1.28, 0.04], [0.24, 1.4, 0.06]];
    part('matte').add(lathe([[0.2, 0], [0.18, 0.08], [0.14, 0.2], [0.13, 0.32], [0.1, 0.42]], 10, { shape: (a, v) => 1 + 0.18 * Math.abs(Math.sin(3 * a + v * 3)) }), trs(0, 0.92, 0, 0, 0, -10), [0.36, 0.32, 0.16]);
    part('matte').add(tube(stem.slice(2), [0.1, 0.06], 6), null, [0.33, 0.3, 0.14]);
    const curl = [];
    for (let k = 0; k <= 24; k++) { const t = k / 24, a = t * Math.PI * 5; curl.push([-0.15 - t * 0.35 + Math.cos(a) * 0.12, 1.02 + Math.sin(a) * 0.12 + t * 0.1, Math.sin(a) * 0.05 - 0.1]); }
    part('matte').add(tube(curl, 0.025, 4), null, [0.3, 0.42, 0.14]);
    part('matte').add(lathe([[0, 0], [0.36, 0.03], [0.32, 0.08], [0, 0.06]], 8, { shape: (a) => 1 + 0.3 * Math.cos(3 * a) }), trs(0.38, 1.0, 0.05, 0, 0, -28), [0.26, 0.42, 0.14]); // leaf
  } else if (id === 'horns') {
    // ridged, glossy, crimson at the root going black at the tip, curling up and in
    for (const s of [-1, 1]) {
      const pts = [], rad = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        pts.push([s * (0.45 + t * 0.7 + t * t * 0.12 - t ** 4 * 0.45), -0.15 + t * 1.65 - t * t * 0.25, 0.35 - t * t * 0.75]);
        rad.push((0.38 * (1 - t) ** 1.1 + 0.02) * (1 + 0.08 * Math.sin(t * 46) * (1 - t)));
      }
      part('horn').add(tube(pts, rad, 12), null, (x, y) => mix([0.5, 0.05, 0.06], [0.06, 0.02, 0.02], Math.max(0, Math.min(1, (y + 0.05) / 1.05)) ** 1.4));
    }
  }
  return P;
}

/**
 * The vampire's cape, in the frame of the point it hangs from (the base of the neck; unit = metres of
 * the unscaled avatar). `fit`: { back, half, len }: how far behind that point the Bitmoji's back is,
 * half its shoulder width, and how far down the cape falls. Returns { sheet, collar }: the swinging
 * cape and the stiff collar, each split by material.
 */
export function capeParts(fit) {
  const { back, half, len } = fit;
  const black = [0.11, 0.07, 0.13], red = [0.55, 0.03, 0.06];
  // The cape: over the shoulders, close down the back, a little fuller at the hem, with soft folds and bat-wing points.
  const at = (inset) => (u, v) => {
    const s = u * 2 - 1, t = v;
    const hw = half + 0.06 + 0.15 * t ** 0.8;
    const zBack = t < 0.07 ? lerp(-0.08, back - 0.05, Math.sin((t / 0.07) * Math.PI / 2)) : lerp(back - 0.05, back - 0.075, (t - 0.07) / 0.93); // close, with room for a running back to bend
    const folds = Math.sin(s * Math.PI * 3.5 + 0.6) * 0.016 * Math.min(1, t * 2);
    const hem = t > 0.8 ? 0.06 * ((t - 0.8) / 0.2) * (1 - Math.abs(Math.cos((s + 1) * Math.PI * 2.5))) : 0;
    return [s * hw, -t * len - 0.045 * s * s * (1 - t) - hem, zBack + (0.045 + 0.03 * t) * s * s + folds + inset];
  };
  const S = { velvet: new Geo(), satin: new Geo() };
  S.velvet.add(sheet(at(0), 18, 16, [0, 0, -1], 1.4), null, black);
  S.satin.add(sheet(at(0.007), 18, 16, [0, 0, 1], 1.4), null, red);
  // The collar: stands up behind the head and flares out to two points.
  const collarAt = (inset) => (u, v) => {
    const s = u * 2 - 1, ang = s * 1.25, R = lerp(0.085, 0.24, v) - inset; // (its foot overlaps the cape's top)
    return [Math.sin(ang) * R, lerp(-0.05, 0.27, v) + 0.06 * s * s * v, -Math.cos(ang) * R - 0.02 - 0.06 * v];
  };
  const C = { velvet: new Geo(), satin: new Geo(), gold: new Geo() };
  C.velvet.add(sheet(collarAt(0), 14, 6, [0, 0.3, -1], 0.6), null, black);
  C.satin.add(sheet(collarAt(0.006), 14, 6, [0, -0.3, 1], 0.6), null, red);
  // A gold chain across the chest to a medallion with a blood-red stone.
  for (const s of [-1, 1]) C.gold.add(tube([[s * (half + 0.05), -0.05, -0.02], [s * (half * 0.6), -0.075, 0.08], [s * 0.03, -0.085, 0.125]], 0.007, 4), null, [1, 0.78, 0.35]);
  C.gold.add(lathe([[0, 0], [0.028, 0.002], [0.03, 0.008], [0.018, 0.012], [0, 0.012]], 14), trs(0, -0.09, 0.122, 90, 0, 0), [1, 0.78, 0.35]);
  C.satin.add(blob(0.013, 8, { squashY: 0.6 }), trs(0, -0.09, 0.136, 90, 0, 0), [0.7, 0.02, 0.05]);
  return { sheet: S, collar: C };
}

export const COSTUME_ICON = { witch: '🧙', pumpkin: '🎃', horns: '😈', cape: '🧛', none: '🙂' };
