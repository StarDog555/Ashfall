import { PLAYER, WEAPONS, LOOT } from '../shared/constants.js';

const r2 = v => Math.round(v * 100) / 100;
const cleanName = n => (String(n || '').replace(/[^\w \-.]/g, '').trim().slice(0, 14)) || ('Operator' + Math.floor(Math.random() * 900 + 100));

export class Player {
  constructor(socket, d) {
    this.socket = socket;
    this.id = socket.id;
    this.name = cleanName(d.name);
    this.operator = Math.max(0, Math.min(3, d.operator | 0));
    this.primary = d.primary === 'smg' ? 'smg' : 'ar';
    this.team = 0;
    this.stash = 0; this.kills = 0; this.deaths = 0;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.lastMove = Date.now();
    this.uid = 1;
    this.reset();
  }

  /** Fresh raid state (stash / score survive). */
  reset() {
    this.hp = PLAYER.maxHp; this.armor = 0; this.maxWeight = PLAYER.maxWeight; this.backpack = false;
    this.weapons = {};
    this.giveWeapon(this.primary); this.giveWeapon('pistol');
    this.cur = this.primary;
    this.items = []; this.reload = null; this.lastShot = 0;
    this.alive = true; this.extracted = false; this.respawnAt = 0;
    this.crouch = false; this.moving = false;
  }

  giveWeapon(id) {
    const w = WEAPONS[id];
    if (this.weapons[id]) this.weapons[id].reserve += w.mag * 2;
    else this.weapons[id] = { mag: w.mag, reserve: w.mag * 3 };
  }

  get weight() { return this.items.reduce((s, i) => s + LOOT[i.type].w, 0); }
  get value() { return this.items.reduce((s, i) => s + LOOT[i.type].value, 0); }

  /** Armor absorbs 60% of damage until depleted. Returns true if the player died. */
  takeDamage(d) {
    const absorbed = Math.min(this.armor, d * 0.6);
    this.armor -= absorbed;
    this.hp -= d - absorbed;
    return this.hp <= 0;
  }

  snapshot() {
    return { id: this.id, n: this.name, o: this.operator, t: this.team, x: r2(this.x), y: r2(this.y), z: r2(this.z),
      yaw: r2(this.yaw), pitch: r2(this.pitch), hp: Math.max(0, Math.round(this.hp)), al: this.alive ? 1 : 0,
      w: this.cur, c: this.crouch ? 1 : 0, mv: this.moving ? 1 : 0, k: this.kills, d: this.deaths };
  }

  selfState() {
    return { hp: Math.max(0, Math.round(this.hp)), ar: Math.round(this.armor), cur: this.cur, wp: this.weapons,
      items: this.items, wt: this.weight, max: this.maxWeight, stash: this.stash, k: this.kills, d: this.deaths,
      al: this.alive ? 1 : 0, tm: this.team, val: this.value };
  }
}

export class PlayerManager {
  constructor() { this.players = new Map(); }
  add(p) { this.players.set(p.id, p); }
  remove(p) { this.players.delete(p.id); }
  all() { return [...this.players.values()]; }
  get size() { return this.players.size; }
}
