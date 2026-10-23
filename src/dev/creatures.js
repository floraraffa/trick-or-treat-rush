// Dev-only creature studio: one creature on a plain backdrop, seen from several sides at once, to check
// the puppets' geometry against the drawings.  dev/creatures.html?name=catgirl[&yaws=0,45,90,180][&anim=1|chase|flee][&t=]
import { Application, Color, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO, StandardMaterial } from 'playcanvas';
import { CREATURES, animateCreature, createCreature } from '../actors/creatures.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('app');
const app = new Application(canvas, { graphicsDeviceOptions: { antialias: true } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.scene.ambientLight = new Color(0.35, 0.35, 0.4);
const sun = new Entity('sun');
sun.addComponent('light', { type: 'directional', color: new Color(1, 0.95, 0.9), intensity: 1.2 });
sun.setEulerAngles(50, 30, 0);
app.root.addChild(sun);
const plainMat = new StandardMaterial(); plainMat.diffuseVertexColor = true; plainMat.gloss = 0.3; plainMat.useMetalness = true; plainMat.update();
const name = q.get('name') ?? CREATURES[0];
const yaws = (q.get('yaws') ?? '0,40,90,140,180').split(',').map(Number);
const gap = +(q.get('gap') ?? 1.5);
const all = yaws.map((yaw, i) => {
  const c = createCreature(app, name, { base: '../assets/', plainMat });
  c.root.setPosition((i - (yaws.length - 1) / 2) * gap, 0, 0);
  c.root.setEulerAngles(0, yaw, 0);
  app.root.addChild(c.root);
  return c;
});
const camera = new Entity('camera');
const span = Math.max(2.8, yaws.length * gap * 0.62);
camera.addComponent('camera', { projection: 1, orthoHeight: +(q.get('zoom') ?? span / 1.9), clearColor: new Color(0.42, 0.44, 0.48) });
camera.setPosition(0, +(q.get('cy') ?? 1.25), 20);
camera.lookAt(0, +(q.get('cy') ?? 1.25), 0);
app.root.addChild(camera);
const walk = q.get('anim'), t0 = +(q.get('t') ?? 0.4);
let t = t0;
app.on('update', (dt) => {
  if (walk) t += dt;
  for (const c of all) animateCreature(c, t, walk ? t * 5 : 0, walk ? 1 : 0, walk === 'chase' ? 'chase' : walk === 'flee' ? 'flee' : 'patrol');
});
app.start();
setTimeout(() => { window.__ready = true; }, 3500);
