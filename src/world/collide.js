// Collisions against the village's colliders (world/layout.js): circles for trees, lamps, graves and
// towers, turned boxes for houses, fences and railings. Players slide along them; the camera ray
// stops short of them. No physics engine: this is all a phone needs for a walkable village.
import { COLLIDERS, MAP_R } from './layout.js';

const D2R = Math.PI / 180;
for (const c of COLLIDERS) if (c.kind === 'box') { c.cos = Math.cos(c.yaw * D2R); c.sin = Math.sin(c.yaw * D2R); }

/** Pushes a circle at (x, z) of radius r out of every collider; returns [x, z]. */
export function slide(x, z, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of COLLIDERS) {
      const dx = x - c.x, dz = z - c.z;
      if (c.kind === 'circle') {
        const min = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1e-4;
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
        continue;
      }
      // Box: into its frame (inverse turn), push out along the shallowest side, back out.
      if (Math.abs(dx) > c.hx + c.hz + r + 0.5 || Math.abs(dz) > c.hx + c.hz + r + 0.5) continue;
      const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      const px = c.hx + r - Math.abs(lx), pz = c.hz + r - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      let nx = lx, nz = lz;
      if (px < pz) nx = Math.sign(lx || 1) * (c.hx + r); else nz = Math.sign(lz || 1) * (c.hz + r);
      x = c.x + nx * c.cos + nz * c.sin;
      z = c.z - nx * c.sin + nz * c.cos;
    }
  }
  const d = Math.hypot(x, z), lim = MAP_R - r;
  if (d > lim) { x *= lim / d; z *= lim / d; }
  return [x, z];
}

/**
 * Distance along a ray (origin o, unit direction dir, both [x, y, z]) to the first collider, or
 * `max`. Colliders are treated as solids from the ground up to their height. `big: true` keeps only
 * the ones that can hide a player (walls, towers), `big: false` only the thin ones (trunks, lamps, graves).
 */
export function raycast(o, dir, max, { big = null } = {}) {
  let best = max;
  for (const c of COLLIDERS) {
    if (big !== null && (c.kind === 'circle' ? c.r >= 0.9 : c.h >= 2.2) !== big) continue;
    if (c.kind === 'circle') {
      // ray against a vertical cylinder: solve in XZ, then check the height
      const ox = o[0] - c.x, oz = o[2] - c.z;
      const a = dir[0] * dir[0] + dir[2] * dir[2];
      if (a < 1e-8) continue;
      const b = ox * dir[0] + oz * dir[2], cc = ox * ox + oz * oz - c.r * c.r;
      const disc = b * b - a * cc;
      if (disc < 0) continue;
      const t = (-b - Math.sqrt(disc)) / a;
      if (t > 0 && t < best) { const y = o[1] + dir[1] * t; if (y >= 0 && y <= c.h) best = t; }
      continue;
    }
    // ray against a turned box (slab test in the box's frame)
    const ox = o[0] - c.x, oz = o[2] - c.z;
    const lo = [ox * c.cos - oz * c.sin, o[1] - c.h / 2, ox * c.sin + oz * c.cos];
    const ld = [dir[0] * c.cos - dir[2] * c.sin, dir[1], dir[0] * c.sin + dir[2] * c.cos];
    const half = [c.hx, c.h / 2, c.hz];
    let t0 = 0, t1 = best;
    let hit = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(ld[k]) < 1e-8) { if (Math.abs(lo[k]) > half[k]) { hit = false; break; } continue; }
      let ta = (-half[k] - lo[k]) / ld[k], tb = (half[k] - lo[k]) / ld[k];
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit && t0 > 0 && t0 < best) best = t0;
  }
  return best;
}
