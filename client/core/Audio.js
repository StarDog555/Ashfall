// Fully synthesized audio (no asset files): positional gunfire, footsteps, wind, UI blips.
export class GameAudio {
  constructor() { this.ctx = null; this.volume = 0.6; this.farTimer = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startWind();
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  setListener(p, yaw) {
    if (!this.ctx) return;
    const L = this.ctx.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = fx; L.forwardY.value = 0; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.3; p.maxDistance = 400;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.master);
    return p;
  }

  burst({ dur = 0.1, freq = 1500, q = 0.7, type = 'lowpass', gain = 0.5, pos = null, sweep = 0, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out(pos)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  tone({ freq = 440, end = 0, dur = 0.1, gain = 0.2, type = 'sine', pos = null, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.out(pos)); o.start(t); o.stop(t + dur + 0.05);
  }

  shot(w, pos = null, far = false) {
    const P = { ar: [1900, 0.16, 0.7, 110], smg: [2600, 0.1, 0.5, 140], shotgun: [1200, 0.28, 0.9, 70], sniper: [1000, 0.5, 1, 55], pistol: [2200, 0.12, 0.55, 120] }[w] || [1800, 0.12, 0.6, 100];
    const lp = far ? 0.35 : 1;
    this.burst({ dur: P[1], freq: P[0] * lp, gain: P[2], pos, sweep: 0.25 });
    this.tone({ freq: P[3], end: 35, dur: P[1] * 1.2, gain: P[2] * 0.6, type: 'triangle', pos });
    if (w === 'sniper' || w === 'shotgun') this.burst({ dur: 0.6, freq: 500, gain: 0.25, pos, delay: 0.08, sweep: 0.3 });
  }

  reload() {
    this.burst({ dur: 0.05, freq: 3000, type: 'bandpass', gain: 0.25 });
    this.burst({ dur: 0.07, freq: 1800, type: 'bandpass', gain: 0.3, delay: 0.7 });
    this.burst({ dur: 0.06, freq: 2400, type: 'bandpass', gain: 0.35, delay: 1.5 });
  }
  click() { this.burst({ dur: 0.03, freq: 3500, type: 'bandpass', gain: 0.2 }); }
  step(sprint) { this.burst({ dur: 0.09, freq: sprint ? 420 : 300, gain: sprint ? 0.22 : 0.14 }); }
  jump() { this.burst({ dur: 0.12, freq: 500, gain: 0.12 }); }
  land() { this.burst({ dur: 0.14, freq: 260, gain: 0.3 }); }
  hit(head) { this.tone({ freq: head ? 1500 : 900, end: head ? 1100 : 600, dur: 0.08, gain: 0.2, type: 'square' }); }
  hurt() { this.tone({ freq: 140, end: 60, dur: 0.25, gain: 0.35, type: 'sawtooth' }); }
  impact(pos) { this.burst({ dur: 0.07, freq: 1600, type: 'bandpass', gain: 0.18, pos }); }
  pickup() { this.tone({ freq: 600, end: 900, dur: 0.1, gain: 0.15 }); }
  ui() { this.tone({ freq: 700, dur: 0.04, gain: 0.08, type: 'square' }); }
  beep(kind) {
    if (kind === 'ok') { this.tone({ freq: 660, dur: 0.15, gain: 0.2 }); this.tone({ freq: 990, dur: 0.3, gain: 0.2, delay: 0.15 }); }
    else if (kind === 'warn') this.tone({ freq: 300, dur: 0.2, gain: 0.2, type: 'square' });
    else this.tone({ freq: 880, dur: 0.1, gain: 0.15 });
  }

  startWind() {
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.07;
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.04;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }

  /** Ambient far-away gunfire, called every frame while in game. */
  update(dt, listener) {
    if (!this.ctx) return;
    this.farTimer -= dt;
    if (this.farTimer <= 0) {
      this.farTimer = 6 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 90;
      const pos = { x: listener.x + Math.cos(a) * r, y: 2, z: listener.z + Math.sin(a) * r };
      const w = ['ar', 'ar', 'smg', 'pistol', 'sniper'][Math.floor(Math.random() * 5)];
      const n = w === 'ar' || w === 'smg' ? 3 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < n; i++) setTimeout(() => this.shot(w, pos, true), i * 90);
    }
  }
}
