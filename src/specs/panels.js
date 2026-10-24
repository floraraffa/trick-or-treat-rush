// Panels for the headset: inside an immersive session HTML can't be seen, so text and icons are drawn on a
// canvas and shown on a flat card in the player's own space (metres round their head). A panel redraws only
// when what it shows changes. On see-through glasses black is clear, so panels are bright ink on a faint plate.
import { ADDRESS_CLAMP_TO_EDGE, BLEND_NORMAL, CULLFACE_NONE, Color, Entity, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_SRGBA8, StandardMaterial, Texture } from 'playcanvas';

export const TITLE_FONT = 'Griffy', BODY_FONT = 'Mystery Quest';

/** A card `width` × `height` metres, drawn at `px` canvas pixels a metre. Returns { entity, draw(key, fn), opacity, visible }. */
export function createPanel(app, { width, height, px = 1600, name = 'panel', order = 1 }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * px); canvas.height = Math.round(height * px);
  const ctx = canvas.getContext('2d');
  const tex = new Texture(app.graphicsDevice, { name, width: canvas.width, height: canvas.height, format: PIXELFORMAT_SRGBA8, mipmaps: true, minFilter: FILTER_LINEAR_MIPMAP_LINEAR, magFilter: FILTER_LINEAR, addressU: ADDRESS_CLAMP_TO_EDGE, addressV: ADDRESS_CLAMP_TO_EDGE });
  tex.setSource(canvas);
  const mat = new StandardMaterial();
  mat.useLighting = false; mat.useFog = false; mat.useSkybox = false;
  mat.diffuse = new Color(0, 0, 0);
  mat.emissive = new Color(1, 1, 1); mat.emissiveMap = tex;
  mat.opacityMap = tex; mat.opacityMapChannel = 'a';
  mat.blendType = BLEND_NORMAL; mat.depthWrite = false; mat.depthTest = false; mat.cull = CULLFACE_NONE;
  mat.update();
  const holder = new Entity(name), card = new Entity(`${name}-card`);
  // On the UI layer (drawn after the world, in drawOrder): over the village, never hidden by it.
  card.addComponent('render', { type: 'plane', material: mat, castShadows: false, receiveShadows: false, layers: [app.scene.layers.getLayerByName('UI').id] });
  card.render.meshInstances[0].drawOrder = order;
  card.setLocalEulerAngles(90, 0, 0); // the plane primitive faces up: turn it to face the player (+Z)
  card.setLocalScale(width, 1, height);
  holder.addChild(card);
  let key = null;
  return {
    entity: holder, canvas,
    /** Redraws with `fn(ctx, w, h)` when `k` differs from what is shown. */
    draw(k, fn) {
      if (k === key) return;
      key = k;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fn(ctx, canvas.width, canvas.height);
      tex.upload();
    },
    set opacity(v) { if (mat.opacity !== v) { mat.opacity = v; mat.update(); } },
    set visible(v) { holder.enabled = v; },
    get visible() { return holder.enabled; },
  };
}

/** A rounded plate with a gold rim, the game's panel look. */
export function plate(ctx, x, y, w, h, { r = h * 0.3, fill = 'rgba(40,22,58,0.55)', rim = 'rgba(240,190,90,0.9)', line = Math.max(2, h * 0.04) } = {}) {
  ctx.beginPath();
  ctx.roundRect(x + line / 2, y + line / 2, w - line, h - line, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = line; ctx.strokeStyle = rim; ctx.stroke();
}

/** Text with a dark outline (it reads over the village and over the room). */
export function ink(ctx, text, x, y, { size, font = BODY_FONT, color = '#f3e9d8', align = 'center', base = 'middle', outline = size * 0.12, max = Infinity } = {}) {
  ctx.font = `${size}px "${font}"`;
  ctx.textAlign = align; ctx.textBaseline = base;
  let s = size;
  while (s > 8 && ctx.measureText(text).width > max) { s *= 0.92; ctx.font = `${s}px "${font}"`; }
  ctx.lineJoin = 'round'; ctx.lineWidth = outline * (s / size); ctx.strokeStyle = 'rgba(20,8,24,0.9)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
