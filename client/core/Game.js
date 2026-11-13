import * as THREE from 'three';
import { PLAYER, WEAPONS, WEAPON_ORDER, LOOT, MODES, EXTRACT } from '/shared/constants.js';
import { buildMap } from '/shared/map.js';
import { Input } from './Input.js';
import { GameAudio } from './Audio.js';
import { World } from '../world/World.js';
import { Effects } from '../world/Effects.js';
import { Controller } from '../player/Controller.js';
import { RemotePlayers } from '../player/RemotePlayers.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { HUD } from '../ui/HUD.js';
import { Inventory } from '../ui/Inventory.js';
const $ = id => document.getElementById(id);

export class Game {
  constructor(settings, net) {
    this.s = settings; this.net = net;
    this.canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 400); this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.map = buildMap();
    this.world = new World(this.scene, this.map, settings);
    this.effects = new Effects(this.scene);
    this.input = new Input(this.canvas);
    this.audio = new GameAudio(); this.audio.volume = settings.vol / 100;
    this.ctrl = new Controller(this.map.boxes, this.map.half);
    this.wm = new WeaponManager(this.camera); this.wm.root.visible = false;
    this.remotes = new RemotePlayers(this.scene);
    this.hud = new HUD(); this.inv = new Inventory(net, id => this.selectWeapon(id));

    Object.assign(this, { inGame: false, alive: false, id: null, mode: 'extraction', teamMode: false, self: null, cur: 'ar', reloading: false, reloadEnd: 0, reloadFrom: 0,
      nextShot: 0, lastFire: 0, recoilIdx: 0, wasFiring: false, lastSend: 0, timeLeft: 0, players: [], zoneState: {}, zoom: 1, last: performance.now(), t: 0, sbT: 0, pickT: 0, lastExBeep: -1, _v: new THREE.Vector3() });
    this.applySettings();
    addEventListener('resize', () => this.resize());
    this.bindNet(); this.bindUI();
    requestAnimationFrame(t => this.frame(t));
  }

  // ---------- settings / lifecycle ----------
  applySettings() {
    const s = this.s; this.world.setQuality(s.quality); this.world.setTimeOfDay(s.tod);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.world.pixelRatio)); this.renderer.shadowMap.enabled = this.world.quality.shadow > 0;
    this.renderer.toneMappingExposure = this.world.tod.exp; this.audio.setVolume(s.vol / 100); this.resize();
    if (this._q !== s.quality) { this._q = s.quality; this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  }
  resize() { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }

  deploy(info) {
    this.audio.init(); this.input.lock();
    this.net.join(info);
    clearTimeout(this._jt); this._jt = setTimeout(() => { if (!this.inGame) { document.exitPointerLock(); $('menumsg').classList.remove('hidden'); $('menumsg').textContent = 'Could not join the raid — try again.'; } }, 5000);
  }
  fatal(msg) {
    this.inGame = false; sessionStorage.setItem('ashfall-msg', msg); document.exitPointerLock();
    this.hud.conn(msg + ' Returning to menu…'); setTimeout(() => location.reload(), 1800);
  }

  bindUI() {
    $('resume').onclick = () => { this.input.lock(); };
    $('leave').onclick = () => { this.net.socket.disconnect(); location.reload(); };
    $('reclose').onclick = () => { this.hud.overlay('roundend', false); if (this.inGame) this.input.lock(); };
    this.canvas.addEventListener('click', () => { if (this.inGame && !this.input.locked && !this.inv.open) this.input.lock(); });
    this.input.onLockChange = locked => {
      if (!this.inGame) return;
      if (locked) { this.hud.overlay('pause', false); this.hud.overlay('roundend', false); }
      else if (!this.inv.open && $('roundend').classList.contains('hidden')) this.hud.overlay('pause', true);
    };
  }

  bindNet() {
    const n = this.net, h = this.hud;
    n.on('joined', d => {
      clearTimeout(this._jt); this.id = d.id; this.mode = d.mode; this.teamMode = !!MODES[d.mode].teams; this.inGame = true; this.alive = true;
      $('menu').classList.add('hidden'); h.show(true); h.setMode(d.modeName); this.timeLeft = d.timeLeft;
      this.world.setLoot(d.loot); this.spawnLocal(d.spawn, d.self); this.wm.root.visible = true; h.notice('DEPLOYED — ' + d.modeName.toUpperCase());
    });
    n.on('spawn', d => { this.spawnLocal(d, d.self); ['death', 'exfil'].forEach(o => h.overlay(o, false)); this.alive = true; });
    n.on('self', d => this.applySelf(d));
    n.on('state', d => { this.timeLeft = d.tl; this.players = d.p; this.remotes.sync(d.p, this.id, this.teamMode); this.zoneState = Object.fromEntries(d.z.map(z => [z.id, z])); h.team(d.p, this.id, this.teamMode); });
    n.on('shot', d => this.onShot(d));
    n.on('hit', d => { h.hitMarker(d.head, d.kill); this.audio.hit(d.head); });
    n.on('dmg', d => {
      const c = this.ctrl, dx = d.x - c.pos.x, dz = d.z - c.pos.z;
      h.damage(Math.atan2(dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw), dx * -Math.sin(c.yaw) + dz * -Math.cos(c.yaw))); this.audio.hurt();
    });
    n.on('kill', d => h.feed(d));
    n.on('died', d => { this.alive = false; this.reloading = false; h.death(d); this.audio.beep('warn'); });
    n.on('extracted', d => { this.alive = false; this.s.stash = d.stash; this.s.save(); h.exfil(d); this.audio.beep('ok'); });
    n.on('lootAdd', l => this.world.addLoot(l));
    n.on('lootRemove', id => this.world.removeLoot(id));
    n.on('lootList', l => this.world.setLoot(l));
    n.on('notice', t => h.notice(t));
    n.on('roundEnd', d => { h.roundEnd(d, this.s.name); document.exitPointerLock(); });
    n.on('correct', d => { this.ctrl.pos.set(d.x, d.y, d.z); this.ctrl.vel.set(0, 0, 0); });
    n.on('disconnect', () => { if (this.inGame) this.fatal('Connection to the server was lost.'); });
  }

  spawnLocal(sp, self) {
    this.ctrl.teleport(sp.x, sp.y, sp.z, sp.yaw); this.cur = self.cur; this.wm.select(this.cur, true);
    this.reloading = false; this.wm.endReload(); this.applySelf(self);
  }
  applySelf(d) {
    this.self = d; if (!d.wp[this.cur]) this.cur = d.cur;
    this.hud.vitals(d); this.hud.weapon(this.cur, d.wp[this.cur]); this.hud.slots(d, this.cur); this.inv.update(d, this.cur); this.hud.myTeam = d.tm;
  }

  // ---------- weapons ----------
  ownedOrder() { return WEAPON_ORDER.filter(id => this.self && this.self.wp[id]); }
  selectWeapon(id) {
    if (!this.self || !this.self.wp[id] || id === this.cur) return;
    this.cur = id; this.reloading = false; this.wm.select(id); this.net.weapon(id); this.nextShot = performance.now() + 250; this.audio.click();
    this.hud.weapon(id, this.self.wp[id]); this.hud.slots(this.self, id); this.inv.update(this.self, id);
  }
  startReload(now) {
    const w = WEAPONS[this.cur], ws = this.self.wp[this.cur];
    if (this.reloading || ws.mag >= w.mag || ws.reserve <= 0) return;
    this.reloading = true; this.reloadEnd = now + w.reload * 1000 + 80; this.reloadFrom = ws.mag;
    this.wm.startReload(w.reload); this.audio.reload(); this.net.reload();
  }
  tryFire(now, ads) {
    const w = WEAPONS[this.cur], ws = this.self.wp[this.cur];
    if (this.reloading || now < this.nextShot) return;
    if (ws.mag <= 0) { this.audio.click(); this.nextShot = now + 300; this.startReload(now); return; }
    this.nextShot = now + 60000 / w.rpm; ws.mag--;
    this.net.shoot({ yaw: this.ctrl.yaw, pitch: this.ctrl.pitch, ads });
    this.recoilIdx = now - this.lastFire < 400 ? this.recoilIdx + 1 : 0; this.lastFire = now;
    const rc = w.recoil * (ads ? 0.6 : 1);
    this.ctrl.pitch = Math.min(1.5, this.ctrl.pitch + rc * (0.7 + Math.min(this.recoilIdx, 10) * 0.04));
    this.ctrl.yaw += Math.sin(this.recoilIdx * 1.3) * rc * 0.35;
    this.wm.fire(); this.audio.shot(this.cur); this.hud.weapon(this.cur, ws);
  }

  onShot(d) {
    const mine = d.id === this.id; let from = d.o;
    if (mine) { const v = this.wm.muzzleWorld(this._v); from = [v.x, v.y, v.z]; }
    else this.audio.shot(d.w, { x: d.o[0], y: d.o[1], z: d.o[2] });
    for (const e of d.e) {
      this.effects.tracer(from, e);
      if (e[3] >= 1) { this.effects.impact(e, e[3]); if (!mine && Math.hypot(e[0] - this.ctrl.pos.x, e[2] - this.ctrl.pos.z) < 35) this.audio.impact({ x: e[0], y: e[1], z: e[2] }); }
    }
  }

  // ---------- frame ----------
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    try { if (this.inGame) this.updateGame(dt, now); else this.updateMenu(dt); } catch (e) { console.error(e); }
    this.renderer.render(this.scene, this.camera); this.input.endFrame();
  }

  updateMenu(dt) {
    const a = this.t * 0.06;
    this.camera.position.set(Math.cos(a) * 46, 14 + Math.sin(a * 2) * 3, Math.sin(a) * 46); this.camera.lookAt(0, 3, 0);
    this.world.update(dt, this.camera.position, {});
    if (this.camera.fov !== 60) { this.camera.fov = 60; this.camera.updateProjectionMatrix(); }
  }

  updateGame(dt, now) {
    const inp = this.input, c = this.ctrl, hud = this.hud, self = this.self;
    const can = this.alive && inp.locked && !this.inv.open;
    if (inp.pressed('KeyI') && this.alive) this.toggleInventory();
    if (inp.pressed('Escape') && this.inv.open) { this.inv.show(false); hud.overlay('pause', true); }
    if (this.reloading && now >= this.reloadEnd) {
      this.reloading = false; this.wm.endReload(); const ws = self.wp[this.cur], w = WEAPONS[this.cur];
      if (ws.mag === this.reloadFrom) { const take = Math.min(w.mag - ws.mag, ws.reserve); ws.mag += take; ws.reserve -= take; }
      hud.weapon(this.cur, ws);
    }
    const aim = can && inp.mouse.r && !this.reloading;
    if (can) {
      c.look(inp.mouse.dx, inp.mouse.dy, 0.0022 * this.s.sens / this.zoom);
      for (let i = 0; i < 5; i++) if (inp.pressed('Digit' + (i + 1))) this.selectWeapon(WEAPON_ORDER[i]);
      if (inp.wheel) { const o = this.ownedOrder(), i = o.indexOf(this.cur); this.selectWeapon(o[(i + (inp.wheel > 0 ? 1 : -1) + o.length) % o.length]); }
      if (inp.pressed('KeyR')) this.startReload(now);
      if (inp.pressed('KeyH')) { const m = self.items.find(i => i.type === 'medkit'); if (m) this.net.use(m.uid); }
      const w = WEAPONS[this.cur];
      if (inp.mouse.l && (w.auto || !this.wasFiring) && !(c.sprinting && !aim && false)) this.tryFire(now, this.wm.ads > 0.5);
      this.wasFiring = inp.mouse.l;
    } else this.wasFiring = false;

    c.update(dt, can ? inp.keys : {}, WEAPONS[this.cur].speed * (aim ? 0.7 : 1), !aim);
    if (c.events.step) this.audio.step(c.sprinting); if (c.events.land) this.audio.land(); if (c.events.jump) this.audio.jump();

    const cam = this.camera;
    cam.position.set(c.pos.x, c.pos.y + c.eye + c.bobY, c.pos.z); cam.rotation.set(c.pitch, c.yaw, -c.strafe * 0.012);
    this.zoom = this.wm.update(dt, { moving: c.moving && c.onGround, sprinting: c.sprinting && can, dx: inp.mouse.dx, dy: inp.mouse.dy, aim });
    const fov = this.s.fov / this.zoom; if (Math.abs(fov - cam.fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    hud.scope(this.cur === 'sniper' ? THREE.MathUtils.clamp((this.wm.ads - 0.8) * 5, 0, 1) : 0);

    if (this.alive && now - this.lastSend > 33) {
      this.lastSend = now; const r = v => Math.round(v * 1000) / 1000;
      this.net.move({ x: r(c.pos.x), y: r(c.pos.y), z: r(c.pos.z), yaw: r(c.yaw), pitch: r(c.pitch), c: c.crouch ? 1 : 0, m: c.moving ? 1 : 0 });
    }

    // loot interaction
    const l = this.alive && this.mode !== 'deathmatch' ? this.world.nearestLoot(c.pos, 2.6) : null;
    hud.prompt(l ? `PICK UP ${LOOT[l.type].name.toUpperCase()}` : '');
    if (l && can && inp.pressed('KeyE') && now - this.pickT > 150) { this.pickT = now; this.net.pickup(l.id); this.audio.pickup(); }

    this.updateZoneHud(c.pos);
    hud.setTime(this.timeLeft); hud.setPing(this.net.ping);
    if (inp.keys.Tab) { if (now - this.sbT > 250) { this.sbT = now; hud.scoreboard(true, this.players, this.id); } } else if (this.sbT !== -1) { hud.scoreboard(false); this.sbT = 0; }

    this.remotes.update(dt); this.effects.update(dt);
    this.world.update(dt, cam.position, this.zoneState);
    this.audio.setListener(cam.position, c.yaw); this.audio.update(dt, c.pos);
  }

  toggleInventory() {
    if (this.inv.open) { this.inv.show(false); this.input.lock(); }
    else { this.inv.show(true); document.exitPointerLock(); }
  }

  updateZoneHud(pos) {
    if (!MODES[this.mode].zones) { this.hud.extraction('', 0); return; }
    let inside = null, near = null, nd = 1e9;
    for (const z of this.map.zones) { const d = Math.hypot(z.x - pos.x, z.z - pos.z); if (d < EXTRACT.radius) inside = z; if (d < nd) { nd = d; near = z; } }
    if (inside && this.alive) {
      const st = this.zoneState[inside.id] || { p: 0, c: 0 };
      if (st.c) this.hud.extraction('EXTRACTION CONTESTED', st.p, 'contested');
      else {
        const left = Math.ceil(EXTRACT.time * (1 - st.p)); this.hud.extraction(`EXTRACTING — ${left}s — HOLD POSITION`, st.p, 'active');
        if (left !== this.lastExBeep) { this.lastExBeep = left; this.audio.beep(); }
      }
    } else { this.lastExBeep = -1; const st = near && this.zoneState[near.id]; this.hud.extraction(near ? `EXTRACT ${near.id} — ${Math.round(nd)} m${st && st.n ? ' — OCCUPIED' : ''}` : '', 0, ''); }
  }
}
