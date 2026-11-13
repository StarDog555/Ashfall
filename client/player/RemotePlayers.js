import * as THREE from 'three';
import { OPERATORS, TEAM_COLORS } from '/shared/constants.js';

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d'); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#000a'; g.fillRect(0, 10, 256, 44);
  g.fillStyle = color; g.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  s.scale.set(1.5, 0.375, 1); s.position.y = 2.2; return s;
}

/** Renders other players from server snapshots (smoothly interpolated). */
export class RemotePlayers {
  constructor(scene) { this.scene = scene; this.map = new Map(); }

  build(p, teamMode) {
    const col = teamMode ? TEAM_COLORS[p.t] : OPERATORS[p.o].color;
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x25282a, roughness: 0.7 });
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; return b; };
    const legL = new THREE.Group(), legR = new THREE.Group();
    legL.position.set(-0.13, 0.85, 0); legR.position.set(0.13, 0.85, 0);
    legL.add(box(0.2, 0.85, 0.22, 0, -0.42, 0, dark)); legR.add(box(0.2, 0.85, 0.22, 0, -0.42, 0, dark));
    const torso = box(0.5, 0.62, 0.3, 0, 1.2, 0, mat);
    const head = new THREE.Group(); head.position.set(0, 1.55, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9a98a })); skull.castShadow = true; head.add(skull);
    const arms = new THREE.Group(); arms.position.set(0, 1.35, 0); arms.add(box(0.1, 0.1, 0.55, 0.25, 0, -0.25, mat), box(0.07, 0.09, 0.7, 0.1, -0.02, -0.5, dark));
    body.add(legL, legR, torso, head, arms);
    const tag = nameTag(p.n, teamMode ? TEAM_COLORS[p.t] : '#ffffff'); root.add(tag);
    root.visible = false; this.scene.add(root);
    return { root, body, legL, legR, head, arms, tag, t: new THREE.Vector3(p.x, p.y, p.z), yaw: p.yaw, pitch: 0, phase: 0, speed: 0, crouch: 0, first: true };
  }

  sync(list, selfId, teamMode) {
    const seen = new Set();
    for (const p of list) {
      if (p.id === selfId) continue;
      seen.add(p.id);
      let r = this.map.get(p.id);
      if (!r) { r = this.build(p, teamMode); this.map.set(p.id, r); }
      r.t.set(p.x, p.y, p.z); r.yaw = p.yaw; r.pitch = p.pitch; r.alive = !!p.al; r.crouchT = p.c; r.moving = !!p.mv;
      if (r.first) { r.root.position.copy(r.t); r.first = false; }
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { this.scene.remove(r.root); this.map.delete(id); }
  }

  position(id) { const r = this.map.get(id); return r ? r.root.position : null; }

  update(dt) {
    const k = 1 - Math.exp(-14 * dt);
    for (const r of this.map.values()) {
      r.root.visible = !!r.alive;
      if (!r.alive) continue;
      const before = r.root.position.clone(); r.root.position.lerp(r.t, k);
      const sp = before.distanceTo(r.root.position) / Math.max(dt, 1e-3);
      r.speed += (sp - r.speed) * Math.min(1, dt * 8);
      let dy = r.yaw - r.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.root.rotation.y += dy * k;
      r.phase += dt * Math.min(r.speed, 8) * 1.8;
      const swing = r.speed > 0.4 ? Math.sin(r.phase) * 0.7 : 0;
      r.legL.rotation.x = swing; r.legR.rotation.x = -swing;
      r.arms.rotation.x = r.pitch; r.head.rotation.x = r.pitch * 0.6;
      r.crouch += ((r.crouchT ? 1 : 0) - r.crouch) * k; r.body.scale.y = 1 - r.crouch * 0.3; r.tag.position.y = 2.2 - r.crouch * 0.5;
    }
  }
}
