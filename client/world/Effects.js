import * as THREE from 'three';
const UP = new THREE.Vector3(0, 1, 0);

/** Pooled tracers and impact sparks. */
export class Effects {
  constructor(scene) {
    const tg = new THREE.CylinderGeometry(1, 1, 1, 4), tm = () => new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracers = Array.from({ length: 48 }, () => { const m = new THREE.Mesh(tg, tm()); m.visible = false; scene.add(m); return { m, ttl: 0 }; });
    const sg = new THREE.SphereGeometry(0.05, 4, 4);
    this.sparks = Array.from({ length: 80 }, () => { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffc070 })); m.visible = false; scene.add(m); return { m, ttl: 0, v: new THREE.Vector3() }; });
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  tracer(from, to) {
    const t = this.tracers.find(x => x.ttl <= 0); if (!t) return;
    const a = this._a.set(from[0], from[1], from[2]), b = this._b.set(to[0], to[1], to[2]), d = this._d.subVectors(b, a), len = d.length();
    if (len < 0.5) return;
    t.m.position.copy(a).addScaledVector(d, 0.5); t.m.quaternion.setFromUnitVectors(UP, d.normalize()); t.m.scale.set(0.012, len, 0.012);
    t.m.visible = true; t.ttl = 0.07;
  }

  impact(p, kind) {
    const col = kind === 2 ? 0xc02818 : 0xffc070, n = kind === 2 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const s = this.sparks.find(x => x.ttl <= 0); if (!s) return;
      s.m.position.set(p[0], p[1], p[2]); s.m.material.color.setHex(col);
      s.v.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3); s.ttl = 0.35; s.m.visible = true;
    }
  }

  update(dt) {
    for (const t of this.tracers) if (t.ttl > 0) { t.ttl -= dt; if (t.ttl <= 0) t.m.visible = false; }
    for (const s of this.sparks) if (s.ttl > 0) {
      s.ttl -= dt; s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt);
      if (s.ttl <= 0) s.m.visible = false;
    }
  }
}
