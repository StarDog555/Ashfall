# ASHFALL — multiplayer extraction FPS (small demo)

Browser FPS built with **Three.js** (client) and **Node.js + Socket.IO** (authoritative server).
No build step, no bundler — just `npm install` and run.

## Run

```bash
npm install
npm start
# open http://localhost:3000 in two or more browser windows (or LAN machines: http://<your-ip>:3000)
```

Requires Node 18+. Set `PORT=8080` to change the port.

## Modes

| Mode | Rules |
|------|-------|
| **Extraction** | Loot the *Ashen Industrial Zone*, then hold an extraction ring for 6 s. Die and you drop everything. |
| **Team Extraction** | Same, in two teams (auto-balanced). Teammates extract together; no friendly fire. |
| **Deathmatch** | 3 s respawns, most kills when the 5-minute round ends. |

An enemy standing in a ring **contests** it: the countdown stops and drains until only one side remains.

## Controls

`WASD` move · `Shift` sprint · `Ctrl`/`C` crouch · `Space` jump · `LMB` fire · `RMB` aim (ADS) · `R` reload
`1-5` / mouse wheel switch weapon · `E` pick up · `H` medkit · `I` inventory · `Tab` scoreboard · `Esc` pause

## What the server owns (authoritative)

- Hit detection (ray vs. map boxes and player cylinders, spread, shotgun pellets, headshots ×2)
- Damage, armor absorption, health, kills / deaths / respawns
- Ammo, fire-rate limiting and reload timers
- Loot spawns, pickups (range + weight checks), inventory, item use / drop, loot dropped on death
- Extraction progress, contesting, banking loot, round timer and reset
- Movement validation: a speed budget and bounds check; invalid movement is corrected back

The client sends *intent* (position, aim, "shoot", "pickup"); it never reports damage or results.

## Layout

```
client/   index.html · style.css · main.js
  core/       Game.js (loop, net events) · Input.js · Audio.js (synthesized WebAudio, positional)
  player/     Controller.js (movement, collision) · RemotePlayers.js
  weapons/    WeaponManager.js (viewmodels, recoil, ADS, reload, muzzle flash)
  world/      World.js (map, instanced meshes, fog/lights, ash, time of day) · Effects.js
  multiplayer/Network.js
  ui/         HUD.js · Inventory.js · Menu.js (menu + settings)
server/   server.js (static + Socket.IO) · GameServer.js · MatchManager.js (rooms) · PlayerManager.js
shared/   constants.js (weapons, loot, modes) · map.js (deterministic map + ray helpers)
```

## Demo scope — what is and isn't in here

Implemented: everything above, 5 weapon classes (AR, SMG, shotgun, sniper, pistol), grid inventory with weight,
rarity, drag/drop, medkits/armor/backpack, ammo crates, 4 graphics presets, day/dusk/night, ash particles, fog, shadows,
InstancedMesh batching, positional synthesized audio, stash saved in the browser.

Not in this demo (kept small): purchasing gear with the stash, per-weapon attachments, level-of-detail meshes,
lag compensation / client-side reconciliation beyond snapping, and multiple maps. The stash is stored client-side
(localStorage), so it is for display only and is not trusted by the server.
