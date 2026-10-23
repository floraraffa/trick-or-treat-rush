// The vampire's face for the costume picker (and the lobby and ranking): drawn here so it looks the same
// on every phone, in the game's storybook style. Pale skin, a widow's peak, pointed ears, red eyes,
// fangs and a tall red-lined collar.
const SVG = `<svg class="face" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="vSkin" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#f6f0fb"/><stop offset=".7" stop-color="#d4c6e3"/><stop offset="1" stop-color="#a893c0"/></radialGradient>
    <radialGradient id="vEye" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd2d2"/><stop offset=".45" stop-color="#ff2a3a"/><stop offset="1" stop-color="#7a0010"/></radialGradient>
    <linearGradient id="vHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2650"/><stop offset="1" stop-color="#0f0a16"/></linearGradient>
  </defs>
  <path d="M3 63 L8 22 L24 42 L32 46 L40 42 L56 22 L61 63 Z" fill="#160d1e"/>
  <path d="M8 60 L11 28 L24 44 L32 48 L40 44 L53 28 L56 60 Z" fill="#a3101f"/>
  <path d="M15 33 L5 19 L17 41 Z" fill="#c9b9da"/><path d="M49 33 L59 19 L47 41 Z" fill="#c9b9da"/>
  <path d="M32 9 C45 9 50 20 50 31 C50 45 41 55 32 57 C23 55 14 45 14 31 C14 20 19 9 32 9 Z" fill="url(#vSkin)"/>
  <path d="M14 31 C11 13 22 4 32 4 C42 4 53 13 50 31 C48 22 45 18 40 16.5 L32 27 L24 16.5 C19 18 16 22 14 31 Z" fill="url(#vHair)"/>
  <path d="M21 10.5 C26 7.5 37 7.5 43 10.5" stroke="#6b4c8f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M19.5 30 L29 33.5" stroke="#1a1022" stroke-width="2.6" stroke-linecap="round"/><path d="M44.5 30 L35 33.5" stroke="#1a1022" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M20.5 37 Q25 33.5 29.5 37 Q25 39.5 20.5 37 Z" fill="url(#vEye)"/><path d="M34.5 37 Q39 33.5 43.5 37 Q39 39.5 34.5 37 Z" fill="url(#vEye)"/>
  <ellipse cx="25" cy="36.8" rx=".8" ry="1.9" fill="#1a0006"/><ellipse cx="39" cy="36.8" rx=".8" ry="1.9" fill="#1a0006"/>
  <path d="M32 38 L30.5 44 L33.5 44" stroke="#9a86b0" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24.5 47 Q32 52.5 39.5 47 Q32 50 24.5 47 Z" fill="#6d0a1a"/>
  <path d="M27.2 48.2 L28.6 53.2 L30.2 49.2 Z" fill="#fff"/><path d="M33.8 49.2 L35.4 53.2 L36.8 48.2 Z" fill="#fff"/>
  <circle cx="28.6" cy="55" r="1" fill="#c8102e"/>
</svg>`;

/** The face as SVG markup; each copy gets its own gradient ids (a hidden copy's gradients don't paint the others). */
let copies = 0;
export function vampireFace() {
  const n = ++copies;
  return SVG.replace(/\b(vSkin|vEye|vHair)\b/g, `$1${n}`);
}
