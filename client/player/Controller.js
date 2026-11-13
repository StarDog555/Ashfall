import * as THREE from 'three';
import { PLAYER } from '/shared/constants.js';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** First-person movement: acceleration, gravity, jump, crouch, AABB collision, head-bob. */
export class Controller {
  constructor(boxes, half) {
    this.boxes = boxes; this.half = half - 0.5;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.onGround = true; this.crouch = false;
    this.eye = PLAYER.eye; this.bob = 0; this.bobAmt = 0; this.bobY = 0; this.strafe = 0;
    this.moving = false; this.sprinting = false; this.events = { step: false, land: false, jump: false };
  }

  get height() { return this.crouch ? PLAYER.crouchHeight : PLAYER.height; }
  teleport(x, y, z, yaw) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0; this.onGround = true; }
  look(dx, dy, sens) { this.yaw -= dx * sens; this.pitch = clamp(this.pitch - dy * sens, -1.5, 1.5); }

  update(dt, keys, speedMul, canSprint) {
    const ev = this.events; ev.step = ev.land = ev.jump = false;
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    this.crouch = !!(keys.ControlLeft || keys.KeyC);
    this.sprinting = !!keys.ShiftLeft && fwd > 0 && !this.crouch && canSprint;
    const speed = (this.crouch ? PLAYER.crouch : this.sprinting ? PLAYER.sprint : PLAYER.walk) * speedMul;
    let wx = -Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * str, wz = -Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * str;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    this.moving = wl > 0;
    const acc = (this.onGround ? (wl > 0 ? 48 : 36) : 7) * dt;
    this.vel.x += clamp(wx * speed - this.vel.x, -acc, acc);
    this.vel.z += clamp(wz * speed - this.vel.z, -acc, acc);
    if (keys.Space && this.onGround) { this.vel.y = PLAYER.jump; this.onGround = false; ev.jump = true; }
    this.vel.y -= PLAYER.gravity * dt;
    this.move(dt);

    // head bob + footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const walking = this.onGround && hs > 0.5;
    this.bobAmt += ((walking ? 1 : 0) - this.bobAmt) * Math.min(1, dt * 10);
    const prev = Math.floor(this.bob / Math.PI);
    if (walking) this.bob += dt * hs * 1.7;
    if (Math.floor(this.bob / Math.PI) !== prev && walking) ev.step = true;
    this.bobY = Math.sin(this.bob * 2) * 0.035 * this.bobAmt * (this.sprinting ? 1.3 : 1);
    this.strafe += (str - this.strafe) * Math.min(1, dt * 8);
    this.eye += ((this.crouch ? PLAYER.crouchEye : PLAYER.eye) - this.eye) * Math.min(1, dt * 12);
  }

  move(dt) {
    const p = this.pos, v = this.vel;
    p.x += v.x * dt; this.pushOut();
    p.z += v.z * dt; this.pushOut();
    const prevY = p.y, h = this.height, r = PLAYER.radius;
    p.y += v.y * dt;
    if (v.y > 0) {
      for (const b of this.boxes) {
        if (Math.abs(p.x - b.x) < b.w / 2 + r * 0.6 && Math.abs(p.z - b.z) < b.d / 2 + r * 0.6 && b.y0 >= prevY + h - 0.05 && p.y + h > b.y0) { p.y = b.y0 - h; v.y = 0; }
      }
    }
    let g = 0;
    for (const b of this.boxes) {
      if (b.y1 <= prevY + 0.4 && b.y1 > g && Math.abs(p.x - b.x) < b.w / 2 + r * 0.6 && Math.abs(p.z - b.z) < b.d / 2 + r * 0.6) g = b.y1;
    }
    if (p.y <= g && v.y <= 0) {
      if (!this.onGround && v.y < -5) this.events.land = true;
      p.y = g; v.y = 0; this.onGround = true;
    } else if (p.y > g + 0.02) this.onGround = false;
    p.x = clamp(p.x, -this.half, this.half); p.z = clamp(p.z, -this.half, this.half);
  }

  pushOut() {
    const p = this.pos, r = PLAYER.radius, h = this.height;
    for (const b of this.boxes) {
      if (!(p.y < b.y1 - 0.4 && p.y + h > b.y0)) continue;
      const hx = b.w / 2, hz = b.d / 2;
      const cx = clamp(p.x, b.x - hx, b.x + hx), cz = clamp(p.z, b.z - hz, b.z + hz);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else {   // centre is inside the box: leave through the nearest face
        const px = hx - Math.abs(p.x - b.x), pz = hz - Math.abs(p.z - b.z);
        if (px < pz) p.x += (p.x >= b.x ? 1 : -1) * (px + r); else p.z += (p.z >= b.z ? 1 : -1) * (pz + r);
      }
    }
  }
}
