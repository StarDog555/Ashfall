import { Room } from './MatchManager.js';
import { Player } from './PlayerManager.js';
import { MODES } from '../shared/constants.js';

/** Wires Socket.IO connections to match rooms. All handlers are wrapped so bad input can never crash the server. */
export class GameServer {
  constructor(io) {
    this.io = io;
    this.rooms = {};
    for (const m of Object.keys(MODES)) this.rooms[m] = new Room(io, m);
    this.last = Date.now();
    io.on('connection', s => this.onConnect(s));
    setInterval(() => this.tick(), 50);
  }

  tick() {
    const now = Date.now(), dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    for (const r of Object.values(this.rooms)) {
      try { r.tick(dt); } catch (e) { console.error('tick error', e); }
    }
  }

  lobbyInfo() {
    return Object.entries(this.rooms).map(([mode, r]) => ({ mode, name: MODES[mode].name, players: r.pm.size, time: Math.ceil(r.timeLeft) }));
  }

  onConnect(socket) {
    let player = null, room = null;
    const on = (ev, fn) => socket.on(ev, (...a) => { try { fn(...a); } catch (e) { console.error(`[${ev}]`, e.message); } });
    const live = fn => (...a) => { if (player && room) fn(...a); };

    socket.emit('lobby', this.lobbyInfo());
    on('lobby', () => socket.emit('lobby', this.lobbyInfo()));
    on('latency', (t, cb) => { if (typeof cb === 'function') cb(t); });

    on('join', d => {
      if (player) return;
      d = d && typeof d === 'object' ? d : {};
      room = this.rooms[MODES[d.mode] ? d.mode : 'extraction'];
      player = new Player(socket, d);
      room.join(player);
      console.log(`+ ${player.name} joined ${room.mode} (${room.pm.size} online)`);
    });
    on('move', live(d => room.onMove(player, d)));
    on('shoot', live(d => room.shoot(player, d)));
    on('reload', live(() => room.startReload(player)));
    on('weapon', live(id => room.setWeapon(player, String(id))));
    on('pickup', live(id => room.pickup(player, id | 0)));
    on('use', live(uid => room.useItem(player, uid | 0)));
    on('drop', live(uid => room.dropItem(player, uid | 0)));

    socket.on('disconnect', () => {
      if (player && room) { room.leave(player); console.log(`- ${player.name} left (${room.pm.size} online)`); }
    });
  }
}
