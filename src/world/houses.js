// The eight haunted houses, built from their plans in layout.js: tall, narrow and crooked, floors
// stacked off-true and twisting, steep spires with curling tips, bent chimneys, uneven glowing
// windows, an oversized arched door (a separate, hinged entity so it can swing open) and lopsided
// porch steps. Static parts go into the village batches: one draw call per material for all eight.
import { Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, box, cylinder, trs } from '../geo.js';
import { rng } from '../rng.js';
import { archOutline, circleOutline, extrude, flat, gableRoof, lathe, spireRoof, tube } from './shapes.js';
import { PAL } from './layout.js';

const dark = (c, k) => c.map((v) => v * k);
const WOOD_UV = 0.45, SHINGLE_UV = 0.55;

/** Window outline of a kind, centred on its middle. */
function windowOutline(kind, w, h) {
  if (kind === 'round') return circleOutline(w / 2, 14).map(([x, y]) => [x, y]);
  if (kind === 'rect') return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return archOutline(w, h, { point: kind === 'point' ? 0.6 : 0 }).map(([x, y]) => [x, y - h / 2]);
}

/** A window on a face whose frame is `M` (local XY = the wall, +Z out of it). */
function addWindow(B, R, M, cx, cy, w, h, { kind = 'rect', lit = true, roll = 0, trim, shutters = null }) {
  const at = M.clone().mul(trs(cx, cy, 0, 0, 0, roll));
  const outline = windowOutline(kind, w, h);
  const frame = windowOutline(kind, w + 0.22, h + 0.22);
  B.get('plain').add(extrude(frame, 0.12), at, dark(trim, 0.55));
  const warm = lit ? [1, 0.82 + R() * 0.15, 0.55 + R() * 0.25] : [0.07, 0.06, 0.13];
  B.get('glow').add(flat(outline), at.clone().mul(trs(0, 0, 0.065)), warm);
  if (kind !== 'round') B.get('plain').add(box(w + 0.34, 0.08, 0.22), at.clone().mul(trs(0, -h / 2 - 0.1, 0.06)), trim); // sill
  if (shutters) {
    for (const s of [-1, 1]) {
      B.get('wood').add(box(w * 0.5, h * 1.02, 0.05, WOOD_UV), at.clone().mul(trs(s * (w * 0.5 + 0.18), 0, 0.05, 0, 0, s * (4 + R() * 8))), shutters);
    }
  }
}

/** Curly spire tip: a tapering tube rising from the apex and rolling over to one side. */
function curlTip(B, M, apex, dirX, color, R) {
  const pts = [], rad = [];
  const turns = 0.9 + R() * 0.4, n = 9;
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = t * turns * Math.PI;
    pts.push([apex[0] + dirX * (1 - Math.cos(a)) * 0.55, apex[1] + Math.sin(a) * 0.75 + t * 0.15, apex[2]]);
    rad.push(0.16 * (1 - t) + 0.025);
  }
  B.get('plain').add(tube(pts, rad, 8), M, color);
  const end = pts[n];
  B.get('glow').add(lathe([[0, -0.09], [0.08, -0.04], [0.08, 0.04], [0, 0.09]], 8), M.clone().mul(trs(end[0], end[1], end[2])), [0.7, 0.9, 1]); // a little lit bauble
}

/**
 * Builds one house into the batches B; returns { root, door, lamp, inside } for animation: the door
 * swings on its hinge, the porch lamp tells everyone whether the house can be visited.
 */
export function buildHouse(app, h, B) {
  const R = rng(h.seed);
  const H = trs(h.x, 0, h.z, 0, h.yaw, 0);
  const wall = h.wall, trim = h.trim, roofC = h.roofColor;
  const doorX = (R() > 0.5 ? 1 : -1) * (0.25 + R() * 0.4);
  const stepTop = 0.45;

  // Stone footing so the crooked house sits on something.
  B.get('masonry').add(box(h.w + 0.3, 0.5, h.d + 0.3, 0.6), H.clone().mul(trs(0, 0.2, 0)), [0.42, 0.38, 0.46]);

  let top = null;
  h.floors.forEach((f, i) => {
    const M = H.clone().mul(trs(f.x, f.y + (i === 0 ? 0.4 : 0), f.z, f.rx, f.yaw, f.rz));
    const fh = f.h - (i === 0 ? 0.4 : 0);
    B.get('wood').add(box(f.w, fh, f.d, WOOD_UV), M.clone().mul(trs(0, fh / 2, 0)), wall);
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      B.get('plain').add(box(0.18, fh, 0.18), M.clone().mul(trs(cx * f.w / 2, fh / 2, cz * f.d / 2)), trim);
    }
    // Cornice: a jutting band under the next floor.
    B.get('plain').add(box(f.w + 0.32, 0.2, f.d + 0.32), M.clone().mul(trs(0, fh - 0.02, 0)), dark(roofC, 1.4));
    // Windows on all four sides, uneven sizes and slightly rolled.
    const faces = [
      { M: M.clone().mul(trs(0, 0, f.d / 2)), w: f.w, n: i === 0 ? 1 : 1 + Math.floor(R() * 2.4) },
      { M: M.clone().mul(trs(f.w / 2, 0, 0, 0, 90, 0)), w: f.d, n: 1 + Math.floor(R() * 1.6) },
      { M: M.clone().mul(trs(-f.w / 2, 0, 0, 0, -90, 0)), w: f.d, n: 1 + Math.floor(R() * 1.6) },
      { M: M.clone().mul(trs(0, 0, -f.d / 2, 0, 180, 0)), w: f.w, n: 1 },
    ];
    faces.forEach((face, fi) => {
      const slots = face.n;
      for (let s = 0; s < slots; s++) {
        let cx = (s + 0.5) / slots * face.w - face.w / 2 + (R() - 0.5) * 0.3;
        if (i === 0 && fi === 0) cx = -doorX * 1.0 - Math.sign(doorX) * 0.9; // beside the door
        const kind = ['rect', 'arch', 'point', 'rect', 'round', 'arch'][Math.floor(R() * 6)];
        const ww = kind === 'round' ? 0.8 + R() * 0.3 : 0.55 + R() * 0.4, hh = kind === 'round' ? ww : 0.9 + R() * 0.65;
        const cy = i === 0 ? fh * 0.6 : fh * (0.48 + R() * 0.1);
        addWindow(B, R, face.M, cx, cy, ww, hh, {
          kind, lit: R() < 0.72, roll: (R() - 0.5) * 14, trim,
          shutters: kind !== 'round' && R() < 0.35 ? (R() > 0.5 ? PAL.rose : dark(trim, 0.7)) : null,
        });
      }
    });
    top = { M, f, fh };
  });

  // Roof on the top floor: a crooked spire or a steep sagging gable facing the street.
  const { M: TM, f: tf, fh: tfh } = top;
  const roofM = TM.clone().mul(trs(0, tfh + 0.08, 0));
  if (h.roof.type === 'spire') {
    B.get('shingle').add(spireRoof(tf.w + 0.7, tf.d + 0.7, h.roof.h, h.roof.ax, h.roof.az), roofM, roofC);
    if (h.roof.curl) curlTip(B, roofM, [h.roof.ax, h.roof.h - 0.05, h.roof.az], h.roof.ax > 0 ? 1 : -1, dark(roofC, 1.2), R);
    else B.get('glossy').add(tube([[h.roof.ax, h.roof.h - 0.1, h.roof.az], [h.roof.ax, h.roof.h + 0.9, h.roof.az]], 0.035, 6), roofM, PAL.iron); // finial
  } else {
    const gM = roofM.clone().mul(trs(0, 0, 0, 0, -90, 0));
    B.get('shingle').add(gableRoof(tf.d + 0.8, tf.w + 0.6, h.roof.h, 0.45), gM, roofC);
    addWindow(B, R, roofM.clone().mul(trs(0, 0, (tf.d + 0.8) / 2 - 0.02)), 0, h.roof.h * 0.36, 0.95, 0.95, { kind: 'round', lit: true, roll: 0, trim });
  }
  // A bent chimney leaning out of the roof.
  {
    const cx = (R() > 0.5 ? 1 : -1) * tf.w * 0.28, cz = -tf.d * 0.22, lean = (R() - 0.5) * 1.6;
    const pts = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([cx + lean * t * t, tfh + 0.3 + t * (h.roof.h * 0.55 + 1.6), cz + Math.sin(t * 2.5) * 0.3]); }
    pts.push([pts[5][0] + lean * 0.05, pts[5][1] + 0.05, pts[5][2]], [pts[5][0] + lean * 0.06, pts[5][1] + 0.3, pts[5][2]]);
    B.get('masonry').add(tube(pts, [0.32, 0.32, 0.31, 0.3, 0.29, 0.28, 0.4, 0.4], 8, { uvScale: 0.7 }), TM, [0.45, 0.3, 0.32]);
  }

  // Side tower with a witch-hat roof.
  if (h.tower) {
    const t = h.tower, tx = t.side * (h.w / 2 + 0.2), tz = h.d / 2 - 0.6;
    const TMt = H.clone().mul(trs(tx, 0, tz));
    B.get('wood').add(cylinder(t.r, t.r * 0.92, t.h, 14, { uvScale: WOOD_UV }), TMt, dark(wall, 0.85));
    B.get('plain').add(cylinder(t.r + 0.14, t.r + 0.14, 0.22, 14), TMt.clone().mul(trs(0, t.h - 0.1, 0)), dark(roofC, 1.4));
    for (let k = 0; k < 3; k++) {
      const y = 1.6 + k * (t.h - 2.2) / 2.5;
      if (y > t.h - 0.8) break;
      const a = (R() - 0.5) * 50;
      const fM = TMt.clone().mul(trs(0, 0, 0, 0, a, 0)).mul(trs(0, 0, t.r * 0.94));
      addWindow(B, R, fM, 0, y, 0.5, 0.8, { kind: k % 2 ? 'round' : 'point', lit: R() < 0.8, roll: (R() - 0.5) * 10, trim });
    }
    const hatH = 3.2 + R() * 1.4, brim = t.r + 0.35;
    const prof = [[brim, 0], [brim * 0.82, 0.25]];
    for (let k = 1; k <= 8; k++) { const s = k / 8; prof.push([brim * 0.82 * Math.pow(1 - s, 1.6) + 0.02, 0.25 + s * hatH]); }
    B.get('shingle').add(lathe(prof, 14, { uvScale: SHINGLE_UV }), TMt.clone().mul(trs(0, t.h, 0)), roofC);
    curlTip(B, TMt, [0, t.h + hatH + 0.2, 0], -t.side, dark(roofC, 1.2), R);
  }

  // Porch: lopsided steps, a crooked little canopy on two posts, the door frame and the warm hall behind.
  const front = h.d / 2;
  for (let k = 0; k < 3; k++) {
    const sw = h.door.w + 0.9 - k * 0.12 + R() * 0.2, top = stepTop - k * 0.15;
    B.get('stone').add(box(sw, top, 0.42, 0.8), H.clone().mul(trs(doorX + (R() - 0.5) * 0.25, top / 2, front + 0.22 + k * 0.38, 0, (R() - 0.5) * 9, 0)), [0.55, 0.5, 0.58]);
  }
  const dw = h.door.w, dh = Math.min(h.door.h, h.floors[0].h - stepTop - 0.3);
  const DM = H.clone().mul(trs(doorX, stepTop, front));
  B.get('plain').add(extrude(archOutline(dw + 0.42, dh + 0.24, { point: 0.25 }), 0.16), DM.clone().mul(trs(0, -0.02, 0.02)), dark(trim, 0.8));
  B.get('glow').add(flat(archOutline(dw, dh, { point: 0.25 })), DM.clone().mul(trs(0, 0, 0.105)), [1, 0.62, 0.3]); // lit hall seen through the open door
  const canopy = H.clone().mul(trs(doorX, stepTop + dh + 0.35, front + 0.55, 18, 0, (R() - 0.5) * 8));
  B.get('shingle').add(box(dw + 1.1, 0.12, 1.3, SHINGLE_UV), canopy, roofC);
  for (const s of [-1, 1]) {
    B.get('plain').add(tube([[doorX + s * (dw / 2 + 0.38), 0.1, front + 1.05], [doorX + s * (dw / 2 + 0.33 + 0.08 * s), stepTop + dh * 0.55, front + 1.08], [doorX + s * (dw / 2 + 0.4), stepTop + dh + 0.18, front + 1.1]], 0.07, 6), H, trim);
  }

  // The door: an entity of its own, hinged on its left edge (local x = 0).
  const root = new Entity(`house-${h.id}`);
  root.setLocalPosition(h.x, 0, h.z);
  root.setLocalEulerAngles(0, h.yaw, 0);
  const hinge = new Entity(`door-${h.id}`);
  hinge.setLocalPosition(doorX - dw / 2, stepTop, front + 0.14);
  root.addChild(hinge);
  const doorMat = makeDoorMaterial(app);
  const panel = new Geo();
  panel.add(extrude(archOutline(dw, dh, { point: 0.25 }), 0.09), trs(dw / 2, 0, 0), h.doorColor);
  for (const y of [0.55, dh * 0.62]) panel.add(box(dw * 0.96, 0.08, 0.11), trs(dw / 2, y, 0), [0.12, 0.1, 0.1]); // iron straps
  panel.add(tube(circleOutline(0.11, 10).concat([[0.11, 0]]).map(([x, y]) => [dw * 0.5 + x, dh * 0.5 + y, 0.09]), 0.022, 5, { caps: false }), null, PAL.gold); // knocker ring
  panel.add(cylinder(0.05, 0.05, 0.08, 8), trs(dw * 0.85, dh * 0.42, 0.04, 90, 0, 0), PAL.gold); // knob
  const door = panel.build(app.graphicsDevice, doorMat, `door-panel-${h.id}`);
  door.render.castShadows = true;
  hinge.addChild(door);

  // Porch lamp: its own material, so it can glow gold (open) or sulk violet (cooling down).
  const lampMat = new StandardMaterial();
  lampMat.diffuse = new Color(0.1, 0.08, 0.06);
  lampMat.emissive = new Color(1, 0.75, 0.35);
  lampMat.emissiveIntensity = 2.2;
  lampMat.update();
  const lampGeo = new Geo();
  lampGeo.add(lathe([[0, 0], [0.13, 0.05], [0.16, 0.24], [0.12, 0.42], [0, 0.48]], 10), null, [1, 1, 1]);
  const lamp = lampGeo.build(app.graphicsDevice, lampMat, `porch-lamp-${h.id}`);
  const lx = doorX + (doorX > 0 ? -1 : 1) * (dw / 2 + 0.55);
  lamp.setLocalPosition(lx, stepTop + dh * 0.68, front + 0.22);
  root.addChild(lamp);
  B.get('glossy').add(box(0.06, 0.06, 0.24), H.clone().mul(trs(lx, stepTop + dh * 0.68 + 0.5, front + 0.12)), PAL.iron); // bracket

  return { root, hinge, lamp, lampMat, doorX, open: 0 };
}

function makeDoorMaterial(app) {
  const m = new StandardMaterial();
  m.diffuseVertexColor = true;
  m.diffuse = new Color(1, 1, 1);
  m.gloss = 0.3;
  m.useMetalness = true;
  m.metalness = 0;
  m.update();
  return m;
}

