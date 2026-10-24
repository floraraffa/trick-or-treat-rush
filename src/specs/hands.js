// Hands as the controller (Specs have no screen to touch and no gamepad): a pinch held and dragged is a
// joystick in the air (the pinch point is its centre, the hand's offset from it the push), and a quick pinch,
// let go without dragging, is the action button (trick or treat at a door, else the power-up). A pinch held
// still for a while is a second button (back to the menu after a night). Either hand works. Positions are read
// in the player's own space (metres round their head), not in the scaled world.
import { Vec3 } from 'playcanvas';

const DEAD = 0.012, FULL = 0.07; // metres of drag: nothing below DEAD, a full push at FULL
const TAP_TIME = 0.32, TAP_DRAG = 0.02; // a pinch shorter and stiller than this is a tap
const HOLD_TIME = 2; // a pinch held this long without dragging is a hold

/**
 * `app`: the PlayCanvas app (its XR input); `toUser(worldPos, out)`: world → the player's space.
 * Returns { update(dt), read() → { x, y, mag } (x right, y away from the player), take('action' | 'hold'),
 * held (0..1 of a hold under way), active, reset() }.
 */
export function createHands(app, toUser) {
  const pinches = new Map(); // input source → { start (user space, set on the first frame), now, t, dragged }
  const pressed = new Set();
  const tmp = new Vec3();
  let moving = null; // the pinch that steers

  const where = (src, out) => {
    const p = src.getOrigin?.() ?? src.getPosition?.();
    return p ? toUser(p, out) : null;
  };
  // The pinch point is taken on the next frame, not in the event: the hand's pose is fresh by then.
  app.xr.input.on('selectstart', (src) => pinches.set(src, { start: null, now: new Vec3(), t: 0, dragged: 0, held: false }));
  app.xr.input.on('selectend', (src) => {
    const s = pinches.get(src);
    pinches.delete(src);
    if (moving === src) moving = null;
    if (s && s.t < TAP_TIME && s.dragged < TAP_DRAG) pressed.add('action');
  });
  app.xr.input.on('remove', (src) => { pinches.delete(src); if (moving === src) moving = null; });

  return {
    /** Call once a frame: follows the pinching hands. */
    update(dt) {
      for (const [src, s] of pinches) {
        if (!where(src, tmp)) continue;
        if (!s.start) { s.start = tmp.clone(); s.now.copy(tmp); continue; }
        s.t += dt;
        s.now.copy(tmp);
        s.dragged = Math.max(s.dragged, Math.hypot(tmp.x - s.start.x, tmp.z - s.start.z));
        if (!moving && s.dragged > DEAD) moving = src; // the first hand to drag steers
        if (!s.held && s.t >= HOLD_TIME && s.dragged < TAP_DRAG) { s.held = true; pressed.add('hold'); }
      }
    },
    /** The joystick: x right, y away from the player, mag 0..1. */
    read() {
      const s = moving && pinches.get(moving);
      if (!s?.start) return { x: 0, y: 0, mag: 0 };
      const dx = s.now.x - s.start.x, dz = s.now.z - s.start.z, d = Math.hypot(dx, dz);
      if (d < DEAD) return { x: 0, y: 0, mag: 0 };
      const mag = Math.min(1, (d - DEAD) / (FULL - DEAD));
      return { x: dx / d, y: -dz / d, mag };
    },
    take(name) { const had = pressed.has(name); pressed.delete(name); return had; },
    /** How far a still pinch is towards a hold (0..1), for a ring that fills up. */
    get held() {
      let k = 0;
      for (const s of pinches.values()) if (s.start && !s.held && s.dragged < TAP_DRAG && s.t > TAP_TIME) k = Math.max(k, s.t / HOLD_TIME);
      return k;
    },
    get active() { return pinches.size > 0; },
    reset() { pinches.clear(); pressed.clear(); moving = null; },
  };
}
