import * as THREE from 'three';
import { BEST_KEY } from '../config.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { Input } from './Input.js';
import { Particles } from './Particles.js';
import { Sound } from './Audio.js';
import { UI } from './UI.js';

const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
const GOLD = [1, .85, .25], CYAN = [.3, .9, 1];

// Owns the loop, state machine (menu -> play -> crash -> over), scoring/combo and camera.
export class Game {
  constructor() {
    const cv = document.getElementById('c');
    this.r = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = mobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    const sky = 0xcfe2f3; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(sky); this.scene.fog = new THREE.Fog(sky, 50, 430);
    this.cam = new THREE.PerspectiveCamera(62, 1, .1, 700); this.cp = new THREE.Vector3(0, 6, 10);
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x8aa0bd, .95));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d6, 1.6); sun.castShadow = true;
    const ms = mobile ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms); sun.shadow.bias = -.0006;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 }); this.scene.add(sun, sun.target);
    this.world = new World(this.scene); this.p = new Player(this.scene); this.parts = new Particles(this.scene, mobile ? 500 : 900);
    this.inp = new Input(cv); this.audio = new Sound(); this.ui = new UI(this.audio);
    this.best = +localStorage.getItem(BEST_KEY) || 0; this.ui.setBest(this.best);
    this.ui.hook(() => this.start(), () => this.start());
    addEventListener('keydown', e => { if ((e.code === 'Enter' || e.code === 'Space') && (this.state === 'menu' || (this.state === 'over' && performance.now() - this.overAt > 500))) { this.audio.resume(); this.start(); } });
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.cb = {
      coin: o => { this.coins++; this.score += 50 * this.mult; this.addCombo(1); this.audio.pickup(Math.min(this.combo, 10)); this.parts.emit(o.x, o.y, o.z, 12, 4, 0, 3, 0, .6, GOLD); },
      near: () => { const v = 200 * this.mult; this.score += v; this.addCombo(2); this.ui.pop('NEAR MISS +' + v, true); this.audio.tone(900, .1, 'triangle', .12, 1500); },
      boost: () => { this.boost = 2.5; this.score += 150; this.ui.pop('BOOST! +150', true); this.audio.boost(); },
      crash: () => this.crash(),
    };
    this.clock = new THREE.Clock(); this.menuT = 0; this.shake = 0; this.ts = 1; this.speed = 20; this.state = 'menu'; this.resetRun(); this.resize();
    const frame = () => { requestAnimationFrame(frame); this.step(Math.min(this.clock.getDelta(), .05)); this.r.render(this.scene, this.cam); };
    frame();
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.baseFov = w / h < 1 ? 74 : 62; this.cam.updateProjectionMatrix(); }
  resetRun() { this.t = 0; this.score = 0; this.dist = 0; this.coins = 0; this.combo = 0; this.mult = 1; this.maxMult = 1; this.comboT = 0; this.boost = 0; this.speed = 20; this.ct = 0; }
  start() {
    this.resetRun(); this.world.reset(); this.p.reset(); this.inp.jumpQ = false; this.ts = 1; this.state = 'play'; this.ui.showHud(); this.ui.fade();
    this.cp.set(0, this.p.y + 4.6, 9.8);
  }
  addCombo(n) {
    this.combo += n; this.comboT = 3; const m = Math.min(8, 1 + Math.floor(this.combo / 3));
    if (m > this.mult) this.ui.pop(m + 'X COMBO'); this.mult = m; this.maxMult = Math.max(this.maxMult, m);
  }
  crash() {
    if (this.state !== 'play') return; const p = this.p; this.state = 'crash'; this.ct = 0; this.ts = .25; p.crash(this.speed);
    this.shake = 1.3; this.parts.emit(p.x, p.y + .5, p.z, 120, 9, 0, 5, 3, 1.2); this.audio.crash(); this.audio.wind(0, false);
  }
  over() {
    this.state = 'over'; this.ts = 1; this.overAt = performance.now(); const nb = this.score > this.best;
    if (nb) { this.best = this.score; try { localStorage.setItem(BEST_KEY, String(Math.round(this.best))); } catch (e) {} this.ui.setBest(Math.round(this.best)); }
    this.ui.over({ score: this.score, dist: this.dist, coins: this.coins, combo: this.maxMult, best: this.best }, nb);
  }
  landed(ev) {
    const p = this.p; this.audio.land(Math.min(1, ev.impact / 18)); this.shake = Math.min(.8, ev.impact / 20);
    this.parts.emit(p.x, p.y + .2, p.z, 20 + ev.impact * 2 | 0, 6, 0, 3, 2, .8);
    if (ev.air > .9) { const v = Math.round(500 * this.mult); this.score += v; this.addCombo(2); this.ui.pop('BIG AIR +' + v, true); }
    else if (ev.air > .35) { const v = 100 * this.mult; this.score += v; this.addCombo(1); this.ui.pop('AIR +' + v); }
  }
  step(raw) {
    const dt = raw * this.ts, p = this.p;
    if (this.state === 'play') this.play(dt);
    else if (this.state === 'crash') { this.ct += raw; if (p.updateCrash(dt)) this.parts.emit(p.x, p.y, p.z, 25, 6, 0, 3, 0, .8); if (this.ct > 1.6) this.over(); }
    else this.menuT += raw;
    this.parts.update(dt, p.x, p.y, p.z, this.speed); this.camera(raw);
    this.sun.position.set(p.x + 25, p.y + 45, p.z + 20); this.sun.target.position.set(p.x, p.y, p.z);
  }
  play(dt) {
    const p = this.p; this.t += dt;
    const target = 20 + 30 * (1 - Math.exp(-this.t / 70)) + (this.boost > 0 ? 14 : 0);
    this.speed += (target * (this.inp.brake ? .78 : 1) - this.speed) * Math.min(1, 3 * dt);
    if (this.inp.consumeJump() && p.jump()) { this.audio.jump(); this.parts.emit(p.x, p.y, p.z, 10, 4, 0, 2, 2, .5); }
    const ev = p.update(dt, this.inp, this.world, this.speed);
    if (ev && ev.land) this.landed(ev); if (ev && ev.launch) { this.audio.jump(); this.parts.emit(p.x, p.y, p.z, 20, 5, 0, 3, 3, .6); }
    this.world.update(dt, p, this.speed, this.t); this.world.check(p, this.cb);
    this.boost -= dt; this.comboT -= dt; if (this.comboT <= 0 && this.combo > 0) { this.combo = 0; this.mult = 1; }
    this.dist += this.speed * dt; this.score += this.speed * dt * .35 * this.mult;
    if (p.ground && this.state === 'play') { // snow spray: stronger when carving hard or boosting
      const sh = Math.abs(p.vx) / 16, b = this.boost > 0;
      this.parts.emit(p.x, p.y + .1, p.z + 1.1, Math.ceil(2 + sh * 4 + (b ? 4 : 0)), 1.5, -p.vx * .3, 1.2 + sh * 1.5, this.speed * .3, .6, b ? CYAN : [1, 1, 1]);
    }
    this.audio.wind(this.speed, true);
    this.ui.hud(this.score, this.dist, this.speed, this.coins, this.mult); this.ui.lines(Math.min(1, Math.max(0, (this.speed - 32) / 22)) * .8);
  }
  camera(raw) {
    const p = this.p, c = this.cam;
    if (this.state === 'menu') { const a = this.menuT * .35; c.position.set(p.x + Math.sin(a) * 6, p.y + 2.2, p.z + Math.cos(a) * 6.5); c.lookAt(p.x, p.y + 1, p.z); c.fov = 55; c.updateProjectionMatrix(); return; }
    const k = 1 - Math.exp(-7 * raw), air = Math.max(0, p.y - p.gy);
    this.cp.lerp(new THREE.Vector3(p.x * .8, p.y + 4.6 + air * .25, p.z + 9.8), k);
    this.shake *= Math.exp(-6 * raw); const s = this.shake * .35;
    c.position.set(this.cp.x + (Math.random() - .5) * s, this.cp.y + (Math.random() - .5) * s, this.cp.z);
    c.lookAt(p.x * .95, p.y + 1.3, p.z - 14); c.rotateZ(-p.vx * .0045);
    const tf = this.baseFov + (this.speed - 20) * .3 + (this.boost > 0 ? 7 : 0) + (p.ground ? 0 : 3);
    c.fov += (tf - c.fov) * k; c.updateProjectionMatrix();
  }
}
