// The session authority: the one place that decides anything shared. It runs on one device only
// (the host; in Snapchat, the player's own phone), owns the round clock and the only random number
// generator, checks every request (knock, pickup, power-up) against the shared state, and announces
// the outcome as numbered events plus 10 Hz snapshots. Clients never roll dice or award points.
//
// Houses (trick or treat, 15 s cooldown), candy (one id, one owner; a candy rain drops more round
// its player), monsters (patrol → chase → attack → recover → return, or flee and get scared off,
// blind to anyone turned ghost), power-ups, gems, the level and Monster Madness all live here.
import { rng } from '../rng.js';
import * as C from './config.js';
import { CANDY_SPOTS, DOOR_RANGE, HOUSES, MAP_R, ORB_SPOTS, PATROLS, SPAWNS } from '../world/layout.js';
import { slide } from '../world/collide.js';

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const STEP = 1 / 30; // simulation sub-step
/** Index of the waypoint farthest from the plaza. */
const farthest = (path) => path.reduce((best, p, i) => (Math.hypot(...p) > Math.hypot(...path[best]) ? i : best), 0);

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

  /** Starts a round for these players ({ id, name, costume }, at most four) at a level (easy, medium, hard). */
  start(roster, level = C.DEFAULT_LEVEL) {
    this.round++;
    this.level = C.LEVELS.includes(level) ? level : C.DEFAULT_LEVEL;
    this.D = C.DIFFICULTY[this.level];
    this.cfg = { ghost: { ...C.MONSTERS.ghost, ...this.D.ghost }, zombie: { ...C.MONSTERS.zombie, ...this.D.zombie } };
    this.phase = 'countdown';
    this.clock = 0; // seconds since start; round time rt = clock - COUNTDOWN
    this.madness = false;
    this.ended = false;
    this.lastCount = 0;
    this.snapT = 0;
    this.players = new Map();
    roster.slice(0, C.MAX_PLAYERS).forEach((p, i) => {
      const s = SPAWNS[i];
      this.players.set(p.id, { id: p.id, name: p.name, costume: p.costume, order: i, score: 0, held: null, fx: {}, inv: 0, rain: 0, x: s.x, z: s.z });
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
    this.gems = new Map();
    this.gemSeq = 0;
    this.nextGem = C.GEM_FIRST;
    this.emit({
      e: 'start', round: this.round, level: this.level,
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
    let onStreets = 0;
    for (const c of this.candies.values()) {
      if (c.spot >= 0) onStreets++;
      else if (c.gone <= rt) { this.candies.delete(c.id); this.emit({ e: 'candy-', id: c.id, gone: true }); } // rain candy nobody took
    }
    const target = this.madness ? C.CANDY_ON_MAP_MADNESS : C.CANDY_ON_MAP;
    if (onStreets + this.candyQueue.length < target) this.queueCandy();
    for (const p of this.players.values()) {
      if (p.gone || !(p.fx.rain > rt)) continue;
      p.rain += h * C.POWERUPS.rain.rate;
      while (p.rain >= 1) { p.rain -= 1; this.rainCandy(p); }
    }
    if (this.gems.size < C.GEMS_ON_MAP && rt >= this.nextGem && rt < C.ROUND_SECONDS - 8) this.spawnGem();

    for (const m of [...this.monsters]) this.stepMonster(m, h);
  }

  startMadness() {
    this.madness = true;
    this.emit({ e: 'madness' });
    for (let k = 0; k < C.MADNESS_SPECIALS; k++) this.spawnCandy(true);
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

  /** A player's request: { kind: 'knock' | 'pickup' | 'orb' | 'gem' | 'use', ... }. Invalid ones are ignored. */
  intent(from, msg) {
    const p = this.players.get(from);
    if (!p || p.gone || this.phase !== 'playing') return; // nothing scores before GO or after time's up
    const rt = this.rt;
    if (msg.kind === 'pickup') {
      const c = this.candies.get(msg.id);
      if (!c) return; // already someone else's: a candy can't be taken twice
      if (c.land > rt + 0.15) return; // still falling from the sky
      const reach = (p.fx.magnet > rt ? C.POWERUPS.magnet.radius : C.PICKUP_R) * (p.fx.giant > rt ? C.GEMS.giant.reach : 1) + C.PICKUP_SLACK;
      if (dist(p.x, p.z, c.x, c.z) > reach) return;
      this.candies.delete(c.id);
      const pts = C.CANDY[c.type].points * (p.fx.double > rt ? 2 : 1);
      p.score += pts;
      this.emit({ e: 'candy-', id: c.id, by: p.id, type: c.type, pts, score: p.score });
      if (c.spot >= 0) this.queueCandy();
    } else if (msg.kind === 'orb') {
      // Always yours to take: into the empty slot for the POWER-UP button, or straight on if the slot is full.
      const o = this.orbs.get(msg.id);
      if (!o || dist(p.x, p.z, o.x, o.z) > C.ORB_R * (p.fx.giant > rt ? C.GEMS.giant.reach : 1) + C.PICKUP_SLACK) return;
      this.orbs.delete(o.id);
      const used = !!p.held;
      if (used) { p.fx[o.kind] = rt + C.POWERUPS[o.kind].dur; if (o.kind === 'rain') p.rain = 1; } else p.held = o.kind;
      this.emit({ e: 'orb-', id: o.id, by: p.id, kind: o.kind, used, until: used ? p.fx[o.kind] : undefined });
      this.orbQueue.push(rt + C.ORB_RESPAWN);
      this.orbQueue.sort((a, b) => a - b);
    } else if (msg.kind === 'gem') {
      const g = this.gems.get(msg.id);
      if (!g || dist(p.x, p.z, g.x, g.z) > C.GEM_R * (p.fx.giant > rt ? C.GEMS.giant.reach : 1) + C.PICKUP_SLACK) return;
      this.gems.delete(g.id);
      p.fx[g.kind] = rt + C.GEMS[g.kind].dur;
      this.nextGem = Math.max(this.nextGem, rt + 4); // not straight back in the gap it left
      this.emit({ e: 'gem-', id: g.id, by: p.id, kind: g.kind, until: p.fx[g.kind] });
    } else if (msg.kind === 'use') {
      if (!p.held) return;
      const kind = p.held;
      p.held = null;
      p.fx[kind] = rt + C.POWERUPS[kind].dur;
      if (kind === 'rain') p.rain = 1; // the first piece falls at once
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
        Object.assign(m, { trick: true, life: this.D.trickLife, state: 'chase', target: p.id, t: 0 });
      } else if (!(p.fx.giant > rt) && !(p.fx.ghost > rt) && !this.protect(p, 'web')) { // a giant tears through a web, a ghost floats through it
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
    for (const g of this.gems.values()) taken.add(g.spot);
    const s = this.freeSpot(CANDY_SPOTS, taken, special ? 2 : 4);
    if (!s) return;
    const type = special ? (this.R() < 0.65 ? 'pumpkin' : 'rainbow') : this.pick(this.madness ? C.CANDY_MADNESS_WEIGHTS : Object.fromEntries(Object.entries(C.CANDY).map(([k, v]) => [k, v.weight])));
    const c = { id: ++this.candySeq, type, x: s.x, z: s.z, spot: s.i };
    this.candies.set(c.id, c);
    this.emit({ e: 'candy+', id: c.id, type, x: c.x, z: c.z });
  }

  /** Candy rain: a piece falls from the sky somewhere round this player (anyone may grab it once it lands). */
  rainCandy(p) {
    const { radius: [r0, r1], fall, life } = C.POWERUPS.rain;
    const a = this.R() * Math.PI * 2, r = r0 + this.R() * (r1 - r0);
    let [x, z] = slide(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0.4);
    const d = Math.hypot(x, z), lim = MAP_R - 1.5;
    if (d > lim) { x *= lim / d; z *= lim / d; }
    const rt = this.rt, type = this.pick(C.RAIN_MIX);
    const c = { id: ++this.candySeq, type, x: +x.toFixed(2), z: +z.toFixed(2), spot: -1, land: rt + fall, gone: rt + fall + life };
    this.candies.set(c.id, c);
    this.emit({ e: 'candy+', id: c.id, type, x: c.x, z: c.z, fall });
  }

  /** A gem, somewhere worth running to: away from everyone, and not the same kind as one already out. */
  spawnGem() {
    const taken = new Set([...this.candies.values()].map((c) => c.spot));
    for (const g of this.gems.values()) taken.add(g.spot);
    const s = this.freeSpot(CANDY_SPOTS, taken, 9);
    if (!s) return;
    const out = new Set([...this.gems.values()].map((g) => g.kind));
    const kinds = C.GEM_KINDS.filter((k) => !out.has(k));
    const g = { id: ++this.gemSeq, kind: kinds[Math.floor(this.R() * kinds.length)], x: s.x, z: s.z, spot: s.i };
    this.gems.set(g.id, g);
    this.nextGem = this.rt + C.GEM_EVERY[0] + this.R() * (C.GEM_EVERY[1] - C.GEM_EVERY[0]);
    this.emit({ e: 'gem+', id: g.id, kind: g.kind, x: g.x, z: g.z });
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
    PATROLS.ghost.slice(0, this.D.ghost.count).forEach((path, i) => {
      const k = i < 2 ? (farthest(path) + i * Math.floor(path.length / 2)) % path.length : 0;
      const m = this.addMonster('ghost', path, ...path[k]);
      m.wp = (k + 1) % path.length; m.cool = this.D.grace + i;
    });
    PATROLS.zombie.slice(0, this.D.zombie.count).forEach((path) => {
      const k = farthest(path), m = this.addMonster('zombie', path, ...path[k]);
      m.wp = (k + 1) % path.length; m.cool = this.D.grace;
    });
  }

  addMonster(kind, path, x, z) {
    const m = { id: `${kind[0]}${++this.monsterSeq}`, kind, path, wp: 0, x, z, yaw: 0, state: 'patrol', target: null, t: 0, cool: 1, loot: 0 };
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

  /** Does this player frighten this monster? A giant or a candy thief frightens every monster. */
  frightens(p, m) {
    const rt = this.rt;
    return p.fx.giant > rt || p.fx.thief > rt;
  }

  /** A player turned ghost: monsters can't see them or touch them. */
  hidden(p) { return p.fx.ghost > this.rt; }

  /** The nearest player in range that isn't protected, hidden, or frightening to it. */
  nearestPlayer(m, range) {
    let best = null, bd = range;
    for (const p of this.players.values()) {
      if (p.gone || p.inv > this.rt || this.hidden(p) || this.frightens(p, m)) continue;
      const d = dist(m.x, m.z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** The nearest player within `range` that this monster is afraid of. */
  nearestThreat(m, range) {
    let best = null, bd = range;
    for (const p of this.players.values()) {
      if (p.gone || !this.frightens(p, m)) continue;
      const d = dist(m.x, m.z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
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
    // Ghosts may float through walls but stay inside the village.
    const r = Math.hypot(m.x, m.z);
    if (r > 32) { m.x *= 32 / r; m.z *= 32 / r; }
    return Math.hypot(tx - m.x, tz - m.z);
  }

  stepMonster(m, h) {
    const cfg = this.cfg[m.kind], mad = this.madness ? this.D.madnessSpeed : 1;
    m.t += h;
    m.cool -= h;
    if (m.trick) {
      m.life -= h;
      if (m.life <= 0) { this.removeMonster(m); return; }
    }
    if (m.state === 'banished') { // scared off: away for a while, then back on its route
      if (m.t > C.BANISHED) {
        if (m.trick) { this.removeMonster(m); return; }
        const k = farthest(m.path);
        [m.x, m.z] = m.path[k];
        Object.assign(m, { state: 'patrol', wp: (k + 1) % m.path.length, t: 0, cool: this.D.refocus });
      }
      return;
    }
    // A giant or a candy thief close by: run away, and get caught if too slow.
    const threat = this.nearestThreat(m, 9);
    if (threat) {
      if (m.state !== 'flee') { m.state = 'flee'; m.t = 0; m.target = threat.id; }
      this.moveToward(m, m.x + (m.x - threat.x), m.z + (m.z - threat.z), (m.kind === 'ghost' ? 3.0 : 1.5) * mad, h);
      const reach = cfg.reach * (threat.fx.giant > this.rt ? C.GEMS.giant.scale : 1.3);
      if (dist(m.x, m.z, threat.x, threat.z) < reach) this.scare(m, threat);
      return;
    }
    if (m.state === 'flee') { this.giveUp(m); return; }
    switch (m.state) {
      case 'patrol': {
        const [tx, tz] = m.path[m.wp];
        if (this.moveToward(m, tx, tz, cfg.patrol * mad, h) < 0.5) m.wp = (m.wp + 1) % m.path.length;
        if (m.cool <= 0) this.detect(m, cfg.detect);
        break;
      }
      case 'chase': {
        const p = this.players.get(m.target);
        if (!p || p.gone || this.hidden(p) || this.frightens(p, m)) { this.giveUp(m); break; }
        const d = dist(m.x, m.z, p.x, p.z);
        if (!m.trick && (d > cfg.giveUp || m.t > cfg.maxChase)) { this.giveUp(m); break; }
        this.moveToward(m, p.x, p.z, cfg.chase * mad, h);
        if (dist(m.x, m.z, p.x, p.z) < cfg.reach) this.attack(m, p);
        break;
      }
      case 'recover': { // back off from the victim for a moment
        const p = this.players.get(m.target);
        if (p) this.moveToward(m, m.x + (m.x - p.x), m.z + (m.z - p.z), cfg.patrol * 0.8, h);
        if (m.t > this.D.recover) { if (m.trick) this.removeMonster(m); else this.giveUp(m); }
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
    m.state = 'return'; m.target = null; m.t = 0; m.cool = this.D.refocus;
    m.wp = this.nearestWp(m);
  }

  attack(m, p) {
    const rt = this.rt, cfg = this.cfg[m.kind];
    m.state = 'recover'; m.t = 0;
    if (p.inv > rt) return; // still protected from the last hit
    if (this.protect(p, m.kind)) return;
    p.inv = rt + this.D.invulnerable;
    if (m.kind === 'zombie') {
      p.fx.slow = rt + cfg.slow;
      this.emit({ e: 'hit', id: p.id, by: m.kind, mon: m.id, slow: p.fx.slow });
    } else {
      const loss = Math.min(p.score, cfg.penalty);
      p.score -= loss;
      m.loot += loss; // the ghost keeps what it took: a candy thief can win it back
      this.emit({ e: 'hit', id: p.id, by: m.kind, mon: m.id, delta: -loss, score: p.score });
    }
  }

  /** A giant or a candy thief caught a monster: it flees the village for a while and drops its candy. */
  scare(m, p) {
    const rt = this.rt;
    const pts = (m.loot + C.SCARE_LOOT[m.kind]) * (p.fx.double > rt ? 2 : 1);
    p.score += pts;
    this.emit({ e: 'scare', id: p.id, mon: m.id, kind: m.kind, power: p.fx.giant > rt ? 'giant' : 'thief', pts, score: p.score, x: +m.x.toFixed(2), z: +m.z.toFixed(2) });
    Object.assign(m, { loot: 0, state: 'banished', t: 0, target: null });
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
      monsters: this.monsters.map((m) => [m.id, m.kind, +m.x.toFixed(2), +m.z.toFixed(2), Math.round(m.yaw), m.state, m.target, m.loot]),
      level: this.level,
    });
  }
}
