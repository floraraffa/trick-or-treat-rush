// Textures: CC0 Poly Haven photos (public/assets/tex, inherited from Cruise Rush) for siding, stone,
// bark, earth and moss, tinted by vertex colour into the village palette, plus a few painted at
// startup (shingles, cobbles, lit windows, the clock face, the moon, soft glows): no extra downloads.
import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8, Texture } from 'playcanvas';
import { rng } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(device, src, { repeat = true, linear = false } = {}) {
  const t = new Texture(device, {
    width: src.width, height: src.height, format: linear ? PIXELFORMAT_RGBA8 : PIXELFORMAT_SRGBA8, mipmaps: true,
    minFilter: FILTER_LINEAR_MIPMAP_LINEAR, magFilter: FILTER_LINEAR, anisotropy: 4,
    addressU: repeat ? ADDRESS_REPEAT : ADDRESS_CLAMP_TO_EDGE, addressV: repeat ? ADDRESS_REPEAT : ADDRESS_CLAMP_TO_EDGE,
  });
  t.setSource(src);
  return t;
}

/** Swaps the photo in once it has loaded; until then the texture shows the stand-in colour. */
function loadInto(tex, url, pending) {
  pending.push(new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { tex.resize(img.width, img.height); tex.setSource(img); resolve(true); };
    img.onerror = () => { console.warn('[tex] missing', url); resolve(false); };
    img.src = url;
  }));
}

const PAINTERS = {
  plain() {
    const [c, g] = canvas(4, 4);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
    return c;
  },
  // Soft round sprite for glows, light pools, fog and sparkles.
  glow() {
    const [c, g] = canvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
  },
  // Fish-scale shingles in rows, light grey so the vertex colour sets the hue.
  shingles() {
    const [c, g] = canvas(256, 256), r = rng(4);
    g.fillStyle = '#3a3a40';
    g.fillRect(0, 0, 256, 256);
    const rows = 8, cols = 8, rh = 256 / rows, cw = 256 / cols;
    for (let y = -1; y <= rows; y++) {
      for (let x = -1; x <= cols; x++) {
        const ox = (y % 2) * cw / 2 + x * cw, oy = y * rh;
        const l = 150 + r() * 70;
        g.fillStyle = `rgb(${l},${l},${l + 6})`;
        g.beginPath();
        g.moveTo(ox + 2, oy);
        g.lineTo(ox + cw - 2, oy);
        g.lineTo(ox + cw - 2, oy + rh * 0.55);
        g.quadraticCurveTo(ox + cw / 2, oy + rh * 1.35, ox + 2, oy + rh * 0.55);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    return c;
  },
  // Rounded cobbles with dark joints, for the winding streets.
  cobbles() {
    const [c, g] = canvas(256, 256), r = rng(9);
    g.fillStyle = '#1e1c22';
    g.fillRect(0, 0, 256, 256);
    const rows = 9;
    for (let y = 0; y < rows; y++) {
      let x = (y % 2) * -14;
      const h = 256 / rows;
      while (x < 256) {
        const w = 22 + r() * 18, l = 105 + r() * 60, t = r() * 14;
        for (const dx of [0, -256, 256]) { // wrap horizontally
          g.fillStyle = `rgb(${l + t},${l},${l + 10})`;
          g.beginPath();
          g.ellipse(x + w / 2 + dx, y * h + h / 2, w / 2 - 2, h / 2 - 2.5, (r() - 0.5) * 0.3, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,.12)';
          g.beginPath();
          g.ellipse(x + w / 2 + dx - 2, y * h + h / 2 - 3, w / 3, h / 5, 0, 0, Math.PI * 2);
          g.fill();
        }
        x += w;
      }
    }
    return c;
  },
  // A lit window pane: warm glow brightest low in the middle, four panes behind dark mullions.
  window() {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 84, 6, 64, 70, 90);
    grd.addColorStop(0, '#fff3c4');
    grd.addColorStop(0.5, '#ffc45e');
    grd.addColorStop(1, '#c4621c');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#2a1a12';
    g.fillRect(58, 0, 12, 128);
    g.fillRect(0, 56, 128, 10);
    g.lineWidth = 10;
    g.strokeStyle = '#2a1a12';
    g.strokeRect(0, 0, 128, 128);
    return c;
  },
  // The plaza clock: an aged ivory face with Roman-style ticks (the hands are separate and move).
  clock() {
    const [c, g] = canvas(256, 256);
    g.fillStyle = 'rgba(0,0,0,0)';
    g.clearRect(0, 0, 256, 256);
    const grd = g.createRadialGradient(128, 118, 10, 128, 128, 126);
    grd.addColorStop(0, '#fff6dc');
    grd.addColorStop(1, '#d9c08a');
    g.fillStyle = grd;
    g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a1a';
    g.lineWidth = 8;
    g.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.save();
      g.translate(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
      g.rotate(a);
      g.fillStyle = '#3a2a1a';
      const n = k % 3 === 0 ? 3 : 1;
      for (let i = 0; i < n; i++) g.fillRect(-2 - (n - 1) * 4 + i * 8, -12, 4, 24);
      g.restore();
    }
    return c;
  },
  // A pale moon with soft maria.
  moon() {
    const [c, g] = canvas(256, 256), r = rng(12);
    const grd = g.createRadialGradient(118, 112, 10, 128, 128, 118);
    grd.addColorStop(0, '#fffbea');
    grd.addColorStop(0.8, '#efe4c8');
    grd.addColorStop(1, '#d8c9a8');
    g.fillStyle = grd;
    g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 90, s = 6 + r() * 26;
      g.fillStyle = `rgba(150,140,130,${0.08 + r() * 0.16})`;
      g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, s, 0, Math.PI * 2); g.fill();
    }
    return c;
  },
};

const PHOTOS = ['grass', 'dirt', 'rock', 'wood', 'bark', 'sidewalk'];
const CLAMPED = new Set(['glow', 'window', 'clock', 'moon']);
const AVERAGE = { grass: '#50553a', dirt: '#4b3c2c', rock: '#7d7366', wood: '#8a8a88', bark: '#5a3a2a', sidewalk: '#8b8780' };

/** { plain, glow, shingles, ..., grass, wood, ... } and `normals.<photo>`; `ready` resolves when the photos are in. */
export function createTextures(device) {
  const pending = [];
  const out = { normals: {} };
  for (const [name, paint] of Object.entries(PAINTERS)) out[name] = toTexture(device, paint(), { repeat: !CLAMPED.has(name) });
  for (const name of PHOTOS) {
    const [c, g] = canvas(4, 4);
    g.fillStyle = AVERAGE[name];
    g.fillRect(0, 0, 4, 4);
    out[name] = toTexture(device, c);
    loadInto(out[name], `./assets/tex/${name}.webp`, pending);
    const [cn, gn] = canvas(4, 4);
    gn.fillStyle = 'rgb(128,128,255)';
    gn.fillRect(0, 0, 4, 4);
    out.normals[name] = toTexture(device, cn, { linear: true });
    loadInto(out.normals[name], `./assets/tex/${name}_n.webp`, pending);
  }
  out.ready = Promise.all(pending);
  return out;
}
