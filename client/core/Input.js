export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.keys = {}; this.down = new Set();
    this.mouse = { l: false, r: false, dx: 0, dy: 0 }; this.wheel = 0; this.locked = false; this.onLockChange = null;
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (!e.repeat) this.down.add(e.code);
      this.keys[e.code] = true;
      if (this.locked && ['Tab', 'Space', 'ControlLeft', 'F5'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('mousedown', e => { if (!this.locked) return; if (e.button === 0) this.mouse.l = true; if (e.button === 2) this.mouse.r = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    addEventListener('mousemove', e => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => this.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.clear();
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }
  clear() { this.keys = {}; this.mouse.l = this.mouse.r = false; }
  pressed(code) { return this.down.has(code); }
  endFrame() { this.down.clear(); this.mouse.dx = this.mouse.dy = 0; this.wheel = 0; }
  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } }
}
