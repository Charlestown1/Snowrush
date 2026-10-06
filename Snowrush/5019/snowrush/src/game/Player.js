import * as THREE from 'three';
import { groundH } from './World.js';
const mt = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .8 });
const bx = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
// Low-poly snowboarder with lean/crouch/air/crash animation.
export class Player {
  constructor(scene) {
    this.g = new THREE.Group(); this.rig = new THREE.Group(); this.g.add(this.rig);
    const jk = mt(0xff7a3d), pn = mt(0x24324a), sk = mt(0xf2c8a0);
    this.board = bx(.75, .08, 2.3, mt(0x1b6ef3), 0, .06, 0); this.rig.add(this.board);
    this.rig.add(bx(.2, .7, .22, pn, 0, .45, .55), bx(.2, .7, .22, pn, 0, .45, -.55));
    this.torso = bx(.55, .6, .35, jk, 0, 1.1, 0); this.rig.add(this.torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.21, 8, 6), sk); head.position.y = 1.6; head.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.23, .3, 7), mt(0xffffff)); cap.position.y = 1.8; this.torso.add(head, cap); head.position.y = .5; cap.position.y = .72;
    this.arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * .36, 1.3, 0); a.add(bx(.14, .55, .14, jk, 0, -.25, 0)); this.rig.add(a); return a; });
    scene.add(this.g); this.reset();
  }
  reset() {
    this.x = 0; this.z = 0; this.vx = 0; this.vy = 0; this.y = groundH(0, 0); this.gy = this.y; this.ground = true; this.crashed = false;
    this.airT = 0; this.prevSurf = 0; this.squash = 0; this.g.rotation.set(0, 0, 0); this.rig.rotation.set(0, 0, 0); this.rig.scale.set(1, 1, 1);
    this.rig.add(this.board); this.board.position.set(0, .06, 0); this.board.rotation.set(0, 0, 0); this.pose(0); this.sync();
  }
  sync() { this.g.position.set(this.x, this.y, this.z); }
  jump() { if (!this.ground || this.crashed) return false; this.ground = false; this.vy = 8.5; this.airT = 0; return true; }
  pose(air) { const a = this.arms; a[0].rotation.z = -air * 1.2; a[1].rotation.z = air * 1.2; this.torso.rotation.x = air ? .1 : -.25; }
  update(dt, inp, w, speed) {
    this.vx += (inp.steer * 16 * (this.ground ? 1 : .8) - this.vx) * Math.min(1, (this.ground ? 5 : 2.5) * dt);
    this.x += this.vx * dt; if (Math.abs(this.x) > 15.5) { this.x = Math.sign(this.x) * 15.5; this.vx = 0; }
    const gOld = groundH(this.x, this.z); this.z -= speed * dt; const gb = groundH(this.x, this.z), sf = w.surf(this.x, this.z), gr = gb + sf; let ev = null;
    if (this.ground) {
      if (this.prevSurf > .4 && sf < .05) { this.ground = false; this.vy = .28 * speed + 4; this.y = gb + this.prevSurf; this.airT = 0; ev = { launch: true }; }
      else this.y = gr;
    } else {
      this.airT += dt; this.vy -= (this.vy > 0 ? 15 : 22) * dt; this.y += this.vy * dt + (gb - gOld);
      if (this.y <= gr && this.vy <= 0) { ev = { land: true, air: this.airT, impact: -this.vy }; this.ground = true; this.y = gr; this.squash = .3; }
    }
    this.prevSurf = sf; this.gy = gr; this.sync();
    this.squash *= Math.exp(-8 * dt); this.rig.scale.y = 1 - this.squash * .5;
    this.rig.rotation.z = -this.vx * .035; this.rig.rotation.y = -this.vx * .025; this.rig.rotation.x = this.ground ? 0 : THREE.MathUtils.clamp(-this.vy * .02, -.4, .4);
    this.pose(this.ground ? 0 : 1); return ev;
  }
  crash(speed) {
    this.crashed = true; this.cv = new THREE.Vector3(this.vx * .6, 9, -speed * .5); this.spin = new THREE.Vector3(Math.random() * 8 - 2, Math.random() * 6 - 3, Math.random() * 8 - 4);
    this.rig.remove(this.board); this.g.add(this.board); this.bv = new THREE.Vector3((Math.random() - .5) * 6, 6, -speed * .2); this.pose(1);
    this.bs = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
  }
  // returns true when body hits the snow hard (for particle burst)
  updateCrash(dt) {
    const c = this.cv; c.y -= 26 * dt; this.x += c.x * dt; this.y += c.y * dt; this.z += c.z * dt; let hit = false;
    const fl = groundH(this.x, this.z) + .3;
    if (this.y < fl) { this.y = fl; hit = c.y < -3; c.y = Math.abs(c.y) * .3; c.x *= .8; c.z *= .8; this.spin.multiplyScalar(.7); }
    c.z *= Math.exp(-.8 * dt); this.g.rotation.x += this.spin.x * dt; this.g.rotation.y += this.spin.y * dt; this.g.rotation.z += this.spin.z * dt;
    const b = this.board, v = this.bv; v.y -= 24 * dt; b.position.addScaledVector(v, dt); b.rotation.x += this.bs.x * dt; b.rotation.y += this.bs.y * dt;
    const bf = groundH(this.x + b.position.x, this.z + b.position.z) - this.y; if (b.position.y < bf) { b.position.y = bf; v.y *= -.3; v.x *= .8; v.z *= .8; }
    this.sync(); return hit;
  }
}
