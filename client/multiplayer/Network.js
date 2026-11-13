/** Thin wrapper over the global `io` from /socket.io/socket.io.js */
export class Network {
  constructor() {
    this.socket = io({ reconnection: false, timeout: 6000 });
    this.id = null; this.ping = 0;
    this.socket.on('connect', () => { this.id = this.socket.id; });
    setInterval(() => {
      if (!this.socket.connected) return;
      const t = performance.now();
      this.socket.volatile.emit('latency', t, () => { this.ping = Math.round(performance.now() - t); });
    }, 2000);
  }
  on(ev, fn) { this.socket.on(ev, fn); }
  get connected() { return this.socket.connected; }
  reconnect() { this.socket.connect(); }
  join(info) { this.socket.emit('join', info); }
  lobby() { this.socket.emit('lobby'); }
  move(d) { this.socket.volatile.emit('move', d); }
  shoot(d) { this.socket.emit('shoot', d); }
  reload() { this.socket.emit('reload'); }
  weapon(id) { this.socket.emit('weapon', id); }
  pickup(id) { this.socket.emit('pickup', id); }
  use(uid) { this.socket.emit('use', uid); }
  drop(uid) { this.socket.emit('drop', uid); }
}
