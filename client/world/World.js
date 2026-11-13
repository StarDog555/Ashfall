import * as THREE from 'three';
import { LOOT, RARITY, EXTRACT } from '/shared/constants.js';

const TOD = {
  day:   { sky: 0xa59a8c, fog: 0.010, sun: 0xffe2b0, sunI: 2.4, hemi: 0xc9bba8, hemiG: 0x3a342c, hemiI: 0.9, exp: 1.0, pos: [40, 60, 25] },
  dusk:  { sky: 0x6b4a3d, fog: 0.014, sun: 0xff8c4a, sunI: 1.6, hemi: 0x9a6a58, hemiG: 0x2a2220, hemiI: 0.55, exp: 0.95, pos: [70, 22, 30] },
  night: { sky: 0x080b12, fog: 0.022, sun: 0x7f95c8, sunI: 0.55, hemi: 0x2a3550, hemiG: 0x0c0e12, hemiI: 0.3, exp: 0.9, pos: [-30, 55, -20] },
};
const QUALITY = {
  low:    { shadow: 0,    ash: 400,  pr: 1,   lights: false },
  medium: { shadow: 1024, ash: 1200, pr: 1,   lights: false },
  high:   { shadow: 2048, ash: 2500, pr: 1.5, lights: true },
  ultra:  { shadow: 4096, ash: 4500, pr: 2,   lights: true },
};

function noiseTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#4a463f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = 50 + Math.random() * 50; g.fillStyle = `rgba(${v},${v - 4},${v - 10},${Math.random() * 0.5})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(scene, map, settings) {
    this.scene = scene; this.map = map; this.loot = new Map(); this.zoneMeshes = {}; this.lootData = new Map();
    this.ashN = 0; this.quality = QUALITY.high; this.time = 0;
    this.build();
    this.setQuality(settings.quality); this.setTimeOfDay(settings.tod);
  }

  build() {
    const { scene, map } = this;
    scene.fog = new THREE.FogExp2(0x9a8f80, 0.012);
    // Ground + roads
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: noiseTexture(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1f, roughness: 0.95 });
    for (const r of map.roads) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), roadMat); m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.02, r.z); m.receiveShadow = true; scene.add(m); }

    // Static boxes batched into one InstancedMesh per colour
    const groups = new Map(), trees = [];
    for (const b of map.boxes) {
      if (b.kind === 'tree') { trees.push(b); continue; }
      if (!groups.has(b.c)) groups.set(b.c, []);
      groups.get(b.c).push(b);
    }
    const geo = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const [c, list] of groups) {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.15 }), list.length);
      list.forEach((b, i) => { m4.compose(p.set(b.x, (b.y0 + b.y1) / 2, b.z), q, s.set(b.w, b.y1 - b.y0, b.d)); im.setMatrixAt(i, m4); });
      im.castShadow = im.receiveShadow = true; scene.add(im);
    }
    // Forest: instanced trunks and burnt canopies
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.4, 6, 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 1 }), trees.length);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.3, 5.5, 7), new THREE.MeshStandardMaterial({ color: 0x2c3328, roughness: 1 }), trees.length);
    trees.forEach((t, i) => {
      const k = 0.8 + ((i * 37) % 10) / 25;
      m4.compose(p.set(t.x, 3, t.z), q, s.set(1, 1, 1)); trunk.setMatrixAt(i, m4);
      m4.compose(p.set(t.x, 6.8 * k, t.z), q, s.set(k, k, k)); crown.setMatrixAt(i, m4);
    });
    trunk.castShadow = crown.castShadow = true; scene.add(trunk, crown);

    // Lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.8); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -50; sc.right = sc.top = 50; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);
    this.lamps = map.lights.map(l => { const pl = new THREE.PointLight(0xffb060, 14, 22, 1.6); pl.position.set(l.x, l.y, l.z); scene.add(pl); return pl; });

    // Extraction zones (ring + light beam)
    for (const z of map.zones) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x6fbf6a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(EXTRACT.radius - 0.35, EXTRACT.radius, 48), mat); ring.rotation.x = -Math.PI / 2; ring.position.set(z.x, 0.06, z.z);
      const bmat = new THREE.MeshBasicMaterial({ color: 0x6fbf6a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(EXTRACT.radius, EXTRACT.radius, 40, 32, 1, true), bmat); beam.position.set(z.x, 20, z.z);
      scene.add(ring, beam); this.zoneMeshes[z.id] = { ring, beam };
    }

    // Floating ash
    this.ashGeo = new THREE.BufferGeometry();
    this.ashMat = new THREE.PointsMaterial({ color: 0xd9d0c2, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false });
    this.ash = new THREE.Points(this.ashGeo, this.ashMat); this.ash.frustumCulled = false; scene.add(this.ash);

    // Loot meshes share geometry
    this.lootGeo = { item: new THREE.BoxGeometry(0.4, 0.28, 0.4), ammo: new THREE.BoxGeometry(0.5, 0.3, 0.35), weapon: new THREE.BoxGeometry(0.75, 0.12, 0.22) };
  }

  setQuality(name) {
    const q = this.quality = QUALITY[name] || QUALITY.high;
    this.sun.castShadow = q.shadow > 0;
    if (q.shadow) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(q.shadow, q.shadow); }
    this.lamps.forEach(l => { l.visible = q.lights; });
    const n = q.ash, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 25; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; }
    this.ashGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.ashN = n; this.ashOff = true;
    this.pixelRatio = q.pr;
  }

  setTimeOfDay(name) {
    const t = TOD[name] || TOD.dusk; this.tod = t;
    this.scene.background = new THREE.Color(t.sky); this.scene.fog.color.set(t.sky); this.scene.fog.density = t.fog;
    this.sun.color.set(t.sun); this.sun.intensity = t.sunI; this.hemi.color.set(t.hemi); this.hemi.groundColor.set(t.hemiG); this.hemi.intensity = t.hemiI;
    this.ashMat.color.set(name === 'night' ? 0x8a93a8 : 0xd9d0c2);
  }

  // ---- loot ----
  setLoot(list) { for (const id of [...this.loot.keys()]) this.removeLoot(id); list.forEach(l => this.addLoot(l)); }
  addLoot(l) {
    if (this.loot.has(l.id)) return;
    const def = LOOT[l.type]; if (!def) return;
    const col = new THREE.Color(RARITY[def.rarity].color);
    const m = new THREE.Mesh(this.lootGeo[def.kind], new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.5 }));
    m.position.set(l.x, 0.45, l.z); m.castShadow = true; this.scene.add(m);
    this.loot.set(l.id, m); this.lootData.set(l.id, l);
  }
  removeLoot(id) {
    const m = this.loot.get(id); if (!m) return;
    this.scene.remove(m); m.material.dispose(); this.loot.delete(id); this.lootData.delete(id);
  }
  nearestLoot(pos, range) {
    let best = null, bd = range * range;
    for (const l of this.lootData.values()) { const d = (l.x - pos.x) ** 2 + (l.z - pos.z) ** 2; if (d < bd && Math.abs(pos.y) < 6) { bd = d; best = l; } }
    return best;
  }

  /** zones: { id -> {n, p, c} } from the server state. */
  update(dt, camPos, zones) {
    this.time += dt;
    // ash drifts around the camera
    const a = this.ashGeo.attributes.position; if (!a) return;
    const arr = a.array, n = this.ashN, wx = Math.sin(this.time * 0.1) * 0.6 + 0.6;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      arr[j] += (wx + Math.sin(this.time + i) * 0.3) * dt; arr[j + 1] -= (0.35 + (i % 5) * 0.08) * dt; arr[j + 2] += Math.cos(this.time * 0.7 + i) * 0.25 * dt;
      if (arr[j] - camPos.x > 40) arr[j] -= 80; else if (arr[j] - camPos.x < -40) arr[j] += 80;
      if (arr[j + 2] - camPos.z > 40) arr[j + 2] -= 80; else if (arr[j + 2] - camPos.z < -40) arr[j + 2] += 80;
      if (arr[j + 1] < 0 || this.ashOff) arr[j + 1] = arr[j + 1] < 0 ? 22 + (i % 7) : arr[j + 1];
    }
    this.ashOff = false; a.needsUpdate = true;
    // loot bob/spin
    for (const m of this.loot.values()) { m.rotation.y += dt * 1.2; m.position.y = 0.45 + Math.sin(this.time * 2 + m.position.x) * 0.06; }
    // zones colour: green idle, yellow while counting, red contested
    for (const id in this.zoneMeshes) {
      const z = zones[id], zm = this.zoneMeshes[id];
      const col = !z || z.n === 0 ? 0x6fbf6a : z.c ? 0xd9532b : 0xf0c040;
      zm.ring.material.color.setHex(col); zm.beam.material.color.setHex(col);
      zm.beam.material.opacity = 0.1 + (z && z.n ? 0.1 : 0) + Math.sin(this.time * 2) * 0.02;
    }
    // sun follows the camera so shadows stay sharp near the player
    const o = this.tod.pos; this.sun.target.position.set(camPos.x, 0, camPos.z); this.sun.position.set(camPos.x + o[0], o[1], camPos.z + o[2]);
  }
}
