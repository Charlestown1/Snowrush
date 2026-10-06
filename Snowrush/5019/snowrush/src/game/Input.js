// Keyboard + touch input. Touch: hold left/right half to steer, swipe up to jump.
export class Input {
  constructor(el) {
    this.keys = {}; this.jumpQ = false; this.touches = new Map();
    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code) && !e.repeat) this.jumpQ = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.touches.clear(); });
    const opt = { passive: false };
    el.addEventListener('touchstart', e => { e.preventDefault();
      for (const t of e.changedTouches) this.touches.set(t.identifier, { y0: t.clientY, x: t.clientX, j: false }); }, opt);
    el.addEventListener('touchmove', e => { e.preventDefault();
      for (const t of e.changedTouches) { const o = this.touches.get(t.identifier); if (!o) continue;
        o.x = t.clientX; if (!o.j && o.y0 - t.clientY > 45) { o.j = true; this.jumpQ = true; } } }, opt);
    const end = e => { for (const t of e.changedTouches) this.touches.delete(t.identifier); };
    el.addEventListener('touchend', end, opt); el.addEventListener('touchcancel', end, opt);
  }
  get steer() {
    const k = this.keys; let s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    for (const o of this.touches.values()) s += o.x < innerWidth / 2 ? -1 : 1;
    return Math.max(-1, Math.min(1, s));
  }
  get brake() { return !!(this.keys.KeyS || this.keys.ArrowDown); }
  consumeJump() { const j = this.jumpQ; this.jumpQ = false; return j; }
}
