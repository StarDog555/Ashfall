import * as THREE from 'three';
import { WEAPONS } from '/shared/constants.js';

const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.5 });
const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };

// Procedural first-person models. Barrel points down -Z. userData.muzzle = z of the muzzle.
const BUILD = {
  ar:      g => { g.add(box(.06, .09, .5, 0, 0, -.1, 0x2b2b2b), box(.035, .035, .38, 0, .02, -.54, 0x111111), box(.05, .15, .1, 0, -.11, .02, 0x222222), box(.05, .08, .26, 0, -.01, .3, 0x5a3d22), box(.04, .1, .06, 0, -.1, -.2, 0x1a1a1a)); return -.76; },
  smg:     g => { g.add(box(.06, .09, .34, 0, 0, -.05, 0x2d2f33), box(.03, .03, .22, 0, .01, -.33, 0x111111), box(.045, .16, .07, 0, -.12, .02, 0x222222), box(.04, .06, .18, 0, -.01, .22, 0x333333)); return -.46; },
  shotgun: g => { g.add(box(.06, .08, .5, 0, 0, -.1, 0x2a2a2a), box(.04, .04, .62, 0, .03, -.45, 0x151515), box(.055, .05, .25, 0, -.04, -.35, 0x6a4a28), box(.05, .09, .3, 0, -.02, .32, 0x5a3d22)); return -.78; },
  sniper:  g => { g.add(box(.06, .09, .62, 0, 0, -.1, 0x30342c), box(.03, .03, .6, 0, .02, -.62, 0x111111), box(.045, .05, .22, 0, .095, -.1, 0x111111), box(.05, .1, .3, 0, -.02, .38, 0x3a3a2a)); return -1.0; },
  pistol:  g => { g.add(box(.045, .06, .22, 0, 0, -.05, 0x2a2a2a), box(.04, .12, .06, 0, -.08, .04, 0x1a1a1a)); return -.18; },
};
const HIP = new THREE.Vector3(0.22, -0.2, -0.42), ADS = new THREE.Vector3(0, -0.145, -0.3);

/** First-person viewmodel: sway, bob, kick, reload and ADS animation + muzzle flash. */
export class WeaponManager {
  constructor(camera) {
    this.root = new THREE.Group(); camera.add(this.root);
    this.models = {}; this.cur = 'ar'; this.ads = 0; this.adsOn = false; this.kick = 0; this.sx = 0; this.sy = 0;
    this.bobT = 0; this.reloadT = -1; this.reloadDur = 1; this.switchT = 0; this.flash = 0;
    for (const id of Object.keys(BUILD)) {
      const g = new THREE.Group(), z = BUILD[id](g);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      f.position.set(0, 0.01, z - 0.05); f.visible = false; g.add(f); g.userData = { flash: f, muzzle: z };
      g.visible = false; this.root.add(g); this.models[id] = g;
    }
    this.light = new THREE.PointLight(0xffa050, 0, 10); camera.add(this.light); this.light.position.set(0.1, -0.1, -1);
    this.select('ar', true);
  }

  select(id, instant) { this.models[this.cur].visible = false; this.cur = id; this.models[id].visible = true; if (!instant) this.switchT = 1; this.reloadT = -1; }
  fire() { this.kick = Math.min(1.4, this.kick + 1); this.flash = 0.045; this.models[this.cur].userData.flash.rotation.z = Math.random() * 6; }
  startReload(sec) { this.reloadT = 0; this.reloadDur = sec; }
  endReload() { this.reloadT = -1; }
  muzzleWorld(out) { const m = this.models[this.cur]; return m.localToWorld(out.set(0, 0.01, m.userData.muzzle)); }

  update(dt, o) {   // o: { moving, sprinting, dx, dy, aim }
    this.ads += ((o.aim ? 1 : 0) - this.ads) * Math.min(1, dt * 14);
    const w = WEAPONS[this.cur];
    this.sx += (THREE.MathUtils.clamp(-o.dx * 0.0006, -0.05, 0.05) - this.sx) * Math.min(1, dt * 8);
    this.sy += (THREE.MathUtils.clamp(o.dy * 0.0006, -0.05, 0.05) - this.sy) * Math.min(1, dt * 8);
    if (o.moving) this.bobT += dt * (o.sprinting ? 11 : 7.5);
    const bobK = (o.moving ? 1 : 0.15) * (1 - this.ads * 0.85);
    const bx = Math.sin(this.bobT) * 0.008 * bobK, by = Math.abs(Math.cos(this.bobT)) * 0.008 * bobK;
    this.kick = Math.max(0, this.kick - dt * 9); this.switchT = Math.max(0, this.switchT - dt * 4);
    let dip = 0, tilt = 0;
    if (this.reloadT >= 0) { this.reloadT += dt / this.reloadDur; dip = Math.sin(Math.min(1, this.reloadT) * Math.PI); if (this.reloadT >= 1) this.reloadT = -1; }
    const r = this.root, p = HIP.clone().lerp(ADS, this.ads);
    const sprintPose = o.sprinting ? 1 : 0;
    r.position.set(p.x + bx + this.sx, p.y + by + this.sy - dip * 0.16 - this.switchT * 0.3 - sprintPose * 0.05, p.z + this.kick * 0.05);
    r.rotation.set(this.kick * 0.07 - dip * 0.55 + sprintPose * 0.1, sprintPose * 0.45 + this.sx * 2, dip * 0.35 + tilt);
    this.models['sniper'].visible = this.cur === 'sniper' && this.ads < 0.8;   // scope overlay takes over when fully aimed
    if (this.flash > 0) { this.flash -= dt; this.models[this.cur].userData.flash.visible = this.flash > 0; this.light.intensity = this.flash > 0 ? 6 : 0; }
    else { this.models[this.cur].userData.flash.visible = false; this.light.intensity = 0; }
    return 1 + (w.zoom - 1) * this.ads;   // zoom factor for FOV
  }
}
