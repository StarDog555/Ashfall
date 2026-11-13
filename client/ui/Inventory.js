import { LOOT, RARITY, WEAPONS, WEAPON_ORDER } from '/shared/constants.js';
import { esc } from './HUD.js';
const $ = id => document.getElementById(id);
const CELLS = 24;

/** Grid inventory: click = use/equip, right-click = discard, drag = rearrange. */
export class Inventory {
  constructor(net, onEquip) { this.net = net; this.onEquip = onEquip; this.slotOf = {}; this.self = null; this.cur = 'ar'; }
  get open() { return !$('inv').classList.contains('hidden'); }
  show(v) { $('inv').classList.toggle('hidden', !v); if (v) this.render(); }

  update(self, cur) { this.self = self; this.cur = cur; if (this.open) this.render(); }

  render() {
    const s = this.self; if (!s) return;
    const used = new Set(Object.values(this.slotOf));
    for (const uid of Object.keys(this.slotOf)) if (!s.items.find(i => i.uid == uid)) { used.delete(this.slotOf[uid]); delete this.slotOf[uid]; }
    for (const it of s.items) if (this.slotOf[it.uid] == null) { let i = 0; while (used.has(i)) i++; this.slotOf[it.uid] = i; used.add(i); }
    const grid = $('invgrid'); grid.innerHTML = '';
    for (let i = 0; i < CELLS; i++) {
      const cell = document.createElement('div'); cell.className = 'cell';
      cell.ondragover = e => { e.preventDefault(); cell.classList.add('over'); }; cell.ondragleave = () => cell.classList.remove('over');
      cell.ondrop = e => {
        e.preventDefault(); const uid = e.dataTransfer.getData('uid'); if (!uid) return;
        const other = Object.keys(this.slotOf).find(k => this.slotOf[k] === i); if (other) this.slotOf[other] = this.slotOf[uid];
        this.slotOf[uid] = i; this.render();
      };
      const it = s.items.find(x => this.slotOf[x.uid] === i);
      if (it) {
        const d = LOOT[it.type], el = document.createElement('div'); el.className = 'item'; el.style.setProperty('--rc', RARITY[d.rarity].color);
        el.innerHTML = `<b>${d.abbr}</b><small>${d.w} kg · $${d.value}</small>`; el.draggable = true;
        el.ondragstart = e => e.dataTransfer.setData('uid', it.uid);
        el.onmouseenter = () => this.inspect(it.type);
        el.onclick = () => { if (d.usable) this.net.use(it.uid); };
        el.oncontextmenu = e => { e.preventDefault(); this.net.drop(it.uid); };
        cell.appendChild(el);
      }
      grid.appendChild(cell);
    }
    const pct = Math.min(100, (s.wt / s.max) * 100);
    $('invweight').firstElementChild.style.width = pct + '%'; $('invweight').lastElementChild.textContent = `WEIGHT ${s.wt} / ${s.max} kg   ·   LOOT VALUE $${s.val || 0}`;
    $('invstash').textContent = `STASH $${s.stash}`;
    $('invweapons').innerHTML = WEAPON_ORDER.filter(id => s.wp[id]).map((id, n) => {
      const w = WEAPONS[id], ws = s.wp[id];
      return `<div class="wrow ${id === this.cur ? 'cur' : ''}" data-w="${id}"><span>${esc(w.name)}</span><span>${ws.mag} / ${ws.reserve}</span></div>`;
    }).join('');
    $('invweapons').querySelectorAll('.wrow').forEach(r => {
      r.onclick = () => this.onEquip(r.dataset.w);
      r.onmouseenter = () => { const w = WEAPONS[r.dataset.w]; $('invdesc').innerHTML = `<h4>${esc(w.name)}</h4>${w.cat}<br>Damage ${w.dmg}${w.pellets ? ' × ' + w.pellets : ''} · ${w.rpm} RPM<br>Mag ${w.mag} · Reload ${w.reload}s<br>Move speed ${Math.round(w.speed * 100)}%`; };
    });
  }

  inspect(type) {
    const d = LOOT[type], r = RARITY[d.rarity];
    $('invdesc').innerHTML = `<h4 style="color:${r.color}">${esc(d.name)}</h4>${r.name} · ${d.w} kg · $${d.value}<br>${esc(d.desc)}${d.usable ? '<br><em>Click to use</em>' : ''}<br><em>Right-click to discard</em>`;
  }
}
