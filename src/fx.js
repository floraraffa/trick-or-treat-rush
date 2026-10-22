// Soft particle sprites (snow spray, dust, splashes, sparkles) in one dynamic mesh: one draw call.
import { BLEND_ADDITIVEALPHA, BLEND_NORMAL, CULLFACE_NONE, Color, Entity, Mesh, MeshInstance, PRIMITIVE_TRIANGLES, StandardMaterial, Vec3 } from 'playcanvas';

export function createFx(app, glowTexture, { max: MAX = 220, additive = false } = {}) {
  const mesh = new Mesh(app.graphicsDevice);
  const pos = new Float32Array(MAX * 12), uv = new Float32Array(MAX * 8), col = new Uint8Array(MAX * 16);
  const idx = new Uint16Array(MAX * 6);
  for (let i = 0; i < MAX; i++) {
    uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  mesh.setPositions(pos);
  mesh.setUvs(0, uv);
  mesh.setColors32(col);
  mesh.setIndices(idx);
  mesh.update(PRIMITIVE_TRIANGLES, false);

  const mat = new StandardMaterial();
  mat.useLighting = false;
  mat.useSkybox = false;
  mat.diffuse = new Color(0, 0, 0);
  mat.emissive = new Color(1, 1, 1);
  mat.emissiveMap = glowTexture;
  mat.emissiveVertexColor = true;
  mat.opacityMap = glowTexture;
  mat.opacityMapChannel = 'a';
  mat.opacityVertexColor = true;
  mat.opacityVertexColorChannel = 'a';
  mat.blendType = additive ? BLEND_ADDITIVEALPHA : BLEND_NORMAL; // additive: fireworks glow
  mat.depthWrite = false;
  mat.cull = CULLFACE_NONE; // spark quads can face either way
  mat.update();

  const mi = new MeshInstance(mesh, mat);
  mi.cull = false;
  const entity = new Entity('fx');
  entity.addComponent('render', { meshInstances: [mi], castShadows: false, receiveShadows: false });

  const ps = [];
  for (let i = 0; i < MAX; i++) ps.push({ life: 0, max: 1, p: new Vec3(), v: new Vec3(), size: 0.3, grow: 1, c: [1, 1, 1], g: 0, a: 1, drag: 1.5, streak: 0, hot: 0, ember: 0, twinkle: false });
  let next = 0;
  const right = new Vec3(), up = new Vec3(), camPos = new Vec3(), dir = new Vec3(), side = new Vec3(), view = new Vec3(), tail = new Vec3();

  return {
    entity,
    /**
     * Emits n particles at `at` with velocity `vel` ± spread, colour [r,g,b] (0..1).
     * streak: draw as a thin line this many seconds of travel long (sparks); hot: the first part of
     * the life (0..1) glows from white to the colour; ember: the last part of the life cools to a dull
     * orange-red; twinkle: flickers; drag: air resistance.
     */
    emit(at, vel, { n = 4, spread = 1, size = 0.3, grow = 2, life = 0.6, color = [1, 1, 1], gravity = -4, alpha = 0.85, drag = 1.5, streak = 0, hot = 0, ember = 0, twinkle = false } = {}) {
      for (let k = 0; k < n; k++) {
        const q = ps[next];
        next = (next + 1) % MAX;
        q.life = q.max = life * (0.7 + Math.random() * 0.6);
        q.p.copy(at);
        q.p.x += (Math.random() - 0.5) * 0.3; q.p.z += (Math.random() - 0.5) * 0.3;
        q.v.set(vel.x + (Math.random() - 0.5) * spread, vel.y + Math.random() * spread * 0.6, vel.z + (Math.random() - 0.5) * spread);
        q.size = size * (0.7 + Math.random() * 0.6);
        q.grow = grow; q.c = color; q.g = gravity; q.a = alpha; q.drag = drag; q.streak = streak; q.hot = hot; q.ember = ember; q.twinkle = twinkle;
      }
    },
    update(dt, camera) {
      const m = camera.getWorldTransform();
      m.getX(right).normalize();
      m.getY(up).normalize();
      camPos.copy(camera.getPosition());
      for (let i = 0; i < MAX; i++) {
        const q = ps[i], o = i * 12;
        if (q.life <= 0) { pos.fill(0, o, o + 12); col.fill(0, i * 16, i * 16 + 16); continue; }
        q.life -= dt;
        q.v.y += q.g * dt;
        q.v.mulScalar(Math.max(0, 1 - dt * q.drag));
        q.p.x += q.v.x * dt; q.p.y += q.v.y * dt; q.p.z += q.v.z * dt;
        const k = 1 - q.life / q.max, s = Math.max(0.01, q.size * (1 + k * q.grow) * 0.5);
        if (q.streak > 0) {
          // A spark: a thin quad from the particle back along its motion, turned to face the camera.
          tail.copy(q.v).mulScalar(-q.streak).add(q.p);
          dir.sub2(q.p, tail);
          view.sub2(q.p, camPos);
          side.cross(dir, view);
          const l = side.length();
          if (l < 1e-6) side.copy(right); else side.mulScalar(1 / l);
          side.mulScalar(s);
          pos.set([
            tail.x - side.x, tail.y - side.y, tail.z - side.z,
            tail.x + side.x, tail.y + side.y, tail.z + side.z,
            q.p.x + side.x, q.p.y + side.y, q.p.z + side.z,
            q.p.x - side.x, q.p.y - side.y, q.p.z - side.z,
          ], o);
        } else {
          const rx = right.x * s, ry = right.y * s, rz = right.z * s, ux = up.x * s, uy = up.y * s, uz = up.z * s;
          pos.set([
            q.p.x - rx - ux, q.p.y - ry - uy, q.p.z - rz - uz,
            q.p.x + rx - ux, q.p.y + ry - uy, q.p.z + rz - uz,
            q.p.x + rx + ux, q.p.y + ry + uy, q.p.z + rz + uz,
            q.p.x - rx + ux, q.p.y - ry + uy, q.p.z - rz + uz,
          ], o);
        }
        let a = Math.max(0, Math.min(1, q.life / q.max * 1.5)) * q.a;
        if (q.twinkle && Math.random() < 0.45) a *= 0.15;
        const h = q.hot > 0 ? Math.max(0, 1 - k / q.hot) : 0; // white-hot at first
        let r = q.c[0] + (1 - q.c[0]) * h, g = q.c[1] + (1 - q.c[1]) * h, b = q.c[2] + (1 - q.c[2]) * h;
        if (q.ember > 0 && k > 1 - q.ember) { // then cooling to embers
          const e = (k - 1 + q.ember) / q.ember;
          r += (1 - r) * e * 0.8; g += (0.32 - g) * e; b += (0.06 - b) * e;
        }
        r *= 255; g *= 255; b *= 255;
        for (let v = 0; v < 4; v++) col.set([r, g, b, a * 255], i * 16 + v * 4);
      }
      mesh.setPositions(pos);
      mesh.setColors32(col);
      mesh.update(PRIMITIVE_TRIANGLES, false);
    },
  };
}

