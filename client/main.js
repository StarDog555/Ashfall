import { Settings, Menu } from './ui/Menu.js';
import { Network } from './multiplayer/Network.js';
import { Game } from './core/Game.js';

try {
  const settings = new Settings();
  const net = new Network();
  const game = new Game(settings, net);
  new Menu(settings, net, game);
  window.ashfall = { game, net };   // handy for debugging in the console
} catch (e) {
  console.error(e);
  const m = document.getElementById('menumsg'); m.classList.remove('hidden');
  m.textContent = 'Failed to start: ' + e.message + ' (WebGL required)';
}
