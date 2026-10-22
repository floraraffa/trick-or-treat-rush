// Thin wrapper over the Snapchat Web Lens API: every call degrades gracefully, so the game
// stays fully playable without Bitmoji, leaderboards or storage (desktop stub, Android, old hosts).
import snapchat from '@snap/web-lens-api';

let ready = false;
// What each capability answered, for the diagnostics panel.
export const report = { caps: null, initError: null, submit: null, show: null, load: null };

export async function initSnap() {
  try {
    report.caps = await snapchat.init();
    ready = true;
  } catch (e) {
    report.initError = e.message;
    console.warn('[snap] init failed:', e.message);
  }
  return { isStub: snapchat.isStub, bitmoji: has('bitmoji'), leaderboards: has('leaderboards'), storage: has('storage') };
}

export const has = (cap) => ready && snapchat.isSupported(cap);
export { snapchat };

// --- Bitmoji ---------------------------------------------------------------

/** URL of the player's 2D portrait, or null. URLs expire after ~5 min: load right away. */
export async function portraitUrl(variant) {
  if (!has('bitmoji')) return null;
  try {
    const { hasAvatar } = await snapchat.bitmoji.getAvatarInfo();
    if (!hasAvatar) return null;
    const { url } = await snapchat.bitmoji.get2DAvatar({ variant, size: 'large' });
    // The URL expires in about five minutes: keep our own copy, so the ranking can show it all session.
    try { return URL.createObjectURL(await (await fetch(url)).blob()); } catch { return url; }
  } catch (e) {
    console.warn('[snap] portrait:', e.message);
    return null;
  }
}

// --- Leaderboard -----------------------------------------------------------

let lastSubmit = Promise.resolve(null);

/** Candy collected in a night: more is better, so the board's default 'descending' order. Resolves with the server's best, or null. */
export function submitScore(score) {
  lastSubmit = sendScore(score);
  return lastSubmit;
}

async function sendScore(score) {
  if (!has('leaderboards')) return null;
  try {
    const { bestScore } = await snapchat.leaderboards.submitScore({ score: Math.max(0, Math.round(score)) });
    report.submit = `ok (${Math.round(score)}, best ${bestScore ?? '?'})`;
    return bestScore ?? null;
  } catch (e) {
    report.submit = `error ${e.message}`;
    console.warn('[snap] submitScore:', e.message);
    return null;
  }
}

/** Opens Snapchat's leaderboard panel, after the latest score has landed so it has data. */
export async function showLeaderboard() {
  if (!has('leaderboards')) return false;
  await lastSubmit;
  try {
    await snapchat.leaderboards.show();
    report.show = 'ok';
    return true;
  } catch (e) {
    report.show = `error ${e.message}`;
    console.warn('[snap] show leaderboard:', e.message);
    return false;
  }
}

// --- Storage ---------------------------------------------------------------
// Inside Snapchat the save goes to the Web Lens API's storage, the only store that survives a
// launch. Outside Snapchat (desktop stub, the web demo) that store only lives in memory, so the
// save goes to the browser's localStorage instead, which does survive a reload there.
// No writes until the first read has answered, one write in flight at a time,
// and a save when the page is hidden (a Lens closes by swipe, with no teardown).

const SAVE_KEY = 'save';
let loaded = false;
let pending = Promise.resolve();
let current = null;

const LOCAL_KEY = 'trick-or-treat-rush-save';
const useLocal = () => snapchat.isStub || !has('storage');

function localRead() {
  try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function localWrite(state) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* private mode or blocked: keep playing */ }
}

export async function loadSave(defaults) {
  current = structuredClone(defaults);
  if (useLocal()) {
    const value = localRead();
    if (value && typeof value === 'object') current = { ...current, ...value };
    loaded = true;
    report.load = value ? 'ok (browser save found)' : 'ok (new player, browser save)';
    return current;
  }
  try {
    const res = await snapchat.storage.get(SAVE_KEY);
    if (res.found && res.value && typeof res.value === 'object') current = { ...current, ...res.value };
    loaded = true;
    report.load = res.found ? 'ok (save found)' : 'ok (new player)';
  } catch (e) {
    report.load = `error ${e.message}`;
    console.warn('[snap] load save (saving disabled this session):', e.message);
  }
  return current;
}

// Snapchat caps a stored value at 32 KiB, and a write over it is refused whole. Only the list of
// past nights grows, so it is what gets trimmed when space runs short.
const MAX_VALUE_BYTES = 30 * 1024;

export function save(state = current) {
  current = state;
  if (!loaded) return pending;
  let snapshot = structuredClone(state);
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_VALUE_BYTES) snapshot = { ...snapshot, nights: (snapshot.nights ?? []).slice(0, 3) };
  if (useLocal()) { localWrite(snapshot); return pending; }
  pending = pending
    .then(() => snapchat.storage.set(SAVE_KEY, snapshot))
    .catch((e) => console.warn('[snap] save:', e.message));
  return pending;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && current) save();
});

/** Everything the diagnostics panel shows, asked fresh from the host. */
export async function diagnostics() {
  const out = { version: snapchat.version, isStub: snapchat.isStub, ...report };
  if (has('bitmoji')) {
    try { out.hasAvatar = (await snapchat.bitmoji.getAvatarInfo()).hasAvatar; } catch (e) { out.hasAvatar = `error ${e.message}`; }
  }
  if (useLocal()) out.storage = 'browser localStorage (outside Snapchat)';
  else if (has('storage')) {
    try {
      const i = await snapchat.storage.getInfo();
      out.storage = `${i.persistenceMode}, ${i.usedBytes}/${i.maxBytes} bytes, ${i.keyCount} keys`;
    } catch (e) { out.storage = `error ${e.message}`; }
  }
  return out;
}
