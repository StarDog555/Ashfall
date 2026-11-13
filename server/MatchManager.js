import { PLAYER, WEAPONS, LOOT, MODES, EXTRACT } from '../shared/constants.js';
import { buildMap, rayBoxes, rayCylinder, MAP_HALF } from '../shared/map.js';
import { PlayerManager } from './PlayerManager.js';

const rnd = Math.random;
const finite = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LOOT_KEYS = Object.keys(LOOT);
const LOOT_TOTAL = LOOT_KEYS.reduce((s, k) => s + LOOT[k].weight, 0);
function pickType() {
  let r = rnd() * LOOT_TOTAL;
  for (const k of LOOT_KEYS) { r -= LOOT[k].weight; if (r <= 0) return k; }
  return 'medkit';
}

/** One match room per game mode. Owns all authoritative state. */
export class Room {
  constructor(io, mode) {
    this.io = io; this.mode = mode; this.cfg = MODES[mode];
    this.map = buildMap();
    this.pm = new PlayerManager();
    this.loot = new Map(); this.lootId = 1; this.pendingLoot = [];
    this.zones = this.map.zones.map(z => ({ ...z, progress: 0, occ: [], contested: false }));
    this.timeLeft = this.cfg.time;
    this.resetLoot();
  }

  emit(ev, data) { this.io.to(this.mode).emit(ev, data); }

  // ---------- Loot ----------
  resetLoot() {
    this.loot.clear(); this.pendingLoot = [];
    if (!this.cfg.loot) return;
    this.map.loot.forEach((p, i) => this.makeLoot(p.x, p.z, pickType(), false, i));
  }
  makeLoot(x, z, type, temp, spot) {
    const l = { id: this.lootId++, type, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, temp, spot };
    this.loot.set(l.id, l);
    return l;
  }
  lootList() { return [...this.loot.values()].map(l => ({ id: l.id, type: l.type, x: l.x, z: l.z })); }

  // ---------- Players ----------
  join(p) {
    p.socket.join(this.mode);
    if (this.cfg.teams) {
      const c = [0, 0]; this.pm.all().forEach(q => c[q.team]++);
      p.team = c[0] <= c[1] ? 0 : 1;
    }
    this.pm.add(p);
    this.spawn(p, true);
    p.socket.emit('joined', { id: p.id, mode: this.mode, modeName: this.cfg.name, timeLeft: Math.ceil(this.timeLeft),
      loot: this.lootList(), self: p.selfState(), spawn: { x: p.x, y: p.y, z: p.z, yaw: p.yaw } });
    this.emit('notice', `${p.name} joined the raid`);
  }

  leave(p) {
    this.pm.remove(p);
    this.emit('notice', `${p.name} disconnected`);
  }

  spawn(p, silent = false) {
    p.reset();
    const others = this.pm.all().filter(q => q !== p && q.alive);
    let best = this.map.spawns[0], bd = -1;
    for (const s of this.map.spawns) {
      const d = others.length ? Math.min(...others.map(q => Math.hypot(q.x - s.x, q.z - s.z))) : rnd();
      if (d > bd) { bd = d; best = s; }
    }
    p.budget = 2; p.x = best.x; p.y = 0; p.z = best.z; p.yaw = Math.atan2(best.x, best.z); p.pitch = 0;
    p.lastMove = Date.now();
    if (!silent) p.socket.emit('spawn', { x: p.x, y: p.y, z: p.z, yaw: p.yaw, self: p.selfState() });
  }

  sendSelf(p) { p.socket.emit('self', p.selfState()); }

  // ---------- Client input (validated) ----------
  onMove(p, d) {
    if (!p.alive || !d) return;
    const now = Date.now();
    const dt = clamp((now - p.lastMove) / 1000, 0.01, 0.5);
    p.lastMove = now;
    const x = finite(d.x, p.x), y = finite(d.y, p.y), z = finite(d.z, p.z);
    const horiz = Math.hypot(x - p.x, z - p.z);
    // Movement budget regenerates at ~1.25x sprint speed (cap 2 m) so bursts of packets can't speed-hack.
    p.budget = Math.min(2, (p.budget ?? 2) + PLAYER.sprint * 1.25 * dt);
    if (horiz > p.budget || y < -0.5 || y > 9 || Math.abs(y - p.y) > 16 * dt + 1.5 || Math.abs(x) > MAP_HALF || Math.abs(z) > MAP_HALF) {
      p.socket.emit('correct', { x: p.x, y: p.y, z: p.z });
      return;
    }
    p.budget -= horiz;
    p.x = x; p.y = Math.max(0, y); p.z = z;
    p.yaw = finite(d.yaw, p.yaw); p.pitch = clamp(finite(d.pitch, p.pitch), -1.55, 1.55);
    p.crouch = !!d.c; p.moving = !!d.m;
  }

  setWeapon(p, id) {
    if (!p.alive || !p.weapons[id] || id === p.cur) return;
    p.cur = id; p.reload = null;
    this.sendSelf(p);
  }

  startReload(p) {
    if (!p.alive || p.reload) return;
    const w = WEAPONS[p.cur], ws = p.weapons[p.cur];
    if (ws.mag >= w.mag || ws.reserve <= 0) return;
    p.reload = { wid: p.cur, until: Date.now() + w.reload * 1000 };
  }

  shoot(p, d) {
    if (!p.alive) return;
    const w = WEAPONS[p.cur], ws = p.weapons[p.cur], now = Date.now();
    if (p.reload || ws.mag <= 0 || now - p.lastShot < (60000 / w.rpm) * 0.85) return;
    p.lastShot = now; ws.mag--;
    const yaw = finite(d && d.yaw, p.yaw), pitch = clamp(finite(d && d.pitch, p.pitch), -1.55, 1.55);
    const o = { x: p.x, y: p.y + (p.crouch ? PLAYER.crouchEye : PLAYER.eye), z: p.z };
    const cp = Math.cos(pitch);
    const f = { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
    const rt = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
    const up = { x: rt.y * f.z - rt.z * f.y, y: rt.z * f.x - rt.x * f.z, z: rt.x * f.y - rt.y * f.x };
    const spread = (d && d.ads ? w.adsSpread : w.spread) * (p.moving ? 1.5 : 1);
    const victims = new Map(), ends = [];
    for (let i = 0; i < (w.pellets || 1); i++) {
      const r = spread * Math.sqrt(rnd()), a = rnd() * Math.PI * 2, sx = r * Math.cos(a), sy = r * Math.sin(a);
      let dx = f.x + rt.x * sx + up.x * sy, dy = f.y + rt.y * sx + up.y * sy, dz = f.z + rt.z * sx + up.z * sy;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const dir = { x: dx, y: dy, z: dz };
      let best = Math.min(rayBoxes(this.map.boxes, o, dir, w.range), w.range), kind = best < w.range ? 1 : 0, target = null, head = false;
      for (const q of this.pm.all()) {
        if (q === p || !q.alive) continue;
        if (this.cfg.teams && q.team === p.team) continue;
        const h = q.crouch ? PLAYER.crouchHeight : PLAYER.height;
        const hit = rayCylinder(o, dir, q.x, q.z, q.y, q.y + h, PLAYER.radius);
        if (hit && hit.t < best) { best = hit.t; target = q; head = hit.y > q.y + h - 0.32; kind = 2; }
      }
      ends.push([+(o.x + dx * best).toFixed(2), +(o.y + dy * best).toFixed(2), +(o.z + dz * best).toFixed(2), kind]);
      if (target) {
        const v = victims.get(target) || { dmg: 0, head: false };
        v.dmg += w.dmg * (head ? 2 : 1); v.head = v.head || head;
        victims.set(target, v);
      }
    }
    this.emit('shot', { id: p.id, w: p.cur, o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], e: ends });
    for (const [q, v] of victims) {
      const dead = q.takeDamage(v.dmg);
      p.socket.emit('hit', { dmg: Math.round(v.dmg), head: v.head, kill: dead });
      q.socket.emit('dmg', { x: p.x, z: p.z });
      this.sendSelf(q);
      if (dead) this.die(q, p, p.cur);
    }
    this.sendSelf(p);
  }

  die(victim, killer, wid) {
    victim.alive = false; victim.hp = 0; victim.deaths++;
    if (killer && killer !== victim) killer.kills++;
    victim.respawnAt = Date.now() + this.cfg.respawn * 1000;
    // Extraction modes: carried loot is dropped where the player fell.
    if (this.cfg.loot) {
      for (const it of victim.items) {
        const l = this.makeLoot(victim.x + (rnd() - 0.5) * 1.6, victim.z + (rnd() - 0.5) * 1.6, it.type, true, -1);
        this.emit('lootAdd', { id: l.id, type: l.type, x: l.x, z: l.z });
      }
      victim.items = [];
    }
    this.emit('kill', { k: killer ? killer.name : '?', v: victim.name, w: wid });
    victim.socket.emit('died', { by: killer ? killer.name : '?', respawn: this.cfg.respawn });
    this.sendSelf(victim); if (killer) this.sendSelf(killer);
  }

  pickup(p, id) {
    const l = this.loot.get(id);
    if (!p.alive || !l || Math.hypot(l.x - p.x, l.z - p.z) > 3.2 || Math.abs(p.y) > 6) return;
    const def = LOOT[l.type];
    if (def.kind === 'item') {
      if (p.weight + def.w > p.maxWeight) { p.socket.emit('notice', 'Too heavy — drop something first'); return; }
      p.items.push({ uid: p.uid++, type: l.type });
    } else if (def.kind === 'ammo') {
      for (const id2 of Object.keys(p.weapons)) p.weapons[id2].reserve += WEAPONS[id2].mag;
    } else if (def.kind === 'weapon') {
      p.giveWeapon(def.weapon);
    }
    this.loot.delete(id);
    this.emit('lootRemove', id);
    if (!l.temp) this.pendingLoot.push({ at: Date.now() + 120000, spot: l.spot });
    this.sendSelf(p);
  }

  useItem(p, uid) {
    const i = p.items.findIndex(it => it.uid === uid);
    if (!p.alive || i < 0) return;
    const type = p.items[i].type;
    if (type === 'medkit') { if (p.hp >= PLAYER.maxHp) return; p.hp = Math.min(PLAYER.maxHp, p.hp + 50); }
    else if (type === 'armor') { if (p.armor >= 50) return; p.armor = 50; }
    else if (type === 'backpack') { if (p.backpack) return; p.backpack = true; p.maxWeight += 10; }
    else return;
    p.items.splice(i, 1);
    this.sendSelf(p);
  }

  dropItem(p, uid) {
    const i = p.items.findIndex(it => it.uid === uid);
    if (!p.alive || i < 0) return;
    const [it] = p.items.splice(i, 1);
    const l = this.makeLoot(p.x - Math.sin(p.yaw) * 1.2, p.z - Math.cos(p.yaw) * 1.2, it.type, true, -1);
    this.emit('lootAdd', { id: l.id, type: l.type, x: l.x, z: l.z });
    this.sendSelf(p);
  }

  // ---------- Extraction ----------
  extract(p) {
    const value = p.value;
    p.stash += value; p.items = []; p.alive = false; p.extracted = true;
    p.respawnAt = Date.now() + 5000;
    p.socket.emit('extracted', { value, stash: p.stash, respawn: 5 });
    this.emit('notice', `${p.name} extracted${value ? ' with $' + value : ''}`);
    this.sendSelf(p);
  }

  updateZones(dt) {
    const R2 = EXTRACT.radius * EXTRACT.radius;
    for (const z of this.zones) {
      const occ = this.pm.all().filter(p => p.alive && (p.x - z.x) ** 2 + (p.z - z.z) ** 2 < R2);
      z.occ = occ.map(p => p.id);
      const groups = new Set(occ.map(p => (this.cfg.teams ? p.team : p.id)));
      z.contested = groups.size > 1;      // enemies inside at once pause & decay the countdown
      if (occ.length === 0 || z.contested) z.progress = Math.max(0, z.progress - dt * (z.contested ? 1 : 2));
      else {
        z.progress += dt;
        if (z.progress >= EXTRACT.time) { occ.forEach(p => this.extract(p)); z.progress = 0; }
      }
    }
  }

  // ---------- Round flow ----------
  endRound() {
    const rows = this.pm.all().map(p => ({ n: p.name, k: p.kills, d: p.deaths, s: p.stash, ex: p.extracted ? 1 : 0 }))
      .sort((a, b) => b.k - a.k);
    this.emit('roundEnd', { rows, mode: this.mode });
    this.resetLoot();
    for (const p of this.pm.all()) { p.kills = 0; p.deaths = 0; this.spawn(p); }
    this.emit('lootList', this.lootList());
    this.timeLeft = this.cfg.time;
  }

  tick(dt) {
    if (this.pm.size === 0) { this.timeLeft = this.cfg.time; return; }
    const now = Date.now();
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.endRound();
    for (const p of this.pm.all()) {
      if (p.reload && now >= p.reload.until) {
        const w = WEAPONS[p.reload.wid], ws = p.weapons[p.reload.wid];
        const take = Math.min(w.mag - ws.mag, ws.reserve);
        ws.mag += take; ws.reserve -= take; p.reload = null;
        this.sendSelf(p);
      }
      if (!p.alive && now >= p.respawnAt) this.spawn(p);
    }
    if (this.cfg.zones) this.updateZones(dt);
    this.pendingLoot = this.pendingLoot.filter(pl => {
      if (now < pl.at) return true;
      const s = this.map.loot[pl.spot];
      if (s) { const l = this.makeLoot(s.x, s.z, pickType(), false, pl.spot); this.emit('lootAdd', { id: l.id, type: l.type, x: l.x, z: l.z }); }
      return false;
    });
    this.emit('state', {
      tl: Math.ceil(this.timeLeft),
      p: this.pm.all().map(p => p.snapshot()),
      z: this.cfg.zones ? this.zones.map(z => ({ id: z.id, n: z.occ.length, p: +(z.progress / EXTRACT.time).toFixed(2), c: z.contested ? 1 : 0 })) : [],
    });
  }
}
