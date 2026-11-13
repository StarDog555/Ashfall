import { OPERATORS, WEAPONS, MODES } from '/shared/constants.js';
import { esc } from './HUD.js';
const $ = id => document.getElementById(id);

export class Settings {
  constructor() {
    Object.assign(this, { sens: 1, fov: 85, vol: 60, quality: 'high', tod: 'dusk', name: '', operator: 0, primary: 'ar', mode: 'extraction', stash: 0 });
    try { Object.assign(this, JSON.parse(localStorage.getItem('ashfall') || '{}')); } catch { /* ignore corrupt storage */ }
  }
  save() { try { localStorage.setItem('ashfall', JSON.stringify(this)); } catch { /* ignore */ } }
}

export class Menu {
  constructor(settings, net, game) {
    this.s = settings; this.net = net; this.game = game; this.lobby = [];
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { game.audio.init(); game.audio.ui(); this.go(b.dataset.go); }));
    $('exit').onclick = () => {
      window.close();
      $('menubox').innerHTML = '<div id="logo">ASH<span>FALL</span></div><p class="hint">SESSION ENDED<br>You can close this tab.</p>';
    };
    $('name').value = settings.name;
    $('deploy').onclick = () => this.deploy();
    this.bindSettings(); this.renderOperators(); this.renderLoadout(); this.renderStash();

    net.on('lobby', l => { this.lobby = l; this.renderModes(); });
    net.on('connect', () => { this.message(null); $('deploy').disabled = false; });
    net.on('connect_error', () => { this.message('Server unreachable — is it running?'); $('deploy').disabled = true; });
    this.renderModes();
    setInterval(() => { if (this.game.inGame || !net.connected) return; net.lobby(); }, 4000);
    const m = sessionStorage.getItem('ashfall-msg'); if (m) { sessionStorage.removeItem('ashfall-msg'); this.message(m); }
  }

  message(t) { const el = $('menumsg'); el.classList.toggle('hidden', !t); if (t) el.textContent = t; }
  go(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); $('p-' + name).classList.remove('hidden');
    if (name === 'inventory') this.renderStash(); if (name === 'play') this.net.lobby();
  }

  renderModes() {
    const info = Object.fromEntries(this.lobby.map(l => [l.mode, l]));
    $('modes').innerHTML = Object.entries(MODES).map(([k, m]) => {
      const desc = { extraction: 'Loot, fight, extract. Die and lose it all.', team: 'Two teams. Extract together, contest enemy zones.', deathmatch: 'Fast respawns. Most kills when the clock ends.' }[k];
      return `<div class="card ${this.s.mode === k ? 'sel' : ''}" data-m="${k}"><div>${m.name.toUpperCase()}<small>${desc}</small></div><span class="pill">${info[k] ? info[k].players : 0} ONLINE</span></div>`;
    }).join('');
    $('modes').querySelectorAll('.card').forEach(c => c.onclick = () => { this.s.mode = c.dataset.m; this.s.save(); this.renderModes(); });
  }
  renderOperators() {
    $('oplist').innerHTML = OPERATORS.map(o => `<div class="card ${this.s.operator === o.id ? 'sel' : ''}" data-o="${o.id}"><div style="display:flex;align-items:center"><span class="swatch" style="background:${o.color}"></span>${o.name}</div><span class="pill">${this.s.operator === o.id ? 'SELECTED' : ''}</span></div>`).join('') +
      '<p class="hint">Operator colour is shown to other players. In Team Extraction your team colour is used instead.</p>';
    $('oplist').querySelectorAll('.card').forEach(c => c.onclick = () => { this.s.operator = +c.dataset.o; this.s.save(); this.renderOperators(); });
  }
  renderLoadout() {
    $('loadlist').innerHTML = ['ar', 'smg'].map(id => { const w = WEAPONS[id];
      return `<div class="card ${this.s.primary === id ? 'sel' : ''}" data-w="${id}"><div>${esc(w.name)}<small>${w.cat} · ${w.dmg} dmg · ${w.rpm} RPM · ${w.mag} rounds</small></div><span class="pill">${this.s.primary === id ? 'EQUIPPED' : ''}</span></div>`; }).join('');
    $('loadlist').querySelectorAll('.card').forEach(c => c.onclick = () => { this.s.primary = c.dataset.w; this.s.save(); this.renderLoadout(); });
  }
  renderStash() { $('stashval').textContent = '$' + (this.s.stash || 0); }

  bindSettings() {
    const bind = (id, key, num) => {
      const el = $(id), out = el.parentElement.querySelector('output');
      el.value = this.s[key]; if (out) out.textContent = el.value;
      el.addEventListener('input', () => { this.s[key] = num ? +el.value : el.value; if (out) out.textContent = el.value; this.s.save(); this.game.applySettings(); });
    };
    bind('s-sens', 'sens', true); bind('s-fov', 'fov', true); bind('s-vol', 'vol', true); bind('s-q', 'quality'); bind('s-tod', 'tod');
  }

  deploy() {
    this.s.name = $('name').value.trim() || 'Operator'; this.s.save();
    if (!this.net.connected) { this.message('Not connected to the server.'); return; }
    this.game.deploy({ name: this.s.name, mode: this.s.mode, operator: this.s.operator, primary: this.s.primary });
  }
}
