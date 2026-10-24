// Tiny synthesised sounds and a music-box tune: no audio files to ship (Web Audio, from Cruise Rush).
let ctx = null, master = null;

export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch {
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

/** Silences everything while Snapchat has the Lens in the background. */
export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend();
}

/** A short vibration on Android; iOS has no web vibration API, and it must follow a user gesture. */
export function buzz(ms) {
  if (navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate(ms);
}

function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0, vibrato = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 6; depth.gain.value = vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur, { freq = 800, q = 1, vol = 0.2, delay = 0, type = 'lowpass', sweep = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; g.gain.value = vol;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const A_MINOR = [220, 261.63, 329.63, 392, 440, 523.25, 659.25, 783.99];

export const sfx = {
  knock: () => { for (const d of [0, 0.16]) { noise(0.12, { freq: 260, vol: 0.5, delay: d }); tone(95, 0.12, { type: 'sine', vol: 0.3, delay: d, slide: -30 }); } },
  creak: () => { tone(110, 0.7, { type: 'sawtooth', vol: 0.035, slide: 120, delay: 0.3, vibrato: 18 }); noise(0.6, { freq: 1400, q: 8, vol: 0.05, type: 'bandpass', delay: 0.3, sweep: 900 }); },
  candy: (pts = 1) => { const n = pts >= 25 ? 5 : pts >= 10 ? 4 : pts >= 5 ? 3 : 2; for (let i = 0; i < n; i++) tone(A_MINOR[i + 3] * 2, 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.05 }); },
  treat: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: 0.35 + i * 0.07 })),
  jackpot: () => [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => { tone(f, 0.25, { type: 'square', vol: 0.05, delay: 0.35 + i * 0.08 }); tone(f / 2, 0.25, { type: 'triangle', vol: 0.06, delay: 0.35 + i * 0.08 }); }),
  trick: () => [392, 369.99, 349.23, 311.13].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', vol: 0.05, delay: 0.35 + i * 0.12, vibrato: 6 })),
  ghost: () => tone(430, 1.1, { type: 'sine', vol: 0.08, slide: -160, vibrato: 14 }),
  /** A creature has seen you: a music box winding down, out of tune, over a breath. */
  creature: () => { [659.25, 622.25, 523.25, 493.88].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.06, delay: i * 0.13, slide: -40 - i * 25, vibrato: 7 })); noise(0.9, { freq: 500, q: 0.8, vol: 0.05, type: 'bandpass', sweep: -300 }); },
  hit: () => { tone(120, 0.35, { type: 'sawtooth', vol: 0.12, slide: -70 }); tone(127, 0.35, { type: 'square', vol: 0.05, slide: -70 }); },
  blocked: () => [880, 1320].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.1, delay: i * 0.06 })),
  power: () => { tone(300, 0.4, { type: 'sawtooth', vol: 0.05, slide: 900 }); noise(0.4, { freq: 600, vol: 0.06, sweep: 3000, type: 'bandpass' }); },
  orb: () => [659.25, 987.77].forEach((f, i) => tone(f, 0.15, { type: 'sine', vol: 0.1, delay: i * 0.07 })),
  beep: () => tone(440, 0.15, { type: 'square', vol: 0.07 }),
  go: () => { tone(880, 0.35, { type: 'square', vol: 0.08 }); tone(440, 0.35, { type: 'triangle', vol: 0.1 }); },
  tick: () => noise(0.04, { freq: 3000, q: 4, vol: 0.12, type: 'bandpass' }),
  /** Midnight is coming: three deep bell tolls over a low drone. */
  madness: () => { for (let i = 0; i < 3; i++) { tone(110, 2.2, { type: 'sine', vol: 0.18, delay: i * 0.9 }); tone(220 * 1.19, 1.6, { type: 'sine', vol: 0.06, delay: i * 0.9 }); tone(330 * 1.06, 1.2, { type: 'triangle', vol: 0.03, delay: i * 0.9 }); } tone(55, 3, { type: 'sawtooth', vol: 0.04, vibrato: 2 }); },
  win: () => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.24, { type: 'triangle', vol: 0.12, delay: i * 0.13 })),
  lose: () => [392, 369.99, 349.23, 293.66].forEach((f, i) => tone(f, i === 3 ? 0.8 : 0.3, { type: 'sawtooth', vol: 0.05, delay: i * 0.3, vibrato: i === 3 ? 8 : 0 })),
  click: () => tone(1200, 0.04, { type: 'square', vol: 0.03 }),
  /** Thunder: a crack (only up close) and a long rolling rumble; `k` 0..1 is how near the strike was. */
  thunder: (k = 1, delay = 0) => {
    if (k > 0.5) noise(0.35, { freq: 2600, q: 0.7, vol: 0.35 * k, type: 'highpass', delay, sweep: -2000 });
    for (let i = 0; i < 3; i++) noise(1.6 + i * 0.5, { freq: 140 - i * 25, vol: (0.55 - i * 0.12) * (0.3 + 0.7 * k), delay: delay + 0.05 + i * 0.22 });
  },
  /** Candy landing round you in a storm: a soft pitter-patter. */
  patter: () => noise(0.05, { freq: 2200 + Math.random() * 1500, q: 3, vol: 0.05, type: 'bandpass' }),
};

// A little music-box waltz in A minor (a lullaby gone strange). Lower and wobblier in the madness.
const TUNE = [[1, 4], [0, 2], [0, 1], [1, 5], [0, 2], [0, 3], [1, 4], [0, 7], [0, 5], [1, 4], [0, 2], [0, 3], [1, 1], [0, 2], [0, 0], [1, 4]];
export const MUSIC_STEP = 0.26, MUSIC_STEPS = 48; // seconds a note; 48 notes: the tune (16) and its bass line (48) both come round
let musicTimer = null, step = 0, madness = false;
function musicNote(k, mad, delay = 0) {
  const [accent, n] = TUNE[k % TUNE.length];
  const f = A_MINOR[n] * (mad ? 1 : 2) * (mad && k % 4 === 0 ? 1.06 : 1);
  tone(f, 0.5, { type: 'triangle', vol: accent ? 0.035 : 0.022, vibrato: mad ? 5 : 1.5, delay });
  if (k % 3 === 0) tone(A_MINOR[[0, 3, 4, 2][Math.floor(k / 12) % 4]] / 2, 0.8, { type: 'sine', vol: 0.03, delay });
}
export function music(on) {
  if (!on) { clearInterval(musicTimer); musicTimer = null; return; }
  if (musicTimer || !ctx) return;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    musicNote(step, madness);
    step++;
  }, MUSIC_STEP * 1000);
}
/** Tools only: the whole phrase scheduled at once (the Lens Studio export records it as a loop). */
export function musicPhrase(mad) { for (let k = 0; k < MUSIC_STEPS; k++) musicNote(k, mad, k * MUSIC_STEP); }

/** Tools only: plays `fn` into an offline context and returns what it rendered (an AudioBuffer). */
export async function renderOffline(fn, seconds, rate = 44100) {
  const keep = [ctx, master];
  ctx = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  try { fn(); return await ctx.startRendering(); } finally { [ctx, master] = keep; }
}
export function musicMadness(on) {
  madness = on;
}
