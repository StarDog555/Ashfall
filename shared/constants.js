// Shared between server (authoritative) and client (prediction / UI).
export const TICK_RATE = 20;

export const PLAYER = {
  radius: 0.4, height: 1.8, crouchHeight: 1.25, eye: 1.65, crouchEye: 1.15,
  walk: 4.2, sprint: 6.8, crouch: 2.1, jump: 6.0, gravity: 18,
  maxHp: 100, maxWeight: 20,
};

export const WEAPON_ORDER = ['ar', 'smg', 'shotgun', 'sniper', 'pistol'];

export const WEAPONS = {
  ar:      { name: 'AK-74M',  cat: 'Assault Rifle',  dmg: 24, rpm: 650, mag: 30, reload: 2.3, spread: 0.014, adsSpread: 0.004,  recoil: 0.010, speed: 0.95, auto: true,  range: 200, zoom: 1.5 },
  smg:     { name: 'MP7 PDW', cat: 'Submachine Gun', dmg: 17, rpm: 900, mag: 35, reload: 1.8, spread: 0.020, adsSpread: 0.008,  recoil: 0.007, speed: 1.0,  auto: true,  range: 120, zoom: 1.35 },
  shotgun: { name: 'MP-153',  cat: 'Shotgun',        dmg: 11, pellets: 8, rpm: 70, mag: 6, reload: 3.0, spread: 0.055, adsSpread: 0.04, recoil: 0.05, speed: 0.9, auto: false, range: 60, zoom: 1.2 },
  sniper:  { name: 'SV-98',   cat: 'Sniper Rifle',   dmg: 90, rpm: 45,  mag: 5,  reload: 3.2, spread: 0.030, adsSpread: 0.0004, recoil: 0.06,  speed: 0.85, auto: false, range: 400, zoom: 3.5 },
  pistol:  { name: 'P226',    cat: 'Pistol',         dmg: 21, rpm: 400, mag: 15, reload: 1.5, spread: 0.016, adsSpread: 0.006,  recoil: 0.02,  speed: 1.0,  auto: false, range: 120, zoom: 1.25 },
};

export const RARITY = {
  common:   { name: 'Common',   color: '#9aa4a0' },
  uncommon: { name: 'Uncommon', color: '#5fbf6a' },
  rare:     { name: 'Rare',     color: '#4a90ff' },
  epic:     { name: 'Epic',     color: '#c15cff' },
};

// kind: item (goes into inventory) | ammo | weapon (unlocks weapon). `weight` = spawn weight.
export const LOOT = {
  medkit:   { kind: 'item', name: 'Field Medkit',    abbr: 'MED',  w: 2, rarity: 'common',   value: 150,  usable: true, weight: 14, desc: 'Restores 50 HP. Click or press H to use.' },
  armor:    { kind: 'item', name: 'Plate Carrier',   abbr: 'ARM',  w: 5, rarity: 'uncommon', value: 400,  usable: true, weight: 6,  desc: 'Equip for 50 armor. Absorbs 60% of incoming damage.' },
  backpack: { kind: 'item', name: 'Field Backpack',  abbr: 'BAG',  w: 1, rarity: 'uncommon', value: 300,  usable: true, weight: 4,  desc: 'Equip to raise carry capacity by 10 kg.' },
  watch:    { kind: 'item', name: 'Gold Watch',      abbr: 'WCH',  w: 1, rarity: 'uncommon', value: 600,  weight: 12, desc: 'Pre-collapse luxury. Sells well if you extract.' },
  drive:    { kind: 'item', name: 'Encrypted Drive', abbr: 'DRV',  w: 1, rarity: 'rare',     value: 1400, weight: 7,  desc: 'Corporate data. Buyers pay a premium.' },
  relic:    { kind: 'item', name: 'Reactor Core',    abbr: 'CORE', w: 6, rarity: 'epic',     value: 3500, weight: 2,  desc: 'Heavy, glowing, extremely valuable.' },
  ammo:     { kind: 'ammo', name: 'Ammo Crate',      rarity: 'common', weight: 20, desc: '+1 magazine for every weapon you carry.' },
  w_ar:     { kind: 'weapon', weapon: 'ar',      name: 'AK-74M',  rarity: 'uncommon', weight: 4 },
  w_smg:    { kind: 'weapon', weapon: 'smg',     name: 'MP7 PDW', rarity: 'uncommon', weight: 4 },
  w_shotgun:{ kind: 'weapon', weapon: 'shotgun', name: 'MP-153',  rarity: 'rare',     weight: 4 },
  w_sniper: { kind: 'weapon', weapon: 'sniper',  name: 'SV-98',   rarity: 'epic',     weight: 2 },
};

export const MODES = {
  extraction: { name: 'Extraction',      time: 480, respawn: 5, loot: true,  zones: true,  teams: false },
  team:       { name: 'Team Extraction', time: 480, respawn: 5, loot: true,  zones: true,  teams: true  },
  deathmatch: { name: 'Deathmatch',      time: 300, respawn: 3, loot: false, zones: false, teams: false },
};

export const EXTRACT = { radius: 5, time: 6 };

export const OPERATORS = [
  { id: 0, name: 'VANTA',   color: '#c9a23c' },
  { id: 1, name: 'EMBER',   color: '#d9532b' },
  { id: 2, name: 'GLACIER', color: '#4aa3d9' },
  { id: 3, name: 'MOSS',    color: '#6fa04a' },
];
export const TEAM_COLORS = ['#d9532b', '#4aa3d9'];
