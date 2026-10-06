import * as THREE from 'three';
// Pooled particle ring-buffer (one draw call) + ambient falling snow that wraps around the player.
export class Particles {
  constructor(scene, max = 800) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3).fill(-9999); this.col = new Float32Array(max * 3).fill(1);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .34, vertexColors: true, transparent: true, opacity: .9, depthWrite: false }));
    this.pts.frustumCulled = false; scene.add(this.pts);
    const N = 320; this.ap = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) this.ap[i] = (Math.random() - .5) * 50;
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(this.ap, 3));
    this.amb = new THREE.Points(ag, new THREE.PointsMaterial({ color: 0xffffff, size: .2, transparent: true, opacity: .85, depthWrite: false }));
    this.amb.frustumCulled = false; scene.add(this.amb);
  }
  emit(x, y, z, n, sp, vx, vy, vz, life = .7, c = [1, 1, 1]) {
    for (let k = 0; k < n; k++) {
      const j = this.i, a = j * 3; this.i = (j + 1) % this.max;
      this.pos[a] = x + (Math.random() - .5) * .6; this.pos[a + 1] = y; this.pos[a + 2] = z;
      this.vel[a] = vx + (Math.random() - .5) * sp; this.vel[a + 1] = vy + Math.random() * sp * .6; this.vel[a + 2] = vz + (Math.random() - .5) * sp;
      this.life[j] = life * (.6 + Math.random() * .6); this.col[a] = c[0]; this.col[a + 1] = c[1]; this.col[a + 2] = c[2];
    }
  }
  update(dt, cx, cy, cz, speed) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue; const a = i * 3;
      if ((this.life[i] -= dt) <= 0) { p[a + 1] = -9999; continue; }
      v[a + 1] -= 14 * dt; p[a] += v[a] * dt; p[a + 1] += v[a + 1] * dt; p[a + 2] += v[a + 2] * dt;
    }
    const q = this.ap, w = (x, c, r) => c + (((x - c + r / 2) % r) + r) % r - r / 2;
    for (let i = 0; i < q.length; i += 3) {
      q[i + 1] -= (3 + (i % 5) * .6) * dt; q[i] += Math.sin(i + cz * .1) * dt * .5;
      q[i] = w(q[i], cx, 50); q[i + 2] = w(q[i + 2], cz - 5, 50); q[i + 1] = w(q[i + 1], cy + 5, 22);
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    this.amb.geometry.attributes.position.needsUpdate = true;
  }
}
