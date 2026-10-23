// Dev-only scene viewer: ?view=cx,cy,cz,tx,ty,tz frames the village from a camera position to a target.
import { Application, CameraFrame, Color, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO, TONEMAP_NEUTRAL } from 'playcanvas';
import { createTextures } from '../textures.js';
import { createVillage } from '../world/village.js';

const canvas = document.getElementById('app');
const app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
const tex = createTextures(app.graphicsDevice, { base: '../assets/' }); // this page lives in dev/
const village = createVillage(app, tex);
app.root.addChild(village.root);
const camera = new Entity('camera');
camera.addComponent('camera', { fov: 62, nearClip: 0.1, farClip: 700, clearColor: new Color(0.05, 0.05, 0.1) });
app.root.addChild(camera);
const v = (new URLSearchParams(location.search).get('view') ?? '0,6,26,0,3,0').split(',').map(Number);
camera.setPosition(v[0], v[1], v[2]);
camera.lookAt(v[3], v[4], v[5]);
const frame = new CameraFrame(app, camera.camera);
frame.rendering.toneMapping = TONEMAP_NEUTRAL;
frame.bloom.intensity = 0.03;
frame.bloom.blurLevel = 12;
frame.vignette.intensity = 0.45;
frame.update();
village.setClock(0.3);
const m = Number(new URLSearchParams(location.search).get('madness') ?? 0);
village.setMadness(m);
app.on('update', (dt) => village.update(dt, camera));
app.start();
if (!new URLSearchParams(location.search).has("avatars")) tex.ready.then(() => setTimeout(() => { window.__ready = true; }, 1500));
// ?avatars: four default Bitmojis in costume, each playing a different clip.
if (new URLSearchParams(location.search).has('avatars')) {
  const { createAvatar, setAssetBase } = await import('../actors/avatar.js');
  setAssetBase('../assets/');
  const list = [['witch', 'walk'], ['pumpkin', 'run'], ['horns', 'knock'], ['cape', 'cheer']];
  const all = [];
  list.forEach(([c, a], i) => {
    const av = createAvatar(app, tex, { own: false, costume: c });
    av.root.setPosition(-2.4 + i * 1.6, 0.05, 5);
    av.root.setEulerAngles(0, i === 3 ? 160 : 200, 0);
    av.setAnim(a);
    app.root.addChild(av.root);
    all.push(av);
  });
  window.__ready = false;
  Promise.all(all.map((a) => a.ready)).then(() => setTimeout(() => { window.__ready = true; }, 2500));
  app.on('update', (dt) => all.forEach((a) => a.update(dt, 4)));
}
// ?creatures: the five drawn creatures in a row (&anim=1 walks them on the spot; dev/creatures.html shows one from every side).
if (new URLSearchParams(location.search).has('creatures')) {
  const { CREATURES, animateCreature, createCreature } = await import('../actors/creatures.js');
  const { StandardMaterial } = await import('playcanvas');
  const plainMat = new StandardMaterial(); plainMat.diffuseVertexColor = true; plainMat.gloss = 0.3; plainMat.useMetalness = true; plainMat.update();
  const all = CREATURES.map((n, i) => {
    const c = createCreature(app, n, { base: '../assets/', plainMat });
    c.root.setPosition(-4.6 + i * 2.3, 0.05, +(new URLSearchParams(location.search).get('cz') ?? 5)); // &cz=: how far down the street
    c.root.setEulerAngles(0, 0, 0); // facing +Z, towards a camera on that side
    app.root.addChild(c.root);
    return c;
  });
  const walk = new URLSearchParams(location.search).get('anim');
  let t = 0;
  app.on('update', (dt) => { t += dt; for (const c of all) animateCreature(c, t, t * 5, walk ? 1 : 0, walk === 'chase' ? 'chase' : walk === 'flee' ? 'flee' : 'patrol'); });
  window.__ready = false;
  setTimeout(() => { window.__ready = true; }, 5000);
}
