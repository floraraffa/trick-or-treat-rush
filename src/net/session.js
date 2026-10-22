// MultiplayerManager: who is in the room, who is the host, and how requests, events, snapshots and
// poses flow. The host runs the only Authority; everyone else sends it requests and mirrors what it
// announces. Events are numbered so nothing is applied twice; a room holds two to four players.
//
//   hello / hb      a player announces itself / is still here (every second)
//   roster          the host's list of players (every second and on every change)
//   in              a request to the host (knock, pickup, orb, use)
//   ev / snap       the host's events (numbered) and 10 Hz snapshots
//   pose            a player's own position, facing and animation (15 Hz), straight to everyone
//   start-req       a player asks the host to start (the host decides)
//   bye             a player is leaving
import { Authority } from '../game/authority.js';
import { DEFAULT_LEVEL, LEVELS, MAX_PLAYERS } from '../game/config.js';

const HOST_WAIT = 0.8, TIMEOUT = 4.5;

export class Session {
  /** @param {{ transport, me: { id, name, costume } }} o */
  constructor({ transport, me }) {
    this.t = transport;
    this.me = { ...me, joined: Date.now() + Math.random() };
    this.solo = transport.kind === 'solo';
    this.roster = new Map([[this.me.id, { ...this.me, seen: 0 }]]);
    this.hostId = null;
    this.hostSince = 0;
    this.authority = null;
    this.phase = 'lobby'; // the host's phase as last announced: lobby, countdown, playing, over
    this.level = DEFAULT_LEVEL; // this player's choice; the host's is the room's
    this.roomLevel = DEFAULT_LEVEL;
    this.inRound = new Set();
    this.full = false;
    this.lastSeq = 0;
    this.seq = 0;
    this.inSeq = 0;
    this.seenIn = new Map();
    this.clock = 0;
    this.hostSeen = 0;
    this.hbT = 0;
    this.waiting = 0;
    this.listeners = { event: [], snapshot: [], roster: [], pose: [], hostLost: [] };
    transport.onMessage((m) => this.receive(m));
    addEventListener('pagehide', () => this.leave());
    this.elect();
  }

  get isHost() { return this.hostId === this.me.id; }
  on(name, fn) { this.listeners[name].push(fn); }
  fire(name, ...a) { for (const fn of this.listeners[name]) fn(...a); }
  send(m) { this.t.send({ ...m, from: this.me.id }); }

  /** Looks for a host for a moment, then becomes it. In Snapchat (solo) this device is the host at once. */
  elect() {
    this.hostId = null;
    if (this.solo) { this.becomeHost(); return; }
    this.waiting = HOST_WAIT + Math.random() * 0.4;
    this.send({ t: 'hello', p: this.profile() });
  }

  becomeHost() {
    this.hostId = this.me.id;
    this.roomLevel = this.level;
    this.hostSince = Date.now();
    this.lastSeq = 0;
    this.seq = 0;
    this.phase = 'lobby';
    this.authority = new Authority({
      emit: (ev) => this.hostEmit(ev),
      snapshot: (s) => this.hostSnapshot(s),
    });
    this.fire('roster', this.rosterList());
    this.broadcastRoster();
  }

  profile() { return { id: this.me.id, name: this.me.name, costume: this.me.costume, joined: this.me.joined }; }

  setProfile(name, costume) {
    Object.assign(this.me, { name, costume });
    Object.assign(this.roster.get(this.me.id), { name, costume });
    this.send({ t: 'hello', p: this.profile() });
    if (this.isHost) this.broadcastRoster();
    this.fire('roster', this.rosterList());
  }

  /** This player's level; the host's choice is the room's (announced in the roster). */
  setLevel(level) {
    if (!LEVELS.includes(level)) return;
    this.level = level;
    if (this.isHost || this.solo) { this.roomLevel = level; this.broadcastRoster(); }
  }

  rosterList() {
    return [...this.roster.values()].sort((a, b) => a.joined - b.joined).map((p) => ({ id: p.id, name: p.name, costume: p.costume, host: p.id === this.hostId, me: p.id === this.me.id, playing: this.inRound.has(p.id) }));
  }

  broadcastRoster() {
    if (!this.isHost) return;
    this.send({ t: 'roster', host: this.me.id, since: this.hostSince, phase: this.phase, level: this.roomLevel, players: [...this.roster.values()].map(({ seen, ...p }) => p), inRound: [...this.inRound] });
  }

  // --- the host's side -------------------------------------------------------------------------

  /** Host only: starts a round with everyone in the room (the first four). */
  startRound() {
    if (!this.isHost) { this.send({ t: 'start-req', to: this.hostId }); return; }
    const players = [...this.roster.values()].sort((a, b) => a.joined - b.joined).slice(0, MAX_PLAYERS);
    this.authority.start(players.map((p) => ({ id: p.id, name: p.name, costume: p.costume })), this.level);
  }

  hostEmit(ev) {
    if (ev.e === 'start') { this.phase = 'countdown'; this.inRound = new Set(ev.players.map((p) => p.id)); }
    else if (ev.e === 'go') this.phase = 'playing';
    else if (ev.e === 'over') this.phase = 'over';
    const seq = ++this.seq;
    this.send({ t: 'ev', seq, ev });
    this.deliver(seq, ev);
    if (ev.e === 'start' || ev.e === 'over') this.broadcastRoster();
  }

  hostSnapshot(s) {
    this.send({ t: 'snap', s });
    this.fire('snapshot', s);
  }

  /** Back to the lobby after a round (host only; clients follow the roster's phase). */
  toLobby() {
    if (!this.isHost) return;
    this.phase = 'lobby';
    this.inRound = new Set();
    this.authority.phase = 'lobby';
    this.broadcastRoster();
    this.fire('roster', this.rosterList());
  }

  // --- requests and poses ----------------------------------------------------------------------

  /** A request to the authority: { kind: 'knock' | 'pickup' | 'orb' | 'use', ... }. */
  intent(msg) {
    if (this.isHost) { this.authority.intent(this.me.id, msg); return; }
    if (this.hostId) this.send({ t: 'in', to: this.hostId, seq: ++this.inSeq, msg });
  }

  /** This player's own pose, for everyone (and the authority's monster brains). */
  pose(p) {
    if (this.isHost) this.authority?.setPose(this.me.id, p.x, p.z);
    if (!this.solo) this.send({ t: 'pose', p });
  }

  deliver(seq, ev) {
    if (seq <= this.lastSeq) return; // seen it: never apply an event twice
    this.lastSeq = seq;
    this.fire('event', ev);
  }

  receive(m) {
    if (!m || m.from === this.me.id || (m.to && m.to !== this.me.id)) return;
    const known = this.roster.get(m.from);
    if (known) known.seen = this.clock;
    if (m.from === this.hostId) this.hostSeen = this.clock;
    switch (m.t) {
      case 'hello':
      case 'hb': {
        if (m.t === 'hello' || !known) {
          const p = m.p ?? { id: m.from, name: '?', costume: 'none', joined: Date.now() };
          if (!known && this.isHost && this.roster.size >= MAX_PLAYERS) { this.send({ t: 'full', to: m.from }); return; }
          this.roster.set(p.id, { ...(known ?? {}), ...p, seen: this.clock });
          if (this.isHost) this.broadcastRoster();
          this.fire('roster', this.rosterList());
        }
        break;
      }
      case 'roster': {
        if (this.isHost) {
          // Two hosts (a race at start): the older one keeps the room.
          if (m.since < this.hostSince || (m.since === this.hostSince && m.from < this.me.id)) { this.authority = null; this.hostId = null; }
          else { this.broadcastRoster(); return; }
        }
        const hostChanged = this.hostId !== m.host;
        this.hostId = m.host;
        this.hostSeen = this.clock;
        this.waiting = 0;
        if (hostChanged) this.lastSeq = 0;
        this.phase = m.phase;
        if (LEVELS.includes(m.level)) this.roomLevel = m.level;
        this.inRound = new Set(m.inRound);
        const mine = this.roster.get(this.me.id);
        this.roster = new Map(m.players.map((p) => [p.id, { ...p, seen: this.clock }]));
        if (!this.roster.has(this.me.id)) { this.roster.set(this.me.id, mine); this.send({ t: 'hello', p: this.profile() }); }
        this.fire('roster', this.rosterList());
        break;
      }
      case 'full': this.full = true; this.fire('roster', this.rosterList()); break;
      case 'start-req': if (this.isHost && this.phase !== 'countdown' && this.phase !== 'playing') this.startRound(); break;
      case 'in': {
        if (!this.isHost) return;
        if ((this.seenIn.get(m.from) ?? 0) >= m.seq) return; // a repeated request does nothing
        this.seenIn.set(m.from, m.seq);
        this.authority.intent(m.from, m.msg);
        break;
      }
      case 'ev': if (m.from === this.hostId) this.deliver(m.seq, m.ev); break;
      case 'snap': if (m.from === this.hostId) this.fire('snapshot', m.s); break;
      case 'pose': {
        if (this.isHost) this.authority?.setPose(m.from, m.p.x, m.p.z);
        this.fire('pose', m.from, m.p);
        break;
      }
      case 'bye': this.dropPlayer(m.from); break;
    }
  }

  dropPlayer(id) {
    if (!this.roster.has(id)) return;
    this.roster.delete(id);
    if (id === this.hostId) { this.hostLost(); return; }
    if (this.isHost) { this.authority?.drop(id); this.broadcastRoster(); }
    this.fire('roster', this.rosterList());
  }

  hostLost() {
    this.hostId = null;
    this.authority = null;
    this.phase = 'lobby';
    this.inRound = new Set();
    this.fire('hostLost');
    this.elect();
  }

  /** Call every frame with the real elapsed time. */
  update(dt) {
    this.clock += dt;
    if (this.waiting > 0) {
      this.waiting -= dt;
      if (this.waiting <= 0 && !this.hostId) {
        // Nobody answered: the earliest of those who said hello takes the room.
        const first = [...this.roster.values()].sort((a, b) => a.joined - b.joined)[0];
        if (first.id === this.me.id) this.becomeHost(); else this.waiting = 0.6;
      }
    }
    if (this.isHost) this.authority.tick(dt);
    if (this.solo) return;
    this.hbT += dt;
    if (this.hbT >= 1) {
      this.hbT = 0;
      this.send({ t: 'hb', p: this.profile() });
      if (this.isHost) {
        this.broadcastRoster();
        for (const p of [...this.roster.values()]) if (p.id !== this.me.id && this.clock - p.seen > TIMEOUT) this.dropPlayer(p.id);
      } else if (this.hostId && this.clock - this.hostSeen > TIMEOUT) this.hostLost();
    }
  }

  leave() {
    if (!this.solo) this.send({ t: 'bye' });
  }
}
