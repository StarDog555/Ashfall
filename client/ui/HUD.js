import { WEAPONS, WEAPON_ORDER, LOOT, TEAM_COLORS } from '/shared/constants.js';
const $ = id => document.getElementById(id);
const fmt = s => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export class HUD {
  constructor() {
    this.noticeT = 0; this.hitT = 0; this.dmgT = 0; this.timers = [];
  }
  show(v) { $('hud').classList.toggle('hidden', !v); }
  setMode(n) { $('mode').textContent = n.toUpperCase(); }
  setTime(s) { $('timer').textContent = fmt(s); }
  setPing(ms) { $('ping').textContent = ms + ' ms'; }
  conn(msg) { $('conn').classList.toggle('hidden', !msg); if (msg) $('conn').textContent = msg; }

  vitals(self) {
    $('hpfill').style.width = self.hp + '%'; $('hptext').textContent = '♥ ' + self.hp;
    $('arfill').style.width = Math.min(100, self.ar) + '%'; $('artext').textContent = '◆ ' + self.ar;
    $('carryval').textContent = '$' + (self.val || 0); $('carrywt').textContent = `${self.wt}/${self.max} kg`;
  }
  weapon(id, ws) {
    const w = WEAPONS[id]; $('wname').textContent = `${w.name} — ${w.cat}`.toUpperCase();
    $('mag').textContent = ws ? ws.mag : 0; $('res').textContent = ws ? ws.reserve : 0;
  }
  slots(self, cur) {
    $('wslots').innerHTML = WEAPON_ORDER.map((id, i) => self.wp[id] ? `<span class="${id === cur ? 'cur' : ''}">${i + 1} ${WEAPONS[id].name}</span>` : '').join('');
  }
  prompt(txt) { $('prompt').innerHTML = txt ? `<b>E</b>${txt}` : ''; }
  notice(t) { $('notice').textContent = t; clearTimeout(this._nt); this._nt = setTimeout(() => { $('notice').textContent = ''; }, 3500); }
  feed(k) {
    const d = document.createElement('div'); d.innerHTML = `<em>${esc(k.k)}</em> [${WEAPONS[k.w] ? WEAPONS[k.w].name : '?'}] ${esc(k.v)}`;
    $('killfeed').prepend(d); setTimeout(() => d.remove(), 6000);
    while ($('killfeed').children.length > 5) $('killfeed').lastChild.remove();
  }
  hitMarker(head, kill) { const h = $('hitmarker'); h.className = 'show' + (head || kill ? ' head' : ''); clearTimeout(this._ht); this._ht = setTimeout(() => { h.className = ''; }, 120); }
  damage(angle) {
    const f = $('dmgflash'), a = $('dmgarrow'); f.classList.add('on'); a.classList.add('on'); a.style.transform = `rotate(${angle}rad)`;
    clearTimeout(this._dt); this._dt = setTimeout(() => { f.classList.remove('on'); a.classList.remove('on'); }, 120);
  }
  scope(v) { $('scope').style.opacity = v; $('crosshair').style.opacity = v > 0.5 ? 0 : 1; }

  extraction(text, prog, cls) {
    const e = $('extract'); e.className = cls || ''; $('extext').textContent = text;
    $('exbar').style.display = prog > 0 ? 'block' : 'none'; $('exbar').firstElementChild.style.width = Math.round(prog * 100) + '%';
  }
  team(list, selfId, teamMode) {
    $('team').innerHTML = teamMode ? list.filter(p => p.id !== selfId && p.t === this.myTeam).map(p => `<div style="color:${TEAM_COLORS[p.t]}">${esc(p.n)} — ${p.al ? p.hp + ' HP' : 'DOWN'}</div>`).join('') : '';
  }
  scoreboard(show, list, selfId) {
    $('scoreboard').classList.toggle('hidden', !show); if (!show) return;
    $('sbtable').innerHTML = '<tr><th>OPERATOR</th><th>KILLS</th><th>DEATHS</th><th>STATUS</th></tr>' +
      [...list].sort((a, b) => b.k - a.k).map(p => `<tr class="${p.id === selfId ? 'me' : ''}"><td>${esc(p.n)}</td><td>${p.k}</td><td>${p.d}</td><td>${p.al ? 'ALIVE' : 'DOWN'}</td></tr>`).join('');
  }
  overlay(id, v) { $(id).classList.toggle('hidden', !v); }
  countdown(elId, sec, prefix) {
    clearInterval(this.cd); let s = Math.ceil(sec); const el = $(elId);
    const tick = () => { el.textContent = `${prefix} ${s}s`; if (s-- <= 0) clearInterval(this.cd); }; tick(); this.cd = setInterval(tick, 1000);
  }
  death(d) { $('deathtext').textContent = `Eliminated by ${d.by}. Carried loot was lost.`; this.countdown('deathtimer', d.respawn, 'Redeploying in'); this.overlay('death', true); }
  exfil(d) { $('exfiltext').textContent = d.value ? `Loot secured: $${d.value} — Stash: $${d.stash}` : 'You got out alive.'; this.countdown('exfiltimer', d.respawn, 'Next raid in'); this.overlay('exfil', true); }
  roundEnd(d, selfName) {
    $('retable').innerHTML = '<tr><th>OPERATOR</th><th>KILLS</th><th>DEATHS</th><th>STASH</th></tr>' +
      d.rows.map(r => `<tr class="${r.n === selfName ? 'me' : ''}"><td>${esc(r.n)}</td><td>${r.k}</td><td>${r.d}</td><td>$${r.s}</td></tr>`).join('');
    this.overlay('roundend', true);
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export { esc };
