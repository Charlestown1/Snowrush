// Tiny WebAudio synth: no audio files needed. Add music later via a new method.
export class Sound {
  constructor() { this.ctx = null; this.muted = localStorage.getItem('snowrush_mute') === '1'; }
  resume() {
    if (!this.ctx) { try {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : .5; this.master.connect(ctx.destination);
      const b = this.nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
      this.wf = ctx.createBiquadFilter(); this.wf.type = 'bandpass'; this.wg = ctx.createGain(); this.wg.gain.value = 0;
      s.connect(this.wf); this.wf.connect(this.wg); this.wg.connect(this.master); s.start();
    } catch (e) { this.ctx = null; } }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; localStorage.setItem('snowrush_mute', m ? '1' : '0'); if (this.master) this.master.gain.value = m ? 0 : .5; }
  wind(s, on) { if (!this.wg) return; this.wg.gain.value = on ? .04 + s * .004 : 0; this.wf.frequency.value = 300 + s * 14; }
  tone(f, d, type = 'sine', v = .2, f2) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d);
  }
  burst(d, v, fr) {
    if (!this.ctx || this.muted) return; const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.nb; f.type = 'lowpass'; f.frequency.value = fr; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + d);
  }
  pickup(n) { this.tone(660 + n * 60, .14, 'triangle', .2, 1300 + n * 80); }
  jump() { this.tone(300, .2, 'sine', .2, 650); this.burst(.15, .15, 2000); }
  land(h) { this.burst(.3, .15 + h * .4, 900); }
  crash() { this.burst(.9, .7, 700); this.tone(130, .5, 'sawtooth', .25, 40); }
  click() { this.tone(500, .06, 'square', .1); }
  boost() { this.tone(300, .5, 'sawtooth', .15, 900); }
}
