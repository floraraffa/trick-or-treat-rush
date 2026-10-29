// BitmojiPlayerController: moves the local player's Bitmoji from the joystick, relative to the
// camera (third person: turns to face where it walks; first person: faces the view and strafes),
// slides along walls, and picks the clip (idle / walk / run, knock at doors, a spook when hit).
// Keep going the same way and it breaks into a full run on its own (faster than any monster); a
// giant gem makes the Bitmoji huge for a while, a ghost gem lets it float through walls. In the nights the
// reflexes skill makes it leap clear of a monster about to grab it (`dodge`).
// Movement is the device's own; only the resulting pose is shared, at 15 Hz.
import { AUTORUN, GEMS, MOVE, SKILL, SLOW_MUL } from '../game/config.js';
import { MAP_R, PLAYER_R } from '../world/layout.js';
import { slide } from '../world/collide.js';

const D2R = Math.PI / 180;

export function createPlayer(avatar) {
  // run: seconds spent going the same way; dir: that way (degrees); boost: 0..1 how far into the run.
  const p = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, lock: 0, hit: 0, ending: null, moving: false, run: 0, dir: 0, boost: 0, sprinting: false, scale: 1, dodge: 0, dodgeDir: [0, 1] };

  return {
    state: p,
    avatar,
    place(x, z, yaw) {
      Object.assign(p, { x, z, yaw, vx: 0, vz: 0, speed: 0, lock: 0, hit: 0, ending: null, run: 0, dir: yaw, boost: 0, sprinting: false, scale: 1, dodge: 0 });
      avatar.root.setLocalScale(1, 1, 1);
      avatar.setGhost(false);
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
    /** A leap clear (the reflexes skill): this way (a direction on the ground), fast, whatever the joystick says. */
    dodge(dx, dz) { const l = Math.hypot(dx, dz) || 1; p.dodge = SKILL.dodge.dur; p.dodgeDir = [dx / l, dz / l]; },
    /** Winner cheers, the rest sigh. */
    finish(won) { p.ending = won ? 'cheer' : 'sad'; p.vx = p.vz = 0; },
    /**
     * @param {number} dt
     * @param {{ x, y, mag }} move joystick
     * @param {*} cam camera controller (directions, mode)
     * @param {{ slow: boolean, frozen: boolean, giant: boolean, ghost: boolean }} mods
     */
    update(dt, move, cam, mods) {
      const fp = cam.mode === 'first';
      let want = 0, dx = 0, dz = 0;
      const free = !mods.frozen && p.lock <= 0 && p.hit <= 0 && !p.ending;
      if (free && move.mag > 0) {
        const [fx, fz] = cam.forward(), [rx, rz] = cam.right();
        dx = fx * move.y + rx * move.x; dz = fz * move.y + rz * move.x;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        // Running on its own: the clock runs while the heading holds; a sharp turn starts it again.
        const heading = Math.atan2(dx, dz) / D2R;
        if (p.run === 0 || Math.abs(((((heading - p.dir) % 360) + 540) % 360) - 180) > AUTORUN.turn) { p.run = 0; p.dir = heading; }
        p.run += dt;
        p.dir += ((((heading - p.dir) % 360) + 540) % 360 - 180) * Math.min(1, dt * 4); // the way you're going, smoothed
      } else p.run = 0;
      const into = Math.min(1, Math.max(0, (p.run - AUTORUN.after) / AUTORUN.ramp));
      p.boost = into > p.boost ? into : Math.max(into, p.boost - dt * 4);
      p.sprinting = p.boost > 0.5;
      p.ghost = !!mods.ghost;
      if (free && move.mag > 0) {
        // A light push walks (a little faster the further you push), a full push runs; keep going and it speeds up by itself.
        const pace = move.mag > 0.8 ? MOVE.run : MOVE.walk * (0.6 + 0.4 * Math.min(1, move.mag / 0.8));
        const base = pace + (MOVE.run * AUTORUN.mul - pace) * p.boost;
        want = base * (mods.slow ? SLOW_MUL : 1) * (mods.giant ? GEMS.giant.speed : 1) * (mods.ghost ? GEMS.ghost.speed : 1);
      }
      // Giant: grow (and shrink back) smoothly.
      const targetScale = mods.giant ? GEMS.giant.scale : 1;
      p.scale += (targetScale - p.scale) * Math.min(1, dt * 3);
      avatar.root.setLocalScale(p.scale, p.scale, p.scale);
      let tvx = dx * want, tvz = dz * want, a = Math.min(1, dt * MOVE.accel);
      if (p.dodge > 0) { // a leap clear: straight away, at once
        p.dodge -= dt;
        if (!mods.frozen && !p.ending) { want = MOVE.run * SKILL.dodge.speed; tvx = p.dodgeDir[0] * want; tvz = p.dodgeDir[1] * want; a = 1; }
      }
      p.vx += (tvx - p.vx) * a; p.vz += (tvz - p.vz) * a;
      if (mods.ghost) { // through walls, fences and trees, but not out of the village
        p.x += p.vx * dt; p.z += p.vz * dt;
        const d = Math.hypot(p.x, p.z), lim = MAP_R - PLAYER_R;
        if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
      } else if (mods.giant) [p.x, p.z] = slide(p.x + p.vx * dt, p.z + p.vz * dt, PLAYER_R, { big: true }); // a giant steps over trees, lamps, fences and graves
      else [p.x, p.z] = slide(p.x + p.vx * dt, p.z + p.vz * dt, PLAYER_R);
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
