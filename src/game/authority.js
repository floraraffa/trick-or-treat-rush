// The session authority: the one place that decides anything shared. It runs on one device only
// (the host; in Snapchat, the player's own phone), owns the round clock and the only random number
// generator, checks every request (knock, pickup, power-up) against the shared state, and announces
// the outcome as numbered events plus 10 Hz snapshots. Clients never roll dice or award points.
//
// Houses (trick or treat, 15 s cooldown), candy (one id, one owner), monsters (patrol → chase →
// attack → recover → return), power-ups, Monster Madness and the giant ghost all live here.
import { rng } from '../rng.js';
import * as C from './config.js';
import { CANDY_SPOTS, DOOR_RANGE, GIANT_SPAWN, HOUSES, ORB_SPOTS, PATROLS, SPAWNS } from '../world/layout.js';
import { slide } from '../world/collide.js';

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const STEP = 1 / 30; // simulation sub-step

export class Authority {
  /**
   * @param {{ emit: (ev: object) => void, snapshot: (s: object) => void, seed?: number }} io
   *   emit: an event for every client (this device's included); snapshot: the periodic state.
   */
  constructor({ emit, snapshot, seed = (Math.random() * 2 ** 31) | 0 }) {
    this.emitEv = emit;
    this.snapshot = snapshot;
    this.R = rng(seed);
    this.phase = 'lobby';
    this.round = 0;
    this.players = new Map();
    this.paused = false;
  }

  // --- round lifecycle ---------------------------------------------------------------------

  /** Starts a round for these players ({ id, name, costume }, at most four). */
  start(roster) {
    this.round++;
    this.phase = 'countdown';
    this.clock = 0; // seconds since start; round time rt = clock - COUNTDOWN
    this.madness = false;
    this.ended = false;
    this.lastCount = 0;
    this.snapT = 0;
    this.players = new Map();
    roster.slice(0, C.MAX_PLAYERS).forEach((p, i) => {
      const s = SPAWNS[i];
      this.players.set(p.id, { id: p.id, name: p.name, costume: p.costume, order: i, score: 0, held: null, fx: {}, inv: 0, x: s.x, z: s.z });
    });
    this.houses = HOUSES.map(() => ({ until: -Infinity }));
    this.candies = new Map();
    this.candySeq = 0;
    this.candyQueue = [];
    this.orbs = new Map();
    this.orbSeq = 0;
    this.orbQueue = [];
    this.monsters = [];
    this.monsterSeq = 0;
    this.emit({
      e: 'start', round: this.round,
      players: [...this.players.values()].map((p, i) => ({ id: p.id, name: p.name, costume: p.costume, spawn: SPAWNS[i] })),
    });
    for (let k = 0; k < C.CANDY_ON_MAP; k++) this.spawnCandy();
    for (let k = 0; k < C.ORBS_ON_MAP; k++) this.spawnOrb();
    this.spawnPatrols();
    this.sendSnapshot();
  }

  get rt() { return this.clock - C.COUNTDOWN; }

  /** Freezes the round (single-player only: the Lens went to the background). */
  pause(on) { this.paused = on; }

  /** Last known position of a player (from their pose messages). */
  setPose(id, x, z) {
    const p = this.players.get(id);
    if (p && Number.isFinite(x) && Number.isFinite(z)) { p.x = x; p.z = z; }
  }

  /** A player left the room: their score stays in the ranking, monsters stop chasing them. */
  drop(id) {
    const p = this.players.get(id);
    if (p) p.gone = true;
  }

  tick(dt) {
    if (this.paused || this.phase === 'lobby' || this.phase === 'over') return;
    // Real elapsed time drives the clock (so the round lasts exactly ROUND_SECONDS even if frames
    // stutter); the simulation catches up in small steps, at most two seconds' worth.
    let left = Math.min(dt, 2);
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      this.clock += h;
      this.simulate(h);
      left -= h;
      if (this.phase === 'over') return;
    }
    if (dt > 2) this.clock += dt - 2;
    this.snapT += dt;
    if (this.snapT >= 1 / C.SNAP_HZ) { this.snapT = 0; this.sendSnapshot(); }
  }

  simulate(h) {
    const rt = this.rt;
    if (this.phase === 'countdown') {
      const n = Math.ceil(-rt);
      if (n !== this.lastCount && n > 0) { this.lastCount = n; this.emit({ e: 'count', n }); }
      if (rt >= 0) { this.phase = 'playing'; this.emit({ e: 'go' }); }
      return;
    }
    if (rt >= C.ROUND_SECONDS) { this.end(); return; }
    if (!this.madness && rt >= C.ROUND_SECONDS - C.MADNESS_AT) this.startMadness();

    // Timed state: effects expire, candy and orbs come back.
    for (const p of this.players.values()) {
      for (const [k, until] of Object.entries(p.fx)) {
        if (until <= rt) { delete p.fx[k]; this.emit({ e: 'fx-end', id: p.id, kind: k }); }
      }
    }
    while (this.candyQueue.length && this.candyQueue[0] <= rt) { this.candyQueue.shift(); this.spawnCandy(); }
    while (this.orbQueue.length && this.orbQueue[0] <= rt) { this.orbQueue.shift(); this.spawnOrb(); }
    const target = this.madness ? C.CANDY_ON_MAP_MADNESS : C.CANDY_ON_MAP;
    if (this.candies.size + this.candyQueue.length < target) this.queueCandy();

    for (const m of [...this.monsters]) this.stepMonster(m, h);
  }

  startMadness() {
    this.madness = true;
    this.emit({ e: 'madness' });
    for (let k = 0; k < C.MADNESS_SPECIALS; k++) this.spawnCandy(true);
    const g = this.addMonster('giant', [[GIANT_SPAWN.x, GIANT_SPAWN.z]], GIANT_SPAWN.x, GIANT_SPAWN.z);
    g.state = 'rise';
  }

  end() {
    this.phase = 'over';
    const ranking = [...this.players.values()]
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map((p) => ({ id: p.id, name: p.name, costume: p.costume, score: p.score }));
    const top = ranking.length ? ranking[0].score : 0;
    this.sendSnapshot();
    this.emit({ e: 'over', ranking, winners: ranking.filter((r) => r.score === top).map((r) => r.id) });
  }

  // --- requests from players -------------------------------------------------------------

  /** A player's request: { kind: 'knock' | 'pickup' | 'orb' | 'use', ... }. Invalid ones are ignored. */
  intent(from, msg) {
    const p = this.players.get(from);
    if (!p || p.gone || this.phase !== 'playing') return; // nothing scores before GO or after time's up
    const rt = this.rt;
    if (msg.kind === 'pickup') {
      const c = this.candies.get(msg.id);
      if (!c) return; // already someone else's: a candy can't be taken twice
      const reach = (p.fx.magnet > rt ? C.POWERUPS.magnet.radius : C.PICKUP_R) + C.PICKUP_SLACK;
      if (dist(p.x, p.z, c.x, c.z) > reach) return;
      this.candies.delete(c.id);
      const pts = C.CANDY[c.type].points * (p.fx.double > rt ? 2 : 1);
      p.score += pts;
      this.emit({ e: 'candy-', id: c.id, by: p.id, type: c.type, pts, score: p.score });
      this.queueCandy();
    } else if (msg.kind === 'orb') {
      const o = this.orbs.get(msg.id);
      if (!o || p.held || dist(p.x, p.z, o.x, o.z) > C.ORB_R + C.PICKUP_SLACK) return;
      this.orbs.delete(o.id);
      p.held = o.kind;
      this.emit({ e: 'orb-', id: o.id, by: p.id, kind: o.kind });
      this.orbQueue.push(rt + C.ORB_RESPAWN);
      this.orbQueue.sort((a, b) => a - b);
    } else if (msg.kind === 'use') {
      if (!p.held) return;
      const kind = p.held;
      p.held = null;
      p.fx[kind] = rt + C.POWERUPS[kind].dur;
      this.emit({ e: 'power', id: p.id, kind, until: p.fx[kind] });
    } else if (msg.kind === 'knock') {
      const i = msg.house | 0, h = HOUSES[i], st = this.houses?.[i];
      if (!h || !st || st.until > rt) return; // cooling down: nobody can use it
      if (dist(p.x, p.z, h.door.x, h.door.z) > DOOR_RANGE + C.PICKUP_SLACK) return;
      st.until = rt + C.HOUSE_COOLDOWN;
      this.knock(p, i, st.until);
    }
  }

  /** Trick or treat! The one and only roll for this visit. */
  knock(p, house, until) {
    const rt = this.rt, r = this.R();
    const dbl = p.fx.double > rt ? 2 : 1;
    if (r < C.HOUSE_ODDS.treat) {
      const n = C.TREAT_CANDIES[0] + Math.floor(this.R() * (C.TREAT_CANDIES[1] - C.TREAT_CANDIES[0] + 1));
      const candies = Array.from({ length: n }, () => this.pick(C.TREAT_MIX));
      const pts = candies.reduce((s, t) => s + C.CANDY[t].points, 0) * dbl;
      p.score += pts;
      this.emit({ e: 'house', house, by: p.id, kind: 'treat', candies, pts, score: p.score, until });
    } else if (r < C.HOUSE_ODDS.treat + C.HOUSE_ODDS.trick) {
      const trick = C.TRICKS[Math.floor(this.R() * C.TRICKS.length)];
      this.emit({ e: 'house', house, by: p.id, kind: 'trick', trick, score: p.score, until });
      const h = HOUSES[house];
      if (trick === 'ghost') {
        const m = this.addMonster('ghost', null, h.door.x, h.door.z);
        Object.assign(m, { trick: true, life: C.TRICK_GHOST_LIFE, state: 'chase', target: p.id, t: 0 });
      } else if (!this.protect(p, 'web')) {
        p.fx.slow = rt + C.TRAP_SLOW;
        this.emit({ e: 'hit', id: p.id, by: 'web', slow: p.fx.slow });
      }
    } else {
      let pts = C.CANDY[C.JACKPOT.candy].points * dbl, power = null;
      if (!p.held) { power = C.POWERUP_KINDS[Math.floor(this.R() * C.POWERUP_KINDS.length)]; p.held = power; } else pts += C.JACKPOT.fullSlotBonus * dbl;
      p.score += pts;
      this.emit({ e: 'house', house, by: p.id, kind: 'jackpot', candy: C.JACKPOT.candy, power, pts, score: p.score, until });
    }
  }

  /** A shield soaks up one attack. Returns true when it did. */
  protect(p, by) {
    const rt = this.rt;
    if (!(p.fx.shield > rt)) return false;
    delete p.fx.shield;
    p.inv = rt + 1.5;
    this.emit({ e: 'hit', id: p.id, by, blocked: true });
    return true;
  }

  // --- candy and orbs ----------------------------------------------------------------------

  pick(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = this.R() * total;
    for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }

  /** A free spot: not holding candy or an orb, and not right under anyone's nose. */
  freeSpot(spots, taken, near = 4) {
    const ok = spots.filter(([x, z], i) => !taken.has(i) && [...this.players.values()].every((p) => p.gone || dist(p.x, p.z, x, z) > near));
    const pool = ok.length ? ok : spots.filter((_, i) => !taken.has(i));
    if (!pool.length) return null;
    const s = pool[Math.floor(this.R() * pool.length)];
    return { i: spots.indexOf(s), x: s[0], z: s[1] };
  }

  queueCandy() {
    const [a, b] = C.CANDY_RESPAWN;
    this.candyQueue.push(this.rt + a + this.R() * (b - a));
    this.candyQueue.sort((x, y) => x - y);
  }

  spawnCandy(special = false) {
    const taken = new Set([...this.candies.values()].map((c) => c.spot));
    const s = this.freeSpot(CANDY_SPOTS, taken, special ? 2 : 4);
    if (!s) return;
    const type = special ? (this.R() < 0.65 ? 'pumpkin' : 'rainbow') : this.pick(this.madness ? C.CANDY_MADNESS_WEIGHTS : Object.fromEntries(Object.entries(C.CANDY).map(([k, v]) => [k, v.weight])));
    const c = { id: ++this.candySeq, type, x: s.x, z: s.z, spot: s.i };
    this.candies.set(c.id, c);
    this.emit({ e: 'candy+', id: c.id, type, x: c.x, z: c.z });
  }

  spawnOrb() {
    const taken = new Set([...this.orbs.values()].map((o) => o.spot));
    const s = this.freeSpot(ORB_SPOTS, taken, 3);
    if (!s) return;
    const o = { id: ++this.orbSeq, kind: C.POWERUP_KINDS[Math.floor(this.R() * C.POWERUP_KINDS.length)], x: s.x, z: s.z, spot: s.i };
    this.orbs.set(o.id, o);
    this.emit({ e: 'orb+', id: o.id, kind: o.kind, x: o.x, z: o.z });
  }

  // --- monsters ------------------------------------------------------------------------------

  /** Patrols start on the far side of their routes from the plaza, and leave players alone for a few seconds after GO. */
  spawnPatrols() {
    const far = (path) => path.reduce((best, p, i) => (Math.hypot(...p) > Math.hypot(...path[best]) ? i : best), 0);
    PATROLS.ghost.slice(0, C.MONSTERS.ghost.count).forEach((path, i) => {
      const k = i < 2 ? (far(path) + i * Math.floor(path.length / 2)) % path.length : 0;
      const m = this.addMonster('ghost', path, ...path[k]);
      m.wp = (k + 1) % path.length; m.cool = C.GRACE + i;
    });
    PATROLS.zombie.slice(0, C.MONSTERS.zombie.count).forEach((path) => {
      const k = far(path), m = this.addMonster('zombie', path, ...path[k]);
      m.wp = (k + 1) % path.length; m.cool = C.GRACE;
    });
  }

  addMonster(kind, path, x, z) {
    const m = { id: `${kind[0]}${++this.monsterSeq}`, kind, path, wp: 0, x, z, yaw: 0, state: 'patrol', target: null, t: 0, cool: 1 };
    if (path) m.wp = this.nearestWp(m);
    this.monsters.push(m);
    this.emit({ e: 'mon+', id: m.id, kind, x, z });
    return m;
  }

  removeMonster(m) {
    this.monsters = this.monsters.filter((o) => o !== m);
    this.emit({ e: 'mon-', id: m.id });
  }

  nearestWp(m) {
    let best = 0, bd = Infinity;
    m.path.forEach(([x, z], i) => { const d = dist(m.x, m.z, x, z); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** The nearest player in range that isn't protected right now. */
  nearestPlayer(m, range) {
    let best = null, bd = range;
    for (const p of this.players.values()) {
      if (p.gone || p.inv > this.rt) continue;
      const d = dist(m.x, m.z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** The leader (most candy; the earlier joiner on a tie): the giant ghost's favourite. */
  leader() {
    let best = null;
    for (const p of this.players.values()) if (!p.gone && (!best || p.score > best.score)) best = p;
    return best;
  }

  /** Moves a monster towards (tx, tz); zombies walk round walls, ghosts float through. Returns the distance left. */
  moveToward(m, tx, tz, speed, h) {
    const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      const s = Math.min(d, speed * h);
      m.x += (dx / d) * s; m.z += (dz / d) * s;
      const want = Math.atan2(dx, dz) * 57.2958;
      let dy = ((want - m.yaw + 540) % 360) - 180;
      m.yaw += dy * Math.min(1, h * 8);
    }
    if (m.kind === 'zombie') [m.x, m.z] = slide(m.x, m.z, 0.35);
    return Math.hypot(tx - m.x, tz - m.z);
  }

  stepMonster(m, h) {
    const rt = this.rt, cfg = C.MONSTERS[m.kind], mad = this.madness ? C.MADNESS_SPEED : 1;
    m.t += h;
    m.cool -= h;
    if (m.trick) {
      m.life -= h;
      if (m.life <= 0) { this.removeMonster(m); return; }
    }
    if (m.kind === 'giant') {
      if (m.state === 'rise') { if (m.t > 2) { m.state = 'chase'; m.t = 0; } return; }
      if (m.state === 'recover') { if (m.t > 2) { m.state = 'chase'; m.t = 0; } return; }
      if (m.t > 1 || !m.target) { m.target = this.leader()?.id ?? null; m.t = 0; }
      const p = this.players.get(m.target);
      if (!p) return;
      this.moveToward(m, p.x, p.z, cfg.chase, h);
      if (dist(m.x, m.z, p.x, p.z) < cfg.reach) this.attack(m, p);
      return;
    }
    switch (m.state) {
      case 'patrol': {
        const [tx, tz] = m.path[m.wp];
        if (this.moveToward(m, tx, tz, cfg.patrol * mad, h) < 0.5) m.wp = (m.wp + 1) % m.path.length;
        if (m.cool <= 0) this.detect(m, cfg.detect);
        break;
      }
      case 'chase': {
        const p = this.players.get(m.target);
        if (!p || p.gone) { this.giveUp(m); break; }
        const d = dist(m.x, m.z, p.x, p.z);
        if (!m.trick && (d > cfg.giveUp || m.t > cfg.maxChase)) { this.giveUp(m); break; }
        this.moveToward(m, p.x, p.z, cfg.chase * mad, h);
        if (dist(m.x, m.z, p.x, p.z) < cfg.reach) this.attack(m, p);
        break;
      }
      case 'recover': { // back off from the victim for a moment
        const p = this.players.get(m.target);
        if (p) this.moveToward(m, m.x + (m.x - p.x), m.z + (m.z - p.z), cfg.patrol * 0.8, h);
        if (m.t > C.RECOVER) { if (m.trick) this.removeMonster(m); else this.giveUp(m); }
        break;
      }
      case 'return': {
        const [tx, tz] = m.path[m.wp];
        if (this.moveToward(m, tx, tz, cfg.patrol * mad * 1.2, h) < 0.6) { m.state = 'patrol'; m.wp = (m.wp + 1) % m.path.length; }
        if (m.cool <= 0) this.detect(m, cfg.detect * 0.8);
        break;
      }
    }
  }

  detect(m, range) {
    const p = this.nearestPlayer(m, range);
    if (p) { m.state = 'chase'; m.target = p.id; m.t = 0; this.emit({ e: 'spot', id: m.id, target: p.id }); }
  }

  giveUp(m) {
    if (m.trick) { this.removeMonster(m); return; }
    m.state = 'return'; m.target = null; m.t = 0; m.cool = 2.5;
    m.wp = this.nearestWp(m);
  }

  attack(m, p) {
    const rt = this.rt, cfg = C.MONSTERS[m.kind];
    m.state = 'recover'; m.t = 0;
    if (p.inv > rt) return; // still protected from the last hit
    if (this.protect(p, m.kind)) return;
    p.inv = rt + C.INVULNERABLE;
    if (m.kind === 'zombie') {
      p.fx.slow = rt + cfg.slow;
      this.emit({ e: 'hit', id: p.id, by: m.kind, mon: m.id, slow: p.fx.slow });
    } else {
      const loss = Math.min(p.score, cfg.penalty);
      p.score -= loss;
      this.emit({ e: 'hit', id: p.id, by: m.kind, mon: m.id, delta: -loss, score: p.score });
    }
  }

  // --- output ----------------------------------------------------------------------------------

  emit(ev) { this.emitEv({ ...ev, round: this.round }); }

  sendSnapshot() {
    const rt = this.rt;
    this.snapshot({
      round: this.round, phase: this.phase, rt, madness: this.madness,
      players: [...this.players.values()].map((p) => ({
        id: p.id, score: p.score, held: p.held, inv: p.inv > rt ? +(p.inv - rt).toFixed(2) : 0,
        fx: Object.fromEntries(Object.entries(p.fx).map(([k, u]) => [k, +(u - rt).toFixed(2)])),
      })),
      houses: this.houses.map((s) => Math.max(0, +(s.until - rt).toFixed(2))),
      monsters: this.monsters.map((m) => [m.id, m.kind, +m.x.toFixed(2), +m.z.toFixed(2), Math.round(m.yaw), m.state, m.target]),
    });
  }
}
