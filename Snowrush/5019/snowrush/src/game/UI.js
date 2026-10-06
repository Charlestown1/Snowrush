import { GAME_NAME, TAGLINE } from '../config.js';
const $ = id => document.getElementById(id);
// DOM overlay: menu, HUD, combo pop-ups, game-over panel.
export class UI {
  constructor(audio) {
    this.a = audio; this.sv = 0; this.c = {}; document.title = GAME_NAME + ' – ' + TAGLINE;
    $('logo').textContent = GAME_NAME; $('tag').textContent = TAGLINE;
    const m = $('mute'), sync = () => m.textContent = audio.muted ? '🔇' : '🔊'; sync();
    m.onclick = () => { audio.resume(); audio.setMuted(!audio.muted); sync(); audio.click(); };
  }
  hook(play, again) { $('playBtn').onclick = () => { this.a.resume(); this.a.click(); play(); }; $('againBtn').onclick = () => { this.a.click(); again(); }; }
  set(id, v) { if (this.c[id] !== v) { this.c[id] = v; $(id).textContent = v; } }
  setBest(b) { this.set('best', b); this.set('best1', b); }
  hud(s, d, sp, c, mult) {
    this.sv += (s - this.sv) * .25; if (Math.abs(s - this.sv) < 1) this.sv = s;
    this.set('score', Math.round(this.sv).toLocaleString()); this.set('dist', Math.round(d)); this.set('speed', Math.round(sp * 3.2) + ' km/h'); this.set('coins', c); this.set('mult', mult > 1 ? mult + 'x' : '');
  }
  pop(t, gold) { const e = document.createElement('div'); e.className = 'pop' + (gold ? ' g' : ''); e.textContent = t; $('pop').appendChild(e);
    e.onanimationend = () => e.remove(); while ($('pop').children.length > 3) $('pop').firstChild.remove(); }
  lines(v) { $('lines').style.opacity = v.toFixed(2); }
  fade() { const f = $('fade'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  showMenu() { $('menu').classList.remove('hide'); $('over').classList.add('hide'); $('hud').classList.add('hide'); }
  showHud() { $('menu').classList.add('hide'); $('over').classList.add('hide'); $('hud').classList.remove('hide'); this.sv = 0; }
  over(s, nb) {
    $('over').classList.remove('hide'); $('over').style.animation = 'none'; void $('over').offsetWidth; $('over').style.animation = '';
    this.set('oScore', Math.round(s.score).toLocaleString()); this.set('oDist', Math.round(s.dist) + ' m'); this.set('oCoins', s.coins);
    this.set('oCombo', s.combo + 'x'); this.set('oBest', Math.round(s.best).toLocaleString()); $('nb').classList.toggle('hide', !nb); this.lines(0);
  }
}
