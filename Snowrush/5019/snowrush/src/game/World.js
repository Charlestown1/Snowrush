import * as THREE from 'three';
// Procedural endless mountain: recycled terrain chunks + pooled objects spawned in "rows".
// Every row keeps a guaranteed clear corridor (px +/- gh) so a path always exists.
export const groundH = (x, z) => 0.22 * z + 0.6 * Math.sin(x * .15 + z * .04) + 0.5 * Math.sin(z * .09 - x * .05)
  + Math.max(0, Math.abs(x) - 17) * .5 * (1 + .5 * Math.sin(z * .05));
const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .9, ...o });
const mat = { snow: M(0xffffff), pine: M(0x1f5a45), trunk: M(0x5a3b26), rock: M(0x7d8794), wood: M(0x8a5a33), dark: M(0x20242c),
  coin: M(0xffd23f, { emissive: 0xffa800, emissiveIntensity: .7 }), boost: M(0x35e0ff, { emissive: 0x18b8ff, emissiveIntensity: .9 }) };
const G = { cone: new THREE.ConeGeometry(1, 1, 7), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 8, 6), rock: new THREE.DodecahedronGeometry(1.2), coin: new THREE.TorusGeometry(.5, .15, 6, 14) };
const part = (geo, m, p, s) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); o.scale.set(...s); o.castShadow = true; return o; };
const rampGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(5, 0); s.lineTo(5, 1.4); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: false }); g.translate(0, 0, -2); g.rotateY(Math.PI / 2); g.translate(0, 0, 2.5); return g; })();
// type -> [collision radius, height]
const R = { tree: [1, 6], rock: [1.3, 1.6], log: [1.6, .8], fence: [1.7, 1.1], snowman: [.9, 2.2] };
const MAKE = {
  tree() { const g = new THREE.Group(); g.add(part(G.cyl, mat.trunk, [0, .6, 0], [.3, 1.2, .3]));
    [[2.2, 1.5, 2.2], [3.4, 1.2, 1.9], [4.5, .85, 1.6]].forEach(([y, r, h]) => { g.add(part(G.cone, mat.pine, [0, y, 0], [r, h, r])); g.add(part(G.cone, mat.snow, [0, y + h * .2, 0], [r * .8, h * .65, r * .8])); }); return g; },
  rock() { const m = part(G.rock, mat.rock, [0, .5, 0], [1, .8, 1]); const g = new THREE.Group(); g.add(m); return g; },
  log() { const g = new THREE.Group(); g.add(part(G.cyl, mat.wood, [0, .4, 0], [.4, 3.2, .4])); g.children[0].rotation.z = Math.PI / 2; return g; },
  fence() { const g = new THREE.Group(); [-1.4, 1.4].forEach(x => g.add(part(G.box, mat.wood, [x, .55, 0], [.2, 1.1, .2])));
    [.4, .85].forEach(y => g.add(part(G.box, mat.wood, [0, y, 0], [3.2, .15, .1]))); return g; },
  snowman() { const g = new THREE.Group(); g.add(part(G.sph, mat.snow, [0, .6, 0], [.7, .7, .7]), part(G.sph, mat.snow, [0, 1.4, 0], [.5, .5, .5]),
    part(G.sph, mat.snow, [0, 2, 0], [.35, .35, .35]), part(G.cyl, mat.dark, [0, 2.4, 0], [.3, .3, .3])); return g; },
  ramp() { const m = new THREE.Mesh(rampGeo, M(0xeaf4ff)); m.castShadow = m.receiveShadow = true; const g = new THREE.Group(); g.add(m); return g; },
  coin() { const g = new THREE.Group(); g.add(part(G.coin, mat.coin, [0, 0, 0], [1, 1, 1])); g.add(part(G.coin, mat.coin, [0, 0, 0], [.55, .55, .55])); g.children.forEach(c => c.castShadow = false); return g; },
  boost() { const g = new THREE.Group(); g.add(part(G.box, mat.boost, [0, .08, 0], [3, .12, 4])); const a = part(G.cone, mat.snow, [0, .2, 0], [.8, 1.6, .8]); a.rotation.x = -Math.PI / 2; g.add(a); return g; },
};
const KINDS = { open: 2, forest: 3, rocks: 3, slalom: 4, canyon: 3, ramp: 2, boost: 1 };

export class World {
  constructor(scene) {
    this.scene = scene; this.active = []; this.free = {}; this.chunks = []; this.tm = 0;
    const cm = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(120, 80, 30, 20); geo.rotateX(-Math.PI / 2);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
      const mesh = new THREE.Mesh(geo, cm); mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh); this.chunks.push({ mesh, z: 0 });
    }
    // distant mountains, repositioned to follow the player
    this.mount = new THREE.Group(); const mm = M(0x8fa6c4);
    for (let i = 0; i < 7; i++) { const s = rnd(.8, 1.4), x = -270 + i * 90 + rnd(-20, 20);
      const m = new THREE.Mesh(G.cone, mm); m.scale.set(95 * s, 140 * s, 95 * s); m.position.set(x, 55 * s, rnd(-40, 40)); const c = new THREE.Mesh(G.cone, mat.snow);
      c.scale.set(32 * s, 48 * s, 32 * s); c.position.set(x, 118 * s, m.position.z); this.mount.add(m, c); }
    scene.add(this.mount); this.reset();
  }
  setChunk(c, z) {
    const pa = c.mesh.geometry.attributes.position, ca = c.mesh.geometry.attributes.color;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), lz = pa.getZ(i), n = (Math.sin(x * .3) * Math.sin((z + lz) * .2) + 1) / 2;
      pa.setY(i, groundH(x, z + lz)); ca.setXYZ(i, .84 + .14 * n, .9 + .1 * n, 1); }
    pa.needsUpdate = ca.needsUpdate = true; c.mesh.position.set(0, 0, z); c.z = z;
  }
  reset() {
    while (this.active.length) this.release(0);
    this.chunks.forEach((c, i) => this.setChunk(c, -i * 80));
    this.nextZ = -40; this.px = 0; this.sd = 1; this.kind = 'open'; this.secLeft = 3;
  }
  get(type) { const f = this.free[type] || (this.free[type] = []); return f.pop() || MAKE[type](); }
  release(i) { const o = this.active[i]; this.scene.remove(o.mesh); this.free[o.type].push(o.mesh);
    const l = this.active.pop(); if (i < this.active.length) this.active[i] = l; }
  add(type, x, z, { sc = 1, dy = 0, decor = false } = {}) {
    const m = this.get(type), gy = groundH(x, z), [r, h] = R[type] || [0, 0];
    m.position.set(x, gy + (type === 'coin' ? 1.2 + dy : 0), z); m.scale.setScalar(sc);
    m.rotation.set(type === 'ramp' ? -.215 : 0, type === 'ramp' || type === 'coin' ? 0 : (type === 'fence' || type === 'log' ? rnd(-.2, .2) : rnd(0, 6.28)), 0);
    this.scene.add(m);
    this.active.push({ type, mesh: m, x, z, y: m.position.y, gy, r: decor ? 0 : r * sc, h: h * sc, sc, done: false, minD: 99, decor });
  }
  pick(t) {
    const o = ['open', 'forest', 'ramp', 'boost']; if (t > 15) o.push('rocks', 'slalom', 'forest', 'ramp'); if (t > 45) o.push('canyon', 'canyon', 'rocks');
    let k; do k = o[Math.random() * o.length | 0]; while (k === this.kind); this.kind = k; this.secLeft = KINDS[k];
  }
  // Spawns one row of obstacles/collectibles; difficulty (density, new section types) scales with run time t.
  row(speed, t) {
    const z = this.nextZ, diff = Math.min(1, t / 120), k = this.kind; let gh = Math.max(3, 5.2 - diff * 1.6);
    if (k === 'slalom') { this.sd *= -1; this.px = this.sd * 4; gh = 3.4; }
    else if (k === 'canyon') { this.px = clamp(this.px + rnd(-2, 2), -4, 4); gh = 4.2; }
    else this.px = clamp(this.px + rnd(-6, 6), -9, 9);
    const px = this.px, gap = 8 + speed * .45;
    const place = (types, n) => { for (let i = 0; i < n; i++) { const ty = types[Math.random() * types.length | 0], sc = ty === 'tree' ? rnd(.9, 1.3) : ty === 'rock' ? rnd(.8, 1.5) : 1;
      for (let tr = 0; tr < 4; tr++) { const x = rnd(-14, 14); if (Math.abs(x - px) > gh + R[ty][0] * sc + .3) { this.add(ty, x, z + rnd(-3, 3), { sc }); break; } } } };
    const coins = () => { const ox = rnd(-1, 1) * (gh - 1.5); for (let i = 0; i < 5; i++) this.add('coin', px + ox, z - i * 3); };
    const d = diff * 4 | 0;
    if (k === 'open') { place(['rock', 'tree'], 1); coins(); }
    else if (k === 'forest') { place(['tree'], 4 + d); if (Math.random() < .4) coins(); }
    else if (k === 'rocks') { place(['rock', 'rock', 'log', 'fence'], 3 + d); if (Math.random() < .4) coins(); }
    else if (k === 'slalom') { place(['tree', 'snowman', 'rock'], 3 + d); coins(); }
    else if (k === 'canyon') { for (const s of [-1, 1]) for (let j = 0; j < 2; j++) this.add(Math.random() < .5 ? 'rock' : 'tree', px + s * (gh + 1.2 + rnd(0, 1.5)), z - j * 6 + rnd(-1, 1), { sc: rnd(1, 1.3) }); if (Math.random() < .5) coins(); }
    else if (k === 'ramp') { const sc = Math.random() < .3 ? 1.5 : 1; this.add('ramp', px, z, { sc });
      for (let i = 0; i < 5; i++) this.add('coin', px, z - 9 * sc - i * 2.4, { dy: Math.sin(i / 4 * Math.PI) * (sc > 1 ? 5 : 3.2) }); place(['rock'], 1); }
    else if (k === 'boost') { this.add('boost', px, z); coins(); place(['rock'], 2); }
    for (let i = 0; i < 6; i++) this.add(Math.random() < .8 ? 'tree' : 'rock', (Math.random() < .5 ? -1 : 1) * rnd(18, 45), z - rnd(0, gap), { sc: rnd(1, 1.7), decor: true });
    this.nextZ -= gap; if (--this.secLeft <= 0) this.pick(t);
  }
  // Height of ramp surface under (x,z) (0 if none).
  surf(x, z) {
    let h = 0;
    for (const o of this.active) { if (o.type !== 'ramp') continue; const dz = z - o.z, s = o.sc;
      if (Math.abs(x - o.x) < 2 * s && dz > -2.5 * s && dz < 2.5 * s) h = Math.max(h, (2.5 * s - dz) / (5 * s) * 1.4 * s); }
    return h;
  }
  update(dt, p, speed, t) {
    this.tm += dt; while (this.nextZ > p.z - 240) this.row(speed, t);
    for (const c of this.chunks) if (c.z - 40 > p.z + 60) this.setChunk(c, Math.min(...this.chunks.map(k => k.z)) - 80);
    this.mount.position.set(p.x * .9, .22 * (p.z - 380) - 25, p.z - 380);
  }
  // Collision, pickups and near-miss detection. Objects behind the player are recycled.
  check(p, cb) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i], dz = o.z - p.z;
      if (dz > 18) { this.release(i); continue; }
      if (o.type === 'coin') { o.mesh.rotation.y = this.tm * 3; o.mesh.position.y = o.y + Math.sin(this.tm * 3 + o.z) * .15; }
      if (!o.done && o.r > 0 && dz > 1.5) { o.done = true; if (o.minD < o.r + 1.4) cb.near(); continue; }
      if (o.done || Math.abs(dz) > 6) continue;
      const dx = o.x - p.x, d = Math.hypot(dx, dz);
      if (o.r > 0) { if (d < o.minD) o.minD = d; if (d < o.r + .45 && p.y < o.gy + o.h) { cb.crash(); return; } }
      else if (o.type === 'coin') { if (d < 1.7 && Math.abs(p.y + .9 - o.y) < 1.7) { o.done = true; cb.coin(o); this.release(i); } }
      else if (o.type === 'boost') { if (Math.abs(dx) < 1.8 && Math.abs(dz) < 2.2 && p.y < o.gy + 1.5) { o.done = true; cb.boost(); } }
    }
  }
}
