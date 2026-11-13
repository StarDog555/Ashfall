// Deterministic map generation: server and client both call buildMap() and get identical geometry.
export const MAP_HALF = 58;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMap() {
  const R = rng(1337);
  const boxes = [], roads = [], loot = [], lights = [];
  const add = (x, z, w, d, y0, h, c, kind = 'block') => boxes.push({ x, z, w, d, y0, y1: y0 + h, c, kind });

  // Perimeter walls
  const E = MAP_HALF + 1, L = 2 * MAP_HALF + 4;
  add(0, -E, L, 2, 0, 8, 0x1f1f1f, 'wall'); add(0, E, L, 2, 0, 8, 0x1f1f1f, 'wall');
  add(-E, 0, 2, L, 0, 8, 0x1f1f1f, 'wall'); add(E, 0, 2, L, 0, 8, 0x1f1f1f, 'wall');

  // Roads (visual only)
  roads.push({ x: 0, z: 0, w: 8, d: 2 * MAP_HALF }, { x: 0, z: 0, w: 2 * MAP_HALF, d: 8 });

  // Warehouses: walls with door gaps north/south, roof, crates inside
  const warehouse = (cx, cz, w, d, col) => {
    const t = 0.4, h = 5, g = 3.4, seg = (w - g) / 2, off = (w + g) / 4;
    for (const z of [cz - d / 2, cz + d / 2]) {
      add(cx - off, z, seg, t, 0, h, col, 'wall');
      add(cx + off, z, seg, t, 0, h, col, 'wall');
    }
    add(cx - w / 2, cz, t, d, 0, h, col, 'wall');
    add(cx + w / 2, cz, t, d, 0, h, col, 'wall');
    add(cx, cz, w + 0.6, d + 0.6, h, 0.3, 0x2e2e2e, 'roof');
    add(cx - w / 4, cz - d / 4, 2, 2, 0, 1.2, 0x6b5a3a, 'crate');
    add(cx + w / 4, cz - d / 4, 1.6, 3, 0, 1.0, 0x5a4a30, 'crate');
    add(cx, cz - d / 4, 1.2, 1.2, 0, 2.2, 0x445544, 'crate');
    lights.push({ x: cx, y: 4.2, z: cz });
    loot.push({ x: cx - w / 4, z: cz + d / 4 }, { x: cx + w / 4, z: cz + d / 4 }, { x: cx, z: cz + 1.5 }, { x: cx - w / 4 + 2.6, z: cz - d / 4 });
  };
  warehouse(-30, -25, 24, 16, 0x5d5a55);
  warehouse(28, -30, 20, 14, 0x4f5459);
  warehouse(-5, 35, 26, 14, 0x585149);

  // Military checkpoint on the N-S road
  add(-3.4, -14, 3.0, 1, 0, 1.1, 0x77746b, 'barrier');
  add(3.4, -14, 3.0, 1, 0, 1.1, 0x77746b, 'barrier');
  add(7, -14, 3.5, 3.5, 0, 2.6, 0x4a5240, 'wall');
  add(-7, -12, 4, 1, 0, 1.0, 0x8a7a55, 'crate');
  loot.push({ x: 7, z: -10.5 }, { x: -8, z: -15 });

  // Shipping containers
  const container = (x, z, alongX, c, y0 = 0) => {
    add(x, z, alongX ? 6 : 2.4, alongX ? 2.4 : 6, y0, 2.6, c, 'container');
  };
  container(-20, 12, true, 0x8a3b2a); container(-20, 15, true, 0x2a5a7a); container(-20, 12, true, 0x3a6a3a, 2.6);
  container(-45, -8, false, 0x7a6a2a); container(-45, -2, false, 0x5a2a2a);
  container(15, 10, true, 0x2a4a6a); container(15, 13, true, 0x6a3a2a);
  container(40, -10, false, 0x3a5a3a); container(40, -3, false, 0x8a5a2a);
  container(-10, -50, true, 0x3a3a6a); container(5, -48, true, 0x6a2a2a);
  loot.push({ x: -20, z: 18 }, { x: -26, z: 13 }, { x: -41, z: -5 }, { x: 15, z: 17 }, { x: 44, z: -6 }, { x: -10, z: -46 });

  // Destroyed vehicles
  const car = (x, z, rot) => {
    const w = rot ? 1.9 : 4.4, d = rot ? 4.4 : 1.9;
    add(x, z, w, d, 0.25, 1.1, 0x4a2f22, 'car');
    add(x, z, rot ? 1.7 : 2.3, rot ? 2.3 : 1.7, 1.35, 0.6, 0x2c2c2c, 'car');
    loot.push(rot ? { x: x + 2.6, z } : { x, z: z + 2.6 });
  };
  car(-10, 8, false); car(12, -5, true); car(25, 15, false); car(-35, 25, true); car(8, -28, false); car(-52, 35, false);

  // Spawns, extraction zones
  const spawns = [[-52, -52], [52, -20], [-52, 48], [-30, -54], [20, -54], [54, 30], [-54, 20], [0, 56]].map(([x, z]) => ({ x, z }));
  const zones = [{ id: 'A', x: -52, z: 10 }, { id: 'B', x: 52, z: -45 }, { id: 'C', x: 8, z: 52 }];

  // Forest (collision trunks; client draws instanced canopies)
  let placed = 0, tries = 0;
  while (placed < 45 && tries++ < 800) {
    const x = 28 + R() * 28, z = 8 + R() * 48;
    const near = (p, r) => Math.hypot(p.x - x, p.z - z) < r;
    if (spawns.some(s => near(s, 6)) || zones.some(zn => near(zn, 8))) continue;
    if (boxes.some(b => Math.abs(b.x - x) < b.w / 2 + 2 && Math.abs(b.z - z) < b.d / 2 + 2)) continue;
    add(x, z, 0.7, 0.7, 0, 6, 0x3b2a1a, 'tree');
    placed++;
  }
  return { half: MAP_HALF, boxes, roads, loot, lights, spawns, zones };
}

// ---- Ray helpers (used by the server for hit detection) ----
export function rayBoxes(boxes, o, d, maxT) {
  let best = Infinity;
  for (const b of boxes) {
    let t0 = 0, t1 = maxT, ok = true;
    const mn = [b.x - b.w / 2, b.y0, b.z - b.d / 2], mx = [b.x + b.w / 2, b.y1, b.z + b.d / 2];
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < mn[i] || oo[i] > mx[i]) { ok = false; break; } }
      else {
        let a = (mn[i] - oo[i]) / dd[i], c = (mx[i] - oo[i]) / dd[i];
        if (a > c) { const s = a; a = c; c = s; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok && t0 < best) best = t0;
  }
  if (d.y < -1e-6) { const tg = -o.y / d.y; if (tg > 0 && tg < best) best = tg; }
  return best;
}

// Vertical cylinder (player body). Returns { t, y } or null.
export function rayCylinder(o, d, cx, cz, y0, y1, r) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
  if (c < 0) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return null;
  const y = o.y + d.y * t;
  if (y < y0 || y > y1) return null;
  return { t, y };
}
