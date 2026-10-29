// The Spectacles Lens's night ambience, under everything (it loops): drawn sample by sample, so the same seed
// always gives the same sound, in the browser or in Node. Everything is laid on a ring of the loop's length
// (what runs past the end comes back in at the start, filters run round it twice), so it loops without a seam.
//   crickets  crickets in the grass, a breath of air, an owl calling far off and another answering (the default)
//   leaves    dry leaves rustling in gusts, wind chimes on a porch
//   drone     a low haunted hum, a far bell tolling, slow air
import { rng } from '../rng.js';

export const AMBIENCES = ['crickets', 'leaves', 'drone'];
export const AMBIENCE = 'crickets';

/** A loop of `seconds` (Float32Array at `rate`), its loudness set to about the old wind's. */
export function nightAmbience(kind = AMBIENCE, { rate = 22050, seconds = 20, seed = 7 } = {}) {
  const N = Math.round(rate * seconds), out = new Float32Array(N), R = rng(seed);
  const TAU = Math.PI * 2, L = N / rate;
  const add = (i, v) => { out[((i % N) + N) % N] += v; };
  /** A slow swell that comes round a whole number of times in the loop (k: how many). */
  const swell = (t, k, ph = 0) => 0.5 + 0.5 * Math.sin((TAU * k * t) / L + ph);
  /** White noise through a two-pole band (or low) pass, round the ring twice: the second lap has no seam. */
  const noise = (f, q, type = 'band') => {
    const w = (TAU * f) / rate, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al;
    const [b0, b1, b2] = type === 'band' ? [al / a0, 0, -al / a0] : [((1 - c) / 2) / a0, (1 - c) / a0, ((1 - c) / 2) / a0];
    const a1 = (-2 * c) / a0, a2 = (1 - al) / a0, src = Float32Array.from({ length: N }, () => R() * 2 - 1), y = new Float32Array(N);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let lap = 0; lap < 2; lap++) for (let i = 0; i < N; i++) {
      const x = src[i], v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  /** A tone from time t0 (s): f(t) its pitch, env(t) its loudness, partials [ratio, gain]. */
  const tone = (t0, dur, f, env, partials = [[1, 1]]) => {
    const i0 = Math.round(t0 * rate), n = Math.round(dur * rate), ph = partials.map(() => 0);
    for (let i = 0; i < n; i++) {
      const t = i / rate, e = env(t);
      let v = 0;
      partials.forEach(([r, g], k) => { ph[k] += (TAU * f(t) * r) / rate; v += g * Math.sin(ph[k]); });
      add(i0 + i, v * e);
    }
  };
  /** Soft at both ends: a rise of `a` s, a fall of `r` s. */
  const ar = (dur, a, r) => (t) => Math.min(1, t / a, Math.max(0, (dur - t) / r));

  if (kind === 'crickets') {
    // A breath of air, low and soft, swelling now and then.
    const air = noise(260, 0.5, 'low');
    for (let i = 0; i < N; i++) { const t = i / rate; out[i] += air[i] * 0.05 * (0.4 + 0.6 * swell(t, 2) * swell(t, 3, 1)); }
    // Crickets: each chirps three or four pulses at its own pitch and pace, louder and softer by turns.
    const crickets = [{ f: 4350, p: 0.86, g: 0.075, n: 4 }, { f: 4780, p: 1.07, g: 0.05, n: 3 }, { f: 3980, p: 0.94, g: 0.035, n: 4 }, { f: 5200, p: 0.61, g: 0.02, n: 2 }];
    crickets.forEach((c, j) => {
      for (let t = R() * c.p; t < L; t += c.p * (0.93 + R() * 0.14)) {
        if (R() < 0.08) continue; // (a breath between chirps)
        const g = c.g * (0.35 + 0.65 * swell(t, j + 1, j * 2.1)) * (0.85 + R() * 0.3);
        for (let k = 0; k < c.n; k++) {
          const d = 0.017;
          tone(t + k * 0.032, d, (u) => c.f * (1 + 0.012 * Math.sin(TAU * 60 * u)), (u) => g * Math.sin((Math.PI * u) / d) ** 2, [[1, 1], [2, 0.12]]);
        }
      }
    });
    // An owl far off: hoo, hoo-hoo, hoooo, hoo; later another, farther, answers.
    const owl = (t0, f0, g) => {
      for (const [at, dur] of [[0, 0.42], [0.72, 0.17], [0.95, 0.2], [1.33, 0.62], [2.18, 0.36]]) {
        tone(t0 + at, dur, (u) => f0 * (1 - 0.07 * (u / dur)), (u) => g * ar(dur, 0.06, 0.12)(u), [[1, 1], [2, 0.18], [3, 0.05]]);
        const b = noise(f0 * 1.5, 1.2); // (a little breath in the hoot)
        const i0 = Math.round((t0 + at) * rate), n = Math.round(dur * rate);
        for (let i = 0; i < n; i++) add(i0 + i, b[(i0 + i) % N] * g * 0.25 * ar(dur, 0.06, 0.12)(i / rate));
      }
    };
    owl(L * 0.18, 330, 0.11);
    owl(L * 0.62, 298, 0.055);
  } else if (kind === 'leaves') {
    // Gusts: leaves rustle (a hiss crackling in bursts), and the chimes on a porch ring when the air moves.
    const gust = (t) => (swell(t, 3, 0.5) * 0.6 + swell(t, 5, 2) * 0.4) ** 2;
    const hiss = noise(2600, 0.6), low = noise(420, 0.6, 'low');
    for (let i = 0; i < N; i++) { const t = i / rate; out[i] += hiss[i] * 0.05 * (0.15 + gust(t)) + low[i] * 0.04 * (0.3 + gust(t)); }
    const crackle = noise(3800, 1.5);
    for (let t = 0; t < L; t += 0.004 + R() * 0.03 / (0.2 + gust(t))) {
      const i0 = Math.round(t * rate), n = Math.round((0.004 + R() * 0.01) * rate), g = 0.12 * gust(t) * R();
      for (let i = 0; i < n; i++) add(i0 + i, crackle[(i0 + i) % N] * g * (1 - i / n));
    }
    const notes = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
    for (let t = 0.6; t < L; t += 0.5 + R() * 1.6) {
      if (R() > gust(t) * 1.4) continue;
      const f = notes[Math.floor(R() * notes.length)], g = 0.05 * (0.5 + R() * 0.5);
      tone(t, 3, () => f, (u) => g * Math.min(1, u / 0.003) * Math.exp(-u * 1.6), [[1, 1], [2.76, 0.35], [5.4, 0.12]]);
    }
  } else if (kind === 'drone') {
    // A low hum that beats slowly against itself, slow air over it, a bell far away.
    const hum = [[55, 0.05], [55.25, 0.04], [82.4, 0.03], [110.3, 0.015]];
    const ph = hum.map(() => 0);
    for (let i = 0; i < N; i++) {
      const t = i / rate;
      let v = 0;
      hum.forEach(([f, g], k) => { ph[k] += (TAU * f) / rate; v += g * Math.sin(ph[k]); });
      out[i] += v * (0.6 + 0.4 * swell(t, 2, 0.3));
    }
    const air = noise(380, 0.8);
    for (let i = 0; i < N; i++) { const t = i / rate; out[i] += air[i] * 0.06 * swell(t, 3) * swell(t, 1, 1); }
    for (const [at, g] of [[L * 0.15, 0.09], [L * 0.6, 0.06]]) tone(at, 6, () => 196, (u) => g * Math.min(1, u / 0.01) * Math.exp(-u * 0.75), [[0.5, 0.5], [1, 1], [1.19, 0.4], [1.5, 0.3], [2, 0.35], [2.52, 0.15], [3.01, 0.1]]);
  } else throw new Error(`no ambience ${kind}`);

  // As loud as the old wind was (RMS about 0.035), never clipping.
  let sum = 0, peak = 0;
  for (let i = 0; i < N; i++) { sum += out[i] * out[i]; peak = Math.max(peak, Math.abs(out[i])); }
  const g = Math.min(0.035 / Math.sqrt(sum / N), 0.95 / peak);
  for (let i = 0; i < N; i++) out[i] *= g;
  return out;
}
