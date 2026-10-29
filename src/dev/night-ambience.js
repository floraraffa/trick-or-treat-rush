// The Spectacles Lens's night ambience, under everything (it loops): drawn sample by sample, so the same seed
// always gives the same sound, in the browser or in Node. Everything is laid on a ring of the loop's length
// (what runs past the end comes back in at the start, filters run round it twice), so it loops without a seam.
// Quiet on purpose: the crickets are far off, well under the rest (a first version, crickets close by, was
// too loud; the wind before it, a hiss).
//   soft    a soft breath of air, crickets far off, now and then an owl (the default)
//   far     hardly more than crickets far away, an owl farther still
//   chimes  a breath of air, crickets far off, a few soft chimes on a porch
//   marsh   a breath of air, crickets far off, frogs croaking by a pond
import { rng } from '../rng.js';

export const AMBIENCES = ['soft', 'far', 'chimes', 'marsh'];
export const AMBIENCE = 'soft';

/** A loop of `seconds` (Float32Array at `rate`). */
export function nightAmbience(kind = AMBIENCE, { rate = 22050, seconds = 24, seed = 7 } = {}) {
  const N = Math.round(rate * seconds), R = rng(seed), TAU = Math.PI * 2, L = N / rate;
  const ring = () => new Float32Array(N);
  const add = (buf, i, v) => { buf[((i % N) + N) % N] += v; };
  /** A slow swell that comes round a whole number of times in the loop (k: how many). */
  const swell = (t, k, ph = 0) => 0.5 + 0.5 * Math.sin((TAU * k * t) / L + ph);
  /** A two-pole filter (band or low pass) run round the ring twice: the second lap has no seam. */
  const filter = (src, f, q, type) => {
    const w = (TAU * f) / rate, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
    const [b0, b1, b2] = type === 'band' ? [al / a0, 0, -al / a0] : [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0];
    const a1 = (-2 * c) / a0, a2 = (1 - al) / a0, y = ring();
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let lap = 0; lap < 2; lap++) for (let i = 0; i < N; i++) {
      const x = src[i], v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  const white = () => Float32Array.from({ length: N }, () => R() * 2 - 1);
  const rms = (b) => { let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / N) || 1; };
  /** A tone into buf from t0 (s): f(u) its pitch, env(u) its loudness, partials [ratio, gain]. */
  const tone = (buf, t0, dur, f, env, partials = [[1, 1]]) => {
    const i0 = Math.round(t0 * rate), n = Math.round(dur * rate), ph = partials.map(() => 0);
    for (let i = 0; i < n; i++) {
      const u = i / rate, e = env(u);
      let v = 0;
      partials.forEach(([r, g], k) => { ph[k] += (TAU * f(u) * r) / rate; v += g * Math.sin(ph[k]); });
      add(buf, i0 + i, v * e);
    }
  };
  /** Soft at both ends: a rise of `a` s, a fall of `r` s. */
  const ar = (dur, a, r) => (u) => Math.max(0, Math.min(1, u / a, (dur - u) / r));

  // The parts, each at a loudness of its own (RMS of the finished loop; the Lens plays it at 0.45).
  /** A breath of air: low, rounded noise (nothing above a few hundred hertz: no hiss), slowly swelling. */
  const breeze = (level) => {
    const b = filter(filter(white(), 330, 0.6, 'band'), 650, 0.7, 'low'), k = level / rms(b);
    return b.map((v, i) => v * k * (0.45 + 0.55 * swell(i / rate, 2) * swell(i / rate, 3, 1.3)));
  };
  /** Crickets far off: a few soft, slow chirps each (round pulses, no clicks), coming and going. */
  const crickets = (level) => {
    const b = ring();
    for (let j = 0; j < 6; j++) {
      const f = 3700 + R() * 700, p = 0.9 + R() * 0.9, n = 2 + Math.floor(R() * 2), g0 = 0.5 + R() * 0.5;
      for (let t = R() * p; t < L; t += p * (0.9 + R() * 0.2)) {
        if (R() < 0.2) continue; // (it rests now and then)
        const g = g0 * swell(t, 1 + (j % 3), j * 1.7) ** 2;
        for (let k = 0; k < n; k++) { const d = 0.024; tone(b, t + k * 0.04, d, () => f, (u) => g * Math.sin((Math.PI * u) / d) ** 2); }
      }
    }
    const s = filter(b, 4200, 0.8, 'low'), k = level / rms(s); // (far away: the edges rounded off)
    return s.map((v) => v * k);
  };
  /** An owl far off: hoo, hoo-hoo, hoooo, hoo (soft, round, a little breath in it). */
  const owl = (buf, t0, f0, g) => {
    const breath = filter(white(), f0 * 1.5, 1.2, 'band'), bk = 1 / rms(breath);
    for (const [at, dur] of [[0, 0.42], [0.72, 0.17], [0.95, 0.2], [1.33, 0.62], [2.18, 0.36]]) {
      const env = ar(dur, 0.09, 0.18);
      tone(buf, t0 + at, dur, (u) => f0 * (1 - 0.06 * (u / dur)), (u) => g * env(u), [[1, 1], [2, 0.08]]);
      const i0 = Math.round((t0 + at) * rate), n = Math.round(dur * rate);
      for (let i = 0; i < n; i++) add(buf, i0 + i, breath[(i0 + i) % N] * bk * g * 0.04 * env(i / rate));
    }
  };
  /** A soft chime (glass more than bell). */
  const chime = (buf, t0, f, g) => tone(buf, t0, 4, () => f, (u) => g * Math.min(1, u / 0.012) * Math.exp(-u * 1.3), [[1, 1], [2, 0.1], [3, 0.03]]);
  /** A frog by the pond: a few low, buzzing croaks. */
  const croaks = (buf, t0, f, g, n) => {
    for (let k = 0; k < n; k++) {
      const dur = 0.18 + R() * 0.1, env = ar(dur, 0.03, 0.08);
      tone(buf, t0 + k * 0.36, dur, () => f * (1 + 0.04 * k), (u) => g * env(u) * Math.abs(Math.sin(Math.PI * 27 * u)) ** 3, [[1, 1], [2, 0.5], [3, 0.25], [4, 0.1]]);
    }
  };

  const out = ring();
  const mix = (b) => { for (let i = 0; i < N; i++) out[i] += b[i]; };
  if (kind === 'soft') {
    mix(breeze(0.016)); mix(crickets(0.0025));
    owl(out, L * 0.3, 320, 0.035);
  } else if (kind === 'far') {
    mix(breeze(0.006)); mix(crickets(0.0035));
    owl(out, L * 0.55, 300, 0.022);
  } else if (kind === 'chimes') {
    mix(breeze(0.012)); mix(crickets(0.002));
    const notes = [523.3, 587.3, 659.3, 784, 880];
    for (let t = 1; t < L - 0.5; t += 2.6 + R() * 2.4) chime(out, t, notes[Math.floor(R() * notes.length)], 0.03 * (0.5 + R() * 0.5));
  } else if (kind === 'marsh') {
    mix(breeze(0.01)); mix(crickets(0.0025));
    for (let t = 1.5; t < L - 1; t += 3 + R() * 3.5) croaks(out, t, R() < 0.5 ? 205 : 245, 0.035 * (0.6 + R() * 0.4), 2 + Math.floor(R() * 3));
  } else throw new Error(`no ambience ${kind}`);
  return out;
}
