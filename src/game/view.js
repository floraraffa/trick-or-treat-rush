// GameStateManager: every device's mirror of the shared state, built only from the authority's
// events and snapshots (never decided locally). It also keeps short position histories so remote
// players and monsters are drawn smoothly, a little in the past, between their updates.
import { INTERP_DELAY, ROUND_SECONDS } from './config.js';

/** The player an event is about: `by` for visits and pickups (their `id` is the house, candy or orb), `id` otherwise. */
export const playerOf = (ev) => (ev.e === 'candy-' || ev.e === 'orb-' || ev.e === 'gem-' || ev.e === 'house' ? ev.by : ev.id);

const lerpAngle = (a, b, k) => a + ((((b - a) % 360) + 540) % 360 - 180) * k;

/** A short history of [time, x, z, yaw, ...] samples, read back interpolated. */
export class Track {
  constructor() { this.buf = []; }
  push(t, x, z, yaw, extra = null) {
    this.buf.push({ t, x, z, yaw, extra });
    if (this.buf.length > 30) this.buf.shift();
  }
  /** Position at time t (clamped to the oldest/newest sample). */
  at(t) {
    const b = this.buf;
    if (!b.length) return null;
    if (t <= b[0].t) return b[0];
    for (let i = b.length - 1; i > 0; i--) {
      if (b[i - 1].t <= t) {
        const a = b[i - 1], c = b[i];
        if (t >= c.t) return c;
        const k = (t - a.t) / Math.max(1e-4, c.t - a.t);
        return { t, x: a.x + (c.x - a.x) * k, z: a.z + (c.z - a.z) * k, yaw: lerpAngle(a.yaw, c.yaw, k), extra: c.extra };
      }
    }
    return b[b.length - 1];
  }
}

export class View {
  constructor(meId) {
    this.me = meId;
    this.reset();
  }

  reset() {
    this.round = 0;
    this.phase = 'lobby';
    this.madness = false;
    this.players = new Map();
    this.houses = [];
    this.candies = new Map();
    this.orbs = new Map();
    this.gems = new Map();
    this.monsters = new Map();
    this.level = null;
    this.ranking = null;
    this.winners = [];
    this.rtBase = -3;
    this.rtAt = 0;
  }

  now() { return performance.now() / 1000; }

  /** Round time as the authority counts it (negative during the countdown). */
  rt() {
    if (this.phase === 'lobby') return -3;
    if (this.phase === 'over') return ROUND_SECONDS;
    return Math.min(ROUND_SECONDS, this.rtBase + (this.now() - this.rtAt));
  }

  remaining() { return Math.max(0, ROUND_SECONDS - Math.max(0, this.rt())); }

  inRound(id) { return this.players.has(id); }

  /** Seconds left on an effect of a player (0 when off). */
  fx(id, kind) {
    const p = this.players.get(id);
    return p?.fx[kind] ? Math.max(0, p.fx[kind] - this.now()) : 0;
  }

  leader() {
    let best = null;
    for (const p of this.players.values()) if (!best || p.score > best.score) best = p;
    return best;
  }

  /** Applies an authority event. Events from another round are dropped. */
  apply(ev) {
    const now = this.now();
    if (ev.e === 'start') {
      this.reset();
      this.round = ev.round;
      this.level = ev.level;
      this.phase = 'countdown';
      this.rtBase = -3; this.rtAt = now;
      this.houses = [0, 0, 0, 0, 0, 0, 0, 0];
      ev.players.forEach((p, i) => this.players.set(p.id, { id: p.id, name: p.name, costume: p.costume, order: i, spawn: p.spawn, score: 0, held: null, fx: {}, inv: 0, track: new Track() }));
      return;
    }
    if (ev.round !== this.round) return;
    const p = this.players.get(playerOf(ev));
    switch (ev.e) {
      case 'count': this.rtBase = -ev.n; this.rtAt = now; break;
      case 'go': this.phase = 'playing'; this.rtBase = 0; this.rtAt = now; break;
      case 'madness': this.madness = true; break;
      case 'candy+': this.candies.set(ev.id, { id: ev.id, type: ev.type, x: ev.x, z: ev.z, born: now, fall: ev.fall ?? 0 }); break;
      case 'candy-': this.candies.delete(ev.id); if (p) p.score = ev.score; break;
      case 'orb+': this.orbs.set(ev.id, { id: ev.id, kind: ev.kind, x: ev.x, z: ev.z, born: now }); break;
      case 'orb-': this.orbs.delete(ev.id); if (p) { if (ev.used) p.fx[ev.kind] = now + (ev.until - this.rt()); else p.held = ev.kind; } break;
      case 'power': if (p) { p.held = null; p.fx[ev.kind] = now + (ev.until - this.rt()); } break;
      case 'gem+': this.gems.set(ev.id, { id: ev.id, kind: ev.kind, x: ev.x, z: ev.z, born: now }); break;
      case 'gem-': this.gems.delete(ev.id); if (p) p.fx[ev.kind] = now + (ev.until - this.rt()); break;
      case 'scare': { if (p) p.score = ev.score; const m = this.monsters.get(ev.mon); if (m) { m.state = 'banished'; m.loot = 0; } break; }
      case 'fx-end': if (p) delete p.fx[ev.kind]; break;
      case 'house':
        this.houses[ev.house] = now + (ev.until - this.rt());
        if (p) { p.score = ev.score; if (ev.power) p.held = ev.power; }
        break;
      case 'hit':
        if (!p) break;
        if (ev.blocked) delete p.fx.shield;
        if (ev.slow) p.fx.slow = now + (ev.slow - this.rt());
        if (ev.score !== undefined) p.score = ev.score;
        break;
      case 'mon+': this.monsters.set(ev.id, { id: ev.id, kind: ev.kind, track: new Track(), state: 'patrol', target: null, born: now, x: ev.x, z: ev.z }); this.monsters.get(ev.id).track.push(now, ev.x, ev.z, 0); break;
      case 'mon-': { const m = this.monsters.get(ev.id); if (m) m.gone = now; break; }
      case 'over': this.phase = 'over'; this.ranking = ev.ranking; this.winners = ev.winners; break;
    }
  }

  /** Applies a snapshot: the authority's word on time, scores, effects, cooldowns and monsters. */
  snapshot(s) {
    if (s.round !== this.round) return;
    const now = this.now();
    if (s.phase !== 'lobby') {
      if (s.phase !== this.phase && !(this.phase === 'over')) this.phase = s.phase;
      this.rtBase = s.rt; this.rtAt = now;
    }
    this.madness = s.madness;
    for (const sp of s.players) {
      const p = this.players.get(sp.id);
      if (!p) continue;
      p.score = sp.score;
      p.held = sp.held;
      p.inv = sp.inv ? now + sp.inv : 0;
      p.fx = Object.fromEntries(Object.entries(sp.fx).map(([k, r]) => [k, now + r]));
    }
    this.houses = s.houses.map((r) => (r > 0 ? now + r : 0));
    const seen = new Set();
    for (const [id, kind, x, z, yaw, state, target, loot] of s.monsters) {
      let m = this.monsters.get(id);
      if (!m) { m = { id, kind, track: new Track(), born: now }; this.monsters.set(id, m); }
      // Back from being scared off: it reappears elsewhere, so start a fresh trail (no slide across the map).
      if (m.state === 'banished' && state !== 'banished') { m.track = new Track(); m.born = now; }
      m.track.push(now, x, z, yaw);
      m.state = state; m.target = target; m.x = x; m.z = z; m.loot = loot ?? 0;
      seen.add(id);
    }
    for (const [id, m] of this.monsters) if (!seen.has(id) && !m.gone) m.gone = now;
  }

  /** A remote player's pose message. */
  pose(id, p) {
    const pl = this.players.get(id);
    if (!pl) return;
    pl.track.push(this.now(), p.x, p.z, p.yaw, p);
  }

  /** Where to draw a remote player or monster now (a little in the past, interpolated). */
  sample(track) { return track.at(this.now() - INTERP_DELAY); }
}
