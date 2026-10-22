// CameraModeController: a GTA-style follow camera with two modes, local to each player (never sent
// over the network). Third person: behind and a little above the Bitmoji, orbiting with the right-hand
// drag, drifting back behind the player while they move, pulled in so walls and trees never block
// the view. First person: at the Bitmoji's eye height, looking where the drag points; the body
// hides from its own camera. The switch blends both views over a quarter second; the player, the
// score and the session are untouched.
import { Vec3 } from 'playcanvas';
import { raycast } from './world/collide.js';
import { EYE_HEIGHT } from './actors/avatar.js';

const D2R = Math.PI / 180;
export const CAMERA = {
  distance: 4.4, minDistance: 2.4, maxDistance: 7, // third person, configurable (pinch / wheel)
  pivot: 1.85, // looks just over the head: the Bitmoji sits low in the frame, the street ahead stays in view
  pitch: 16, minPitch: -10, maxPitch: 58,
  fpMinPitch: -65, fpMaxPitch: 70,
  sensitivity: 0.26, // degrees per pixel dragged
  recentre: 1.8, // how fast the camera swings back behind a moving player
  blend: 0.28, fovThird: 60, fovFirst: 72,
};

const smooth = (t) => t * t * (3 - 2 * t);

export function createCameraController(cameraEntity, { distance = CAMERA.distance } = {}) {
  const st = {
    mode: 'third', yaw: 0, pitch: CAMERA.pitch, dist: distance, wantDist: distance, curDist: distance,
    blend: 0, // 0 third .. 1 first
    shake: 0, bob: 0,
  };
  const pos = new Vec3(), target = new Vec3();
  const third = { p: new Vec3(), t: new Vec3() }, first = { p: new Vec3(), t: new Vec3() };

  return {
    get mode() { return st.mode; },
    get yaw() { return st.yaw; },
    /** Camera-relative directions on the ground, for movement. */
    forward() { return [Math.sin(st.yaw * D2R), Math.cos(st.yaw * D2R)]; },
    right() { return [-Math.cos(st.yaw * D2R), Math.sin(st.yaw * D2R)]; },
    /** True while the Bitmoji should be hidden from this camera. */
    get hideBody() { return st.blend > 0.55; },
    toggle() {
      st.mode = st.mode === 'third' ? 'first' : 'third';
      if (st.mode === 'third') st.pitch = Math.max(CAMERA.minPitch + 4, Math.min(CAMERA.maxPitch, st.pitch < 4 ? CAMERA.pitch : st.pitch));
      return st.mode;
    },
    setMode(m) { if (m !== st.mode) this.toggle(); st.blend = m === 'first' ? 1 : 0; },
    /** Puts the camera straight behind a player facing `yaw` (spawns, restarts). */
    snapBehind(yaw) { st.yaw = yaw; st.pitch = st.mode === 'first' ? 0 : CAMERA.pitch; },
    shake(amount) { st.shake = Math.max(st.shake, amount); },

    /**
     * @param {number} dt
     * @param {{ x, z, yaw, speed, moving }} pl the local player
     * @param {{ dx, dy }} look dragged pixels; `zoom` pinch/wheel; `sinceLook` seconds since the last drag
     */
    update(dt, pl, look, zoom, sinceLook) {
      const fp = st.mode === 'first';
      st.yaw -= look.dx * CAMERA.sensitivity;
      st.pitch += look.dy * CAMERA.sensitivity * 0.8;
      st.pitch = fp ? Math.max(CAMERA.fpMinPitch, Math.min(CAMERA.fpMaxPitch, st.pitch)) : Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, st.pitch));
      st.wantDist = Math.max(CAMERA.minDistance, Math.min(CAMERA.maxDistance, st.wantDist - zoom));
      // Third person drifts back behind a moving player once the thumb has let go of the view.
      if (!fp && pl.moving && sinceLook > 1.1) {
        const d = ((((pl.yaw - st.yaw) % 360) + 540) % 360) - 180;
        st.yaw += d * Math.min(1, dt * CAMERA.recentre * Math.min(1, pl.speed / 3));
      }
      st.blend += (fp ? 1 : -1) * dt / CAMERA.blend;
      st.blend = Math.max(0, Math.min(1, st.blend));

      const cy = Math.cos(st.pitch * D2R), sy = Math.sin(st.pitch * D2R);
      const fx = Math.sin(st.yaw * D2R) * cy, fz = Math.cos(st.yaw * D2R) * cy, fy = -sy;
      // Third person: from the shoulders back along the view; stop short of anything solid.
      const px = pl.x, py = CAMERA.pivot, pz = pl.z;
      // Walls pull the camera right in; a trunk or lamp post only as far as a shoulder view (if the
      // camera ends up inside a trunk, its inner faces aren't drawn, so the view stays clear).
      const o = [px, py, pz], back = [-fx, -fy, -fz];
      const wall = raycast(o, back, st.wantDist + 0.3, { big: true }), thin = raycast(o, back, st.wantDist + 0.3, { big: false });
      const allowed = Math.max(0.7, Math.min(st.wantDist, wall - 0.3, Math.max(2.2, thin - 0.3)));
      st.curDist += (allowed - st.curDist) * Math.min(1, dt * (allowed < st.curDist ? 18 : 3)); // snap in, ease out
      third.p.set(px - fx * st.curDist, Math.max(0.35, py - fy * st.curDist), pz - fz * st.curDist);
      third.t.set(px, py, pz);
      // First person: at the eyes, a touch forward of the face, with a gentle walking bob.
      st.bob += dt * (pl.speed > 0.3 ? 2 + pl.speed * 1.4 : 0);
      const bob = pl.speed > 0.3 ? Math.sin(st.bob * Math.PI) * 0.025 * Math.min(1, pl.speed / 3) : 0;
      const hx = Math.sin(pl.yaw * D2R), hz = Math.cos(pl.yaw * D2R);
      first.p.set(pl.x + hx * 0.14, EYE_HEIGHT + bob, pl.z + hz * 0.14);
      first.t.set(first.p.x + fx * 6, first.p.y + fy * 6, first.p.z + fz * 6);

      const b = smooth(st.blend);
      pos.lerp(third.p, first.p, b);
      target.lerp(third.t, first.t, b);
      if (st.shake > 0) {
        st.shake = Math.max(0, st.shake - dt * 2.5);
        const s = st.shake * 0.12;
        pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s;
      }
      cameraEntity.setPosition(pos);
      cameraEntity.lookAt(target);
      cameraEntity.camera.fov = CAMERA.fovThird + (CAMERA.fovFirst - CAMERA.fovThird) * b;
      cameraEntity.camera.nearClip = 0.1 - 0.06 * b;
    },
  };
}
