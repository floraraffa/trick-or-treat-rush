// Touch and keyboard input. Left half of the screen: a floating joystick (a light push walks, a full
// push runs). Right half: drag to look around, pinch to zoom the third-person camera. Buttons are
// plain DOM buttons on top and never start a drag. Keyboard: WASD/arrows move (Shift runs), mouse
// drag looks, wheel zooms, E trick-or-treat, Space/F power-up, C camera.

export function createInput(el, { joy, knob }) {
  const state = {
    move: { x: 0, y: 0 }, // x right, y forward, length 0..1
    run: false,
    look: { dx: 0, dy: 0 }, // pixels since last read
    zoom: 0, // wheel / pinch since last read (positive = closer)
    lastLook: -1e9,
    pressed: new Set(), // one-shot actions: 'knock', 'use', 'camera'
  };
  const keys = new Set();
  let joyId = null, joyX = 0, joyY = 0;
  const looks = new Map();
  const R = 52; // joystick radius in CSS pixels

  const showJoy = (x, y) => {
    joy.style.left = `${x}px`; joy.style.top = `${y}px`;
    joy.classList.add('active');
  };
  const restJoy = () => {
    joy.classList.remove('active');
    joy.style.left = ''; joy.style.top = '';
    knob.style.transform = 'translate(-50%, -50%)';
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .ui-block')) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    const left = e.clientX < innerWidth * 0.45;
    if (left && joyId === null && e.pointerType !== 'mouse') {
      joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY;
      showJoy(joyX, joyY);
    } else if (left && joyId === null && e.pointerType === 'mouse' && e.button === 0 && e.altKey) {
      joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY; showJoy(joyX, joyY);
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - joyX, dy = e.clientY - joyY;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      state.move.x = dx / R; state.move.y = -dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const p = looks.get(e.pointerId);
    if (!p) return;
    if (looks.size === 2) { // pinch
      const [a, b] = [...looks.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const [c, d] = [...looks.values()];
      state.zoom += (Math.hypot(c.x - d.x, c.y - d.y) - before) * 0.02;
      return;
    }
    state.look.dx += e.clientX - p.x; state.look.dy += e.clientY - p.y;
    state.lastLook = performance.now();
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = (e) => {
    if (e.pointerId === joyId) { joyId = null; state.move.x = state.move.y = 0; restJoy(); }
    looks.delete(e.pointerId);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { state.zoom -= e.deltaY * 0.004; e.preventDefault(); }, { passive: false });

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') state.pressed.add('knock');
    if (e.code === 'Space' || e.code === 'KeyF') { state.pressed.add('use'); e.preventDefault(); }
    if (e.code === 'KeyC' || e.code === 'KeyV') state.pressed.add('camera');
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  return {
    state,
    /** Movement this frame: keyboard wins over the joystick when keys are held. */
    read() {
      const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
      const kx = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'), ky = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
        return { x: kx / l, y: ky / l, mag: run ? 1 : 0.55 };
      }
      const mag = Math.min(1, Math.hypot(state.move.x, state.move.y));
      return { x: state.move.x, y: state.move.y, mag: mag < 0.12 ? 0 : mag };
    },
    takeLook() { const l = { ...state.look }; state.look.dx = state.look.dy = 0; return l; },
    takeZoom() { const z = state.zoom; state.zoom = 0; return z; },
    take(action) { const had = state.pressed.has(action); state.pressed.delete(action); return had; },
    press(action) { state.pressed.add(action); },
    /** Seconds since the player last turned the camera by hand. */
    sinceLook() { return (performance.now() - state.lastLook) / 1000; },
    reset() { state.move.x = state.move.y = 0; joyId = null; looks.clear(); restJoy(); keys.clear(); state.pressed.clear(); },
  };
}
