// BitmojiPlayerController: moves the local player's Bitmoji from the joystick, relative to the
// camera (third person: turns to face where it walks; first person: faces the view and strafes),
// slides along walls, and picks the clip (idle / walk / run, knock at doors, a spook when hit).
// Sprint (its own button) bursts past any monster while stamina lasts; a giant gem makes the Bitmoji
// huge for a while. Movement is the device's own; only the resulting pose is shared, at 15 Hz.
import { GEMS, MOVE, POWERUPS, SLOW_MUL, SPRINT } from '../game/config.js';
import { PLAYER_R } from '../world/layout.js';
import { slide } from '../world/collide.js';

const D2R = Math.PI / 180;

export function createPlayer(avatar) {
  const p = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, lock: 0, hit: 0, ending: null, moving: false, stamina: 1, rest: 0, sprinting: false, scale: 1 };

  return {
    state: p,
    avatar,
    place(x, z, yaw) {
      Object.assign(p, { x, z, yaw, vx: 0, vz: 0, speed: 0, lock: 0, hit: 0, ending: null, stamina: 1, rest: 0, sprinting: false, scale: 1 });
      avatar.root.setLocalScale(1, 1, 1);
      avatar.root.setPosition(x, 0, z);
      avatar.root.setEulerAngles(0, yaw, 0);
      avatar.setAnim('idle', 1, 0);
    },
    /** Knocking: stop, face the door, rap on it. */
    knock(doorX, doorZ) {
      p.lock = 1.0;
      p.yaw = Math.atan2(doorX - p.x, doorZ - p.z) / D2R;
      p.vx = p.vz = 0;
      avatar.setAnim('knock', 1, 0.15);
    },
    spooked() { p.hit = 0.7; avatar.setAnim('hit', 1, 0.1); },
    /** Winner cheers, the rest sigh. */
    finish(won) { p.ending = won ? 'cheer' : 'sad'; p.vx = p.vz = 0; },
    /**
     * @param {number} dt
     * @param {{ x, y, mag }} move joystick
     * @param {*} cam camera controller (directions, mode)
     * @param {{ speed: boolean, slow: boolean, frozen: boolean, sprint: boolean, giant: boolean }} mods
     */
    update(dt, move, cam, mods) {
      const fp = cam.mode === 'first';
      let want = 0, dx = 0, dz = 0;
      const free = !mods.frozen && p.lock <= 0 && p.hit <= 0 && !p.ending;
      p.sprinting = free && mods.sprint && p.stamina > 0;
      if (free && (move.mag > 0 || p.sprinting)) {
        if (move.mag > 0) {
          const [fx, fz] = cam.forward(), [rx, rz] = cam.right();
          dx = fx * move.y + rx * move.x; dz = fz * move.y + rz * move.x;
        } else { // sprint with no direction given: straight ahead
          dx = Math.sin(p.yaw * D2R); dz = Math.cos(p.yaw * D2R);
        }
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        // A light push walks (a little faster the further you push), a full push runs, sprint bursts.
        const base = p.sprinting ? MOVE.run * SPRINT.mul : move.mag > 0.8 ? MOVE.run : MOVE.walk * (0.6 + 0.4 * Math.min(1, move.mag / 0.8));
        want = base * (mods.speed ? POWERUPS.speed.mul : 1) * (mods.slow ? SLOW_MUL : 1) * (mods.giant ? GEMS.giant.speed : 1);
      }
      // Stamina: drains while sprinting, refills after a breath.
      if (p.sprinting) { p.stamina = Math.max(0, p.stamina - dt / SPRINT.last); p.rest = SPRINT.breath; }
      else if ((p.rest -= dt) <= 0) p.stamina = Math.min(1, p.stamina + dt / SPRINT.refill);
      // Giant: grow (and shrink back) smoothly.
      const targetScale = mods.giant ? GEMS.giant.scale : 1;
      p.scale += (targetScale - p.scale) * Math.min(1, dt * 3);
      avatar.root.setLocalScale(p.scale, p.scale, p.scale);
      const tvx = dx * want, tvz = dz * want, a = Math.min(1, dt * MOVE.accel);
      p.vx += (tvx - p.vx) * a; p.vz += (tvz - p.vz) * a;
      [p.x, p.z] = slide(p.x + p.vx * dt, p.z + p.vz * dt, PLAYER_R);
      p.speed = Math.hypot(p.vx, p.vz);
      p.moving = p.speed > 0.3;
      if (fp) p.yaw = cam.yaw; // first person: the body faces the view
      else if (p.moving && want > 0) {
        const target = Math.atan2(p.vx, p.vz) / D2R;
        const d = ((((target - p.yaw) % 360) + 540) % 360) - 180;
        p.yaw += d * Math.min(1, dt * MOVE.turn);
      }
      p.lock -= dt;
      p.hit -= dt;
      // Clip: the knock and the spook play out; otherwise idle, walk or run by speed.
      if (p.ending) avatar.setAnim(p.ending);
      else if (p.lock > 0) avatar.setAnim('knock');
      else if (p.hit > 0) avatar.setAnim('hit');
      else if (p.speed < 0.35) avatar.setAnim('idle');
      else if (p.speed < MOVE.walk * 1.25 * p.scale) avatar.setAnim('walk', Math.max(0.5, p.speed / MOVE.walk / p.scale));
      else avatar.setAnim('run', Math.max(0.6, Math.min(1.9, p.speed / MOVE.run / Math.sqrt(p.scale))));
      avatar.root.setPosition(p.x, 0, p.z);
      avatar.root.setEulerAngles(0, p.yaw, 0);
      avatar.update(dt, p.speed);
      return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: Math.round(p.yaw), a: avatar.anim, s: +(p.speed / MOVE.run).toFixed(2), c: avatar.costume };
    },
  };
}
