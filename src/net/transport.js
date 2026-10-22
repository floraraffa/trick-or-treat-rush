// How messages travel between the players of a session.
//
// Inside Snapchat a Web Lens has no network at all: the Lens CSP blocks fetch, WebSocket and WebRTC,
// and @snap/web-lens-api 0.1.2 offers no realtime or session capability. So on a phone the session
// is a room of one: LoopbackTransport, with this device as the authority. The game code is the same
// either way (requests → authority → numbered events and snapshots).
//
// BroadcastTransport links real, separate game instances that share a browser (windows or tabs on a
// desktop, `?room=NAME`): each one is its own player with its own input and camera. It exists to run
// and test the multiplayer protocol for real. Swapping in a network transport here is the only change
// needed if Snap ever ships a realtime capability for Web Lenses.

export class LoopbackTransport {
  constructor() { this.kind = 'solo'; }
  send() {}
  onMessage() {}
  close() {}
}

export class BroadcastTransport {
  constructor(room) {
    this.kind = 'room';
    this.room = room;
    this.ch = new BroadcastChannel(`trick-or-treat-rush:${room}`);
    this.handler = null;
    this.ch.onmessage = (ev) => this.handler?.(ev.data);
  }
  send(msg) { this.ch.postMessage(msg); }
  onMessage(fn) { this.handler = fn; }
  close() { this.ch.close(); }
}

/** The transport for this launch: a room when the page was opened with ?room=NAME and the browser can do it. */
export function createTransport(params) {
  const room = params.get('room');
  if (room && typeof BroadcastChannel !== 'undefined') return new BroadcastTransport(room.slice(0, 24));
  return new LoopbackTransport();
}
