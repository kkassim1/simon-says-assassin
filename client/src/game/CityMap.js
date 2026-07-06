import * as THREE from 'three';

// 16×16 grid layout: 0=road, 1=building block, 2=park,
// 3=stadium, 4=construction site, 5=monument plaza, 6=water
// Default layout only — the server sends the actual map grid at game start
// (see server/src/maps.js); setCityGrid() swaps it in before buildCity().
const CITY_GRID = [
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 0
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 1
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [1, 5, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 0, 1], // 3
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 4
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 5
  [1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 4, 1, 0, 1], // 6
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 7
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 8
  [1, 1, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 1], // 9
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 10
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 11
  [1, 1, 0, 1, 1, 0, 1, 3, 0, 1, 1, 0, 1, 1, 0, 1], // 12
  [2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 2], // 13
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 14
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 15
];

const CELL = 20;

// Mutates CITY_GRID in place so existing importers (TrafficSystem, Minimap)
// see the server-selected map without changing their imports.
export function setCityGrid(grid) {
  if (!Array.isArray(grid) || !grid.length) return;
  CITY_GRID.length = 0;
  for (const row of grid) CITY_GRID.push([...row]);
}

// Hide spots derived from the grid — MUST match server/src/maps.js
// (parks: tree corners; plaza: planters; construction: sand pile).
export function hideSpotsFromGrid(grid = CITY_GRID) {
  const offX = -(grid[0].length * CELL) / 2 + CELL / 2;
  const offZ = -(grid.length * CELL) / 2 + CELL / 2;
  const spots = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      const v = grid[row][col];
      const cx = offX + col * CELL;
      const cz = offZ + row * CELL;
      if (v === 2) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          spots.push({ x: cx + sx * 4.68, z: cz + sz * 4.68, r: 2.4 });
        }
      } else if (v === 5) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          spots.push({ x: cx + sx * 8, z: cz + sz * 8, r: 2.2 });
        }
      } else if (v === 4) {
        spots.push({ x: cx + 4, z: cz - 5, r: 2.6 });
      }
    }
  }
  return spots;
}

// ── Procedural surface textures (cheap noise, generated once) ───────────────
function _makeNoiseTexture(baseHex, variation, repeat, speckles = 0) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(baseHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * variation * 255;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // Larger speckles (cracks / pebbles / grass blades)
  for (let i = 0; i < speckles; i++) {
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)';
    ctx.fillStyle = shade;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

// ── Shared materials (created once) ─────────────────────────────────────────
const MAT_GROUND    = new THREE.MeshLambertMaterial({ color: 0x0d0d14 });
const MAT_ROAD      = new THREE.MeshLambertMaterial({ color: 0x2b2b33, map: _makeNoiseTexture(0x9a9aa4, 0.07, 5, 90) });
const MAT_SIDEWALK  = new THREE.MeshLambertMaterial({ color: 0x45454f, map: _makeNoiseTexture(0xbdbdc6, 0.05, 6, 50) });
const MAT_MARK_Y    = new THREE.MeshLambertMaterial({ color: 0xdba800 });
const MAT_MARK_W    = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
const MAT_POLE      = new THREE.MeshLambertMaterial({ color: 0x6a6a78 });
const MAT_LAMPHEAD  = new THREE.MeshLambertMaterial({ color: 0xffdd99, emissive: new THREE.Color(0x884422) });
const MAT_HYDRANT   = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
const MAT_DUMPSTER  = new THREE.MeshLambertMaterial({ color: 0x1a3322 });
const MAT_DUMP_LID  = new THREE.MeshLambertMaterial({ color: 0x223a2a });
const MAT_WOOD      = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
const MAT_METAL     = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
const MAT_GREY_ROOF = new THREE.MeshLambertMaterial({ color: 0x333342 });
const MAT_GRASS     = new THREE.MeshLambertMaterial({ color: 0x1e4a24, map: _makeNoiseTexture(0xa8c8a0, 0.09, 7, 120) });
const MAT_FIELD     = new THREE.MeshLambertMaterial({ color: 0x1c5a28, map: _makeNoiseTexture(0xa8c8a0, 0.07, 5, 80) });
const MAT_DIRT      = new THREE.MeshLambertMaterial({ color: 0x4a3320, map: _makeNoiseTexture(0xc0a080, 0.1, 5, 100) });
const MAT_PLAZA     = new THREE.MeshLambertMaterial({ color: 0x4a4a56, map: _makeNoiseTexture(0xc4c4ce, 0.04, 8, 30) });
const MAT_BLEACHER  = new THREE.MeshLambertMaterial({ color: 0x37374a, side: THREE.DoubleSide });
const MAT_BLEACH_TOP = new THREE.MeshLambertMaterial({ color: 0x8a2f2f, side: THREE.DoubleSide });
const MAT_STEEL     = new THREE.MeshLambertMaterial({ color: 0xb3552a });
const MAT_CRANE     = new THREE.MeshLambertMaterial({ color: 0xd8b420 });
const MAT_CONE      = new THREE.MeshLambertMaterial({ color: 0xe86f1a, emissive: new THREE.Color(0x3a1500) });
const MAT_BARRIER   = new THREE.MeshLambertMaterial({ color: 0xcccccc });
const MAT_MONUMENT  = new THREE.MeshLambertMaterial({ color: 0x6a6a7a });
const MAT_GOLD      = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: new THREE.Color(0x553f08) });
const MAT_FLOOD     = new THREE.MeshBasicMaterial({ color: 0xf4f4ff });
const MAT_WATER     = new THREE.MeshLambertMaterial({ color: 0x1a3a7a, transparent: true, opacity: 0.85 });
const MAT_EMBANK    = new THREE.MeshLambertMaterial({ color: 0x3c3c48 });
const MAT_PARK_PATH = new THREE.MeshLambertMaterial({ color: 0x3a3028 });
const MAT_FOUNTAIN  = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
const MAT_F_WATER   = new THREE.MeshLambertMaterial({ color: 0x2244aa, transparent: true, opacity: 0.7 });
const MAT_BENCH     = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
const MAT_BENCH_LEG = new THREE.MeshLambertMaterial({ color: 0x2a2a38 });
const MAT_TREE_T    = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
const MAT_TREE_C1   = new THREE.MeshLambertMaterial({ color: 0x1a5520 });
const MAT_TREE_C2   = new THREE.MeshLambertMaterial({ color: 0x246824 });
const MAT_MANHOLE   = new THREE.MeshLambertMaterial({ color: 0x1e1e28 });
const MAT_WALL      = new THREE.MeshLambertMaterial({ color: 0x12121e });
const MAT_HELIPAD   = new THREE.MeshLambertMaterial({ color: 0x222230 });
const MAT_HELI_H    = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: new THREE.Color(0x444444) });

// ── Per-map visual themes ────────────────────────────────────────────────────
// Selected by map id (server picks the map). Each theme swaps building
// palettes, neon density, surface tints, and the day/night lighting palette.
const THEMES = {
  downtown: {
    palettes: [
      { colors: [0x0d2233, 0x1a3a4c, 0x0a1826], heightMult: 1.7, win: 'blue' },   // glass towers
      { colors: [0x6b2f1a, 0x7d3820, 0x5a2010], heightMult: 0.75, win: 'yellow' }, // brownstone
      { colors: [0x2a2a34, 0x363640, 0x222230], heightMult: 1.0, win: 'mixed' },   // concrete
      { colors: [0x1a0a2e, 0x251040, 0x120820], heightMult: 1.1, win: 'neon' },    // neon district
    ],
    neonScale: 1,
    ground: 0x0d0d14, road: 0x2b2b33, sidewalk: 0x45454f, grass: 0x1e4a24,
    dayNight: {
      day:   { sky: 0x1a2240, ambient: 0x6688bb, ambientIntensity: 1.2, sun: 0xffd5a0, sunIntensity: 1.4, fill: 0.5 },
      night: { sky: 0x05060f, ambient: 0x223355, ambientIntensity: 0.45, sun: 0x99aaff, sunIntensity: 0.3, fill: 0.15 },
    },
  },
  riverside: {
    palettes: [
      { colors: [0x3a4048, 0x2e3540, 0x46505a], heightMult: 0.7, win: 'mixed' },   // steel warehouses
      { colors: [0x7a3520, 0x8a4228, 0x63301c], heightMult: 0.85, win: 'yellow' }, // dockside brick
      { colors: [0x8a7a5a, 0x9a8a68, 0x77684c], heightMult: 0.6, win: 'yellow' },  // stucco rowhouses
      { colors: [0x1d3a4a, 0x255062, 0x16303e], heightMult: 1.35, win: 'blue' },   // harbor offices
    ],
    neonScale: 0.35,
    ground: 0x14100e, road: 0x33323a, sidewalk: 0x565058, grass: 0x3a4a1e,
    dayNight: {
      day:   { sky: 0x7a4636, ambient: 0xcc8866, ambientIntensity: 1.1, sun: 0xff9955, sunIntensity: 1.5, fill: 0.4 },
      night: { sky: 0x0a0812, ambient: 0x2a2244, ambientIntensity: 0.5, sun: 0x8899dd, sunIntensity: 0.3, fill: 0.15 },
    },
  },
  'grand-park': {
    palettes: [
      { colors: [0xcfc4a6, 0xbfb090, 0xd8cfb8], heightMult: 0.55, win: 'mixed' },  // cream townhouses
      { colors: [0xb06a4a, 0xc07a55, 0x9a5a3e], heightMult: 0.6, win: 'yellow' },  // terracotta
      { colors: [0x7a8a6a, 0x8a9a78, 0x6a7a5c], heightMult: 0.6, win: 'mixed' },   // sage
      { colors: [0x6a86a0, 0x7a96b2, 0x5a7690], heightMult: 0.95, win: 'blue' },   // powder-blue flats
    ],
    neonScale: 0.1,
    ground: 0x22301e, road: 0x3c3c42, sidewalk: 0x6a6a70, grass: 0x2a6a2c,
    dayNight: {
      day:   { sky: 0x7fa8d8, ambient: 0x9ab0d0, ambientIntensity: 1.5, sun: 0xfff0d0, sunIntensity: 1.7, fill: 0.6 },
      night: { sky: 0x0c1226, ambient: 0x2c3c5c, ambientIntensity: 0.55, sun: 0xaabbee, sunIntensity: 0.35, fill: 0.2 },
    },
  },
};

let ACTIVE_THEME = THEMES.downtown;

export function setCityTheme(mapId) {
  ACTIVE_THEME = THEMES[mapId] || THEMES.downtown;
  MAT_GROUND.color.setHex(ACTIVE_THEME.ground);
  MAT_ROAD.color.setHex(ACTIVE_THEME.road);
  MAT_SIDEWALK.color.setHex(ACTIVE_THEME.sidewalk);
  MAT_GRASS.color.setHex(ACTIVE_THEME.grass);
  MAT_FIELD.color.setHex(ACTIVE_THEME.grass).offsetHSL(0, 0.05, 0.03);
}

export function getCityTheme() {
  return ACTIVE_THEME;
}

const NEON_COLORS = [0xff1493, 0x00ffff, 0xff6600, 0x8800ff, 0xff0044, 0x00ff88, 0xff88ff];

// Pre-built window material sets [lit, dark]
const WIN_SETS = {
  blue:   [new THREE.MeshLambertMaterial({ color: 0x4488dd, emissive: new THREE.Color(0x112244) }),
           new THREE.MeshLambertMaterial({ color: 0x112233 })],
  yellow: [new THREE.MeshLambertMaterial({ color: 0xffdd44, emissive: new THREE.Color(0x886600) }),
           new THREE.MeshLambertMaterial({ color: 0x2a1a00 })],
  mixed:  [new THREE.MeshLambertMaterial({ color: 0xffcc88, emissive: new THREE.Color(0x442200) }),
           new THREE.MeshLambertMaterial({ color: 0x111118 })],
};
const NEON_WIN_SETS = NEON_COLORS.map(c => {
  const nc = new THREE.Color(c);
  return [
    new THREE.MeshLambertMaterial({ color: nc, emissive: nc.clone().multiplyScalar(0.5) }),
    new THREE.MeshLambertMaterial({ color: 0x110022 }),
  ];
});

// Shared geometries
const GEO_WIN       = new THREE.PlaneGeometry(0.55, 0.55);
const GEO_AC        = new THREE.BoxGeometry(0.9, 0.45, 0.65);
const GEO_HYDRANT   = new THREE.CylinderGeometry(0.18, 0.22, 0.65, 8);
const GEO_HYDRANT_C = new THREE.CylinderGeometry(0.12, 0.18, 0.18, 8);
const GEO_MANHOLE   = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12);
const GEO_MH_H      = new THREE.BoxGeometry(0.9, 0.06, 0.1);
const GEO_MH_V      = new THREE.BoxGeometry(0.1, 0.06, 0.9);

// ── Main export ─────────────────────────────────────────────────────────────
export function buildCity(scene) {
  const group = new THREE.Group();
  const boxes = [];

  const rows = CITY_GRID.length;
  const cols = CITY_GRID[0].length;
  const totalW = cols * CELL;
  const totalD = rows * CELL;
  const offsetX = -totalW / 2 + CELL / 2;
  const offsetZ = -totalD / 2 + CELL / 2;

  // Ground plane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 20, totalD + 20), MAT_GROUND);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = offsetX + col * CELL;
      const wz = offsetZ + row * CELL;
      const cell = CITY_GRID[row][col];

      if (cell === 0) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), MAT_ROAD);
        road.rotation.x = -Math.PI / 2;
        road.position.set(wx, 0.01, wz);
        road.receiveShadow = true;
        group.add(road);
        addRoadMarkings(group, wx, wz, row, col, CITY_GRID);
      } else if (cell === 1) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), MAT_SIDEWALK);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(wx, 0.02, wz);
        sw.receiveShadow = true;
        group.add(sw);
        // Per-building collision boxes: gaps between buildings are walkable alleys
        boxes.push(...addBuildingCluster(group, wx, wz, CELL));
        addSidewalkProps(group, wx, wz, CELL);
      } else if (cell === 2) {
        addPark(group, wx, wz, CELL);
      } else if (cell === 3) {
        addStadium(group, wx, wz, CELL);
      } else if (cell === 4) {
        addConstructionSite(group, wx, wz, CELL);
      } else if (cell === 5) {
        addPlaza(group, wx, wz, CELL);
      } else if (cell === 6) {
        addWater(group, wx, wz, row, col, CITY_GRID);
        boxes.push({ minX: wx - CELL / 2, maxX: wx + CELL / 2, minZ: wz - CELL / 2, maxZ: wz + CELL / 2 });
      }
    }
  }

  addBoundaryWalls(group, totalW, totalD);
  addStreetLights(group, rows, cols, CITY_GRID, offsetX, offsetZ, CELL);

  scene.add(group);
  return boxes;
}

// ── Road markings ─────────────────────────────────────────────────────────────
function addRoadMarkings(group, wx, wz, row, col, grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const hasN = row > 0       && grid[row - 1][col] === 0;
  const hasS = row < rows-1  && grid[row + 1][col] === 0;
  const hasE = col < cols-1  && grid[row][col + 1] === 0;
  const hasW = col > 0       && grid[row][col - 1] === 0;

  const isVert  = (hasN || hasS) && !(hasE || hasW);
  const isHoriz = (hasE || hasW) && !(hasN || hasS);
  const isInter = (hasN || hasS) &&  (hasE || hasW);

  // Yellow center line dashes
  if (isVert || isInter) {
    for (let i = -1; i <= 1; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), MAT_MARK_Y);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(wx, 0.03, wz + i * (CELL / 3));
      group.add(dash);
    }
  }
  if (isHoriz || isInter) {
    for (let i = -1; i <= 1; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.22), MAT_MARK_Y);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(wx + i * (CELL / 3), 0.03, wz);
      group.add(dash);
    }
  }

  // White lane edge dashes on straight segments
  if (isVert) {
    for (const xOff of [-3.5, 3.5]) {
      for (let i = -1; i <= 1; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.8), MAT_MARK_W);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(wx + xOff, 0.03, wz + i * (CELL / 3));
        group.add(dash);
      }
    }
  }
  if (isHoriz) {
    for (const zOff of [-3.5, 3.5]) {
      for (let i = -1; i <= 1; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.14), MAT_MARK_W);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(wx + i * (CELL / 3), 0.03, wz + zOff);
        group.add(dash);
      }
    }
  }

  // Crosswalks at intersections
  if (isInter) {
    if (hasN) addCrosswalk(group, wx, wz - 7, 'vert');
    if (hasS) addCrosswalk(group, wx, wz + 7, 'vert');
    if (hasW) addCrosswalk(group, wx - 7, wz, 'horiz');
    if (hasE) addCrosswalk(group, wx + 7, wz, 'horiz');
  }
}

function addCrosswalk(group, cx, cz, dir) {
  const n = 5, sw = 0.7, sl = CELL - 2, gap = 1.1;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap;
    const geo = dir === 'vert'
      ? new THREE.PlaneGeometry(sl, sw)
      : new THREE.PlaneGeometry(sw, sl);
    const m = new THREE.Mesh(geo, MAT_MARK_W);
    m.rotation.x = -Math.PI / 2;
    m.position.set(
      dir === 'vert' ? cx : cx + off,
      0.05,
      dir === 'vert' ? cz + off : cz
    );
    group.add(m);
  }
}

function addManhole(group, wx, wz) {
  const ox = (seededRand(wx + 1, wz) - 0.5) * 8;
  const oz = (seededRand(wx, wz + 1) - 0.5) * 8;
  const mh = new THREE.Mesh(GEO_MANHOLE, MAT_MANHOLE);
  mh.rotation.x = -Math.PI / 2;
  mh.position.set(wx + ox, 0.03, wz + oz);
  group.add(mh);
  const h = new THREE.Mesh(GEO_MH_H, MAT_MANHOLE);
  h.position.set(wx + ox, 0.06, wz + oz);
  group.add(h);
  const v = new THREE.Mesh(GEO_MH_V, MAT_MANHOLE);
  v.position.set(wx + ox, 0.06, wz + oz);
  group.add(v);
}

// ── Buildings ────────────────────────────────────────────────────────────────
function addBuildingCluster(group, cx, cz, cellSize) {
  const styleIdx = Math.floor(seededRand(cx * 13.7, cz * 7.3) * 4);
  const palette  = ACTIVE_THEME.palettes[styleIdx];
  const margin   = 1.5;
  const halfCell = cellSize / 2 - margin;
  const n        = 1 + Math.floor(seededRand(cx, cz) * 3);
  const positions = getBuildingPositions(n, halfCell);
  const boxes = [];

  for (let i = 0; i < positions.length; i++) {
    const [bx, bz, bw, bd] = positions[i];
    const rawH  = 4 + seededRand(cx + bx, cz + bz) * 14;
    const height = rawH * palette.heightMult;
    const colorHex = palette.colors[Math.floor(seededRand(bx * 3, bz * 7) * palette.colors.length)];
    const mat = new THREE.MeshLambertMaterial({ color: colorHex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, height, bd), mat);
    mesh.position.set(cx + bx, height / 2, cz + bz);
    mesh.castShadow  = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    boxes.push({
      minX: cx + bx - bw / 2, maxX: cx + bx + bw / 2,
      minZ: cz + bz - bd / 2, maxZ: cz + bz + bd / 2,
    });

    addWindows(group, cx + bx, height, cz + bz, bw, bd, styleIdx, palette.win);
    addParapet(group, cx + bx, height, cz + bz, bw, bd);

    if (height > 13) {
      const sw = bw * 0.65, sd = bd * 0.65;
      const sh = height * 0.45;
      const sc = new THREE.Color(colorHex).offsetHSL(0, 0, 0.08);
      const setback = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), new THREE.MeshLambertMaterial({ color: sc }));
      setback.position.set(cx + bx, height + sh / 2, cz + bz);
      setback.castShadow = true;
      group.add(setback);
      addWindows(group, cx + bx, height + sh, cz + bz, sw, sd, styleIdx, palette.win);
      addParapet(group, cx + bx, height + sh, cz + bz, sw, sd);
      addRooftopDetails(group, cx + bx, height + sh, cz + bz, sw, sd, styleIdx);
    } else if (height > 9) {
      addRooftopDetails(group, cx + bx, height, cz + bz, bw, bd, styleIdx);
    }

    const neonChance = (styleIdx === 3 ? 0.65 : 0.12) * ACTIVE_THEME.neonScale;
    if (seededRand(cx + bx * 2.3, cz + bz * 1.7) < neonChance) {
      addNeonSign(group, cx + bx, height, cz + bz, bw, bd);
    }
  }
  return boxes;
}

function addWindows(group, bx, bh, bz, bw, bd, styleIdx, winStyle) {
  const floors = Math.min(Math.floor(bh / 2.5), 6);
  const perW   = Math.min(Math.max(1, Math.floor(bw / 2.2)), 3);
  const perD   = Math.min(Math.max(1, Math.floor(bd / 2.2)), 3);

  let litMat, darkMat;
  if (winStyle === 'neon') {
    const ni = Math.floor(seededRand(bx * 3, bz * 5) * NEON_WIN_SETS.length);
    [litMat, darkMat] = NEON_WIN_SETS[ni];
  } else {
    [litMat, darkMat] = WIN_SETS[winStyle] || WIN_SETS.mixed;
  }

  const litBasic  = new THREE.MeshBasicMaterial({ color: litMat.color });
  const darkBasic = new THREE.MeshBasicMaterial({ color: darkMat.color });

  // Front & back faces (along Z)
  for (let sign = -1; sign <= 1; sign += 2) {
    const zOff = sign * (bd / 2 + 0.01);
    const rotY = sign < 0 ? Math.PI : 0;
    for (let f = 0; f < floors; f++) {
      const y = 1.5 + f * 2.5;
      for (let i = 0; i < perW; i++) {
        const frac  = (i + 0.5) / perW;
        const x     = -bw / 2 + frac * bw;
        const isLit = seededRand(bx + x * 10 + f * 0.3 + sign, bz + i * 0.7) > 0.28;
        const wf    = new THREE.Mesh(GEO_WIN, isLit ? litBasic : darkBasic);
        wf.rotation.y = rotY;
        wf.position.set(bx + x, y, bz + zOff);
        group.add(wf);
      }
    }
  }

  // Left & right faces (along X)
  for (let sign = -1; sign <= 1; sign += 2) {
    const xOff = sign * (bw / 2 + 0.01);
    const rotY = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let f = 0; f < floors; f++) {
      const y = 1.5 + f * 2.5;
      for (let i = 0; i < perD; i++) {
        const frac  = (i + 0.5) / perD;
        const z     = -bd / 2 + frac * bd;
        const isLit = seededRand(bz + z * 10 + f * 0.3 + sign * 2, bx + i * 0.7) > 0.28;
        const wf    = new THREE.Mesh(GEO_WIN, isLit ? litBasic : darkBasic);
        wf.rotation.y = rotY;
        wf.position.set(bx + xOff, y, bz + z);
        group.add(wf);
      }
    }
  }
}

function addRooftopDetails(group, bx, bh, bz, bw, bd, styleIdx) {
  const r1 = seededRand(bx * 2,   bz * 3);
  const r2 = seededRand(bx * 5,   bz * 2);
  const r3 = seededRand(bx * 7,   bz * 4);
  const r4 = seededRand(bx * 11,  bz * 9);

  // Water tower (tall buildings, ~50% chance)
  if (bh > 10 && r1 > 0.45) {
    const txOff = (r2 - 0.5) * bw * 0.45;
    const tzOff = (r3 - 0.5) * bd * 0.45;
    const topY  = bh + 1.5;

    // Support legs
    for (let i = 0; i < 4; i++) {
      const ang  = (i / 4) * Math.PI * 2;
      const leg  = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), MAT_METAL);
      leg.position.set(bx + txOff + Math.cos(ang) * 0.8, bh + 0.3, bz + tzOff + Math.sin(ang) * 0.8);
      group.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 9), MAT_WOOD);
    tank.position.set(bx + txOff, topY, bz + tzOff);
    tank.castShadow = true;
    group.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.1, 9), MAT_WOOD);
    cap.position.set(bx + txOff, topY + 1.65, bz + tzOff);
    group.add(cap);
  }

  // Antenna / radio mast
  if (bh > 8 && r2 > 0.35) {
    const ax = bx + (r4 - 0.5) * bw * 0.4;
    const az = bz + (r1 - 0.5) * bd * 0.4;
    const mh = 3.5 + r1 * 3;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, mh, 4), MAT_METAL);
    mast.position.set(ax, bh + mh / 2, az);
    group.add(mast);
    if (bh > 12) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 4), MAT_METAL);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(ax, bh + mh * 0.6, az);
      group.add(arm);
    }
  }

  // AC units (1–3)
  const numAC = 1 + Math.floor(r3 * 2.5);
  for (let i = 0; i < numAC; i++) {
    const acX = (seededRand(bx + i * 1.7, bz * 2) - 0.5) * Math.max(bw - 2, 0.5);
    const acZ = (seededRand(bx * 2, bz + i * 1.3) - 0.5) * Math.max(bd - 2, 0.5);
    const ac  = new THREE.Mesh(GEO_AC, MAT_GREY_ROOF);
    ac.position.set(bx + acX, bh + 0.22, bz + acZ);
    group.add(ac);
  }

  // Helipad (very tall glass towers)
  if (styleIdx === 0 && bh > 18 && r4 > 0.65) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 16), MAT_HELIPAD);
    pad.position.set(bx, bh + 0.06, bz);
    group.add(pad);
    const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.9), MAT_HELI_H);
    h1.rotation.x = -Math.PI / 2;
    h1.position.set(bx - 0.55, bh + 0.22, bz);
    group.add(h1);
    const h2 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.9), MAT_HELI_H);
    h2.rotation.x = -Math.PI / 2;
    h2.position.set(bx + 0.55, bh + 0.22, bz);
    group.add(h2);
    const h3 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.28), MAT_HELI_H);
    h3.rotation.x = -Math.PI / 2;
    h3.position.set(bx, bh + 0.22, bz);
    group.add(h3);
  }
}

function addNeonSign(group, bx, bh, bz, bw, bd) {
  const ci = Math.floor(seededRand(bx * 11, bz * 13) * NEON_COLORS.length);
  const c  = new THREE.Color(NEON_COLORS[ci]);
  // Use MeshBasicMaterial — no lighting calc needed, sign always glows
  const signMat = new THREE.MeshBasicMaterial({
    color: c.clone().multiplyScalar(1.0),
    side: THREE.DoubleSide,
  });

  const sw = 1.4 + seededRand(bx * 3, bz) * 1.4;
  const sh = 0.8 + seededRand(bx, bz * 2) * 0.7;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), signMat);
  const signY = bh * 0.35 + seededRand(bx + 1, bz + 1) * bh * 0.3;
  const side  = seededRand(bx * 2, bz * 5) > 0.5;

  if (side) {
    sign.position.set(bx + (seededRand(bx * 4, bz) - 0.5) * bw * 0.4, signY, bz + bd / 2 + 0.18);
  } else {
    sign.rotation.y = Math.PI / 2;
    sign.position.set(bx + bw / 2 + 0.18, signY, bz + (seededRand(bx, bz * 4) - 0.5) * bd * 0.4);
  }
  group.add(sign);
  // No PointLight — emissive material handles the glow at zero GPU cost
}

function addParapet(group, bx, bh, bz, bw, bd) {
  const ph = 0.45, pt = 0.22, cy = bh + ph / 2;
  for (const zOff of [bd / 2 - pt / 2, -(bd / 2 - pt / 2)]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(bw, ph, pt), MAT_GREY_ROOF);
    p.position.set(bx, cy, bz + zOff);
    group.add(p);
  }
  for (const xOff of [bw / 2 - pt / 2, -(bw / 2 - pt / 2)]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(pt, ph, bd), MAT_GREY_ROOF);
    p.position.set(bx + xOff, cy, bz);
    group.add(p);
  }
}

// ── Sidewalk props ───────────────────────────────────────────────────────────
function addSidewalkProps(group, cx, cz, cellSize) {
  const r1 = seededRand(cx * 3.1, cz * 7.3);
  const r2 = seededRand(cx * 7.7, cz * 3.5);
  const r3 = seededRand(cx * 5.3, cz * 11.1);

  // Fire hydrant
  if (r1 > 0.45) {
    const ex = cx + (r2 > 0.5 ? 1 : -1) * (cellSize / 2 - 1.2);
    const ez = cz + (r3 - 0.5) * (cellSize - 4);
    const hy = new THREE.Mesh(GEO_HYDRANT, MAT_HYDRANT);
    hy.position.set(ex, 0.33, ez);
    hy.castShadow = true;
    group.add(hy);
    const hc = new THREE.Mesh(GEO_HYDRANT_C, MAT_HYDRANT);
    hc.position.set(ex, 0.75, ez);
    group.add(hc);
  }

  // Dumpster
  if (r2 > 0.42) {
    const cx2 = cx + (r3 > 0.5 ? 1 : -1) * (cellSize / 2 - 1.8);
    const cz2 = cz + (r1 > 0.5 ? 1 : -1) * (cellSize / 2 - 1.8);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.8), MAT_DUMPSTER);
    body.position.set(cx2, 0.45, cz2);
    body.castShadow = true;
    group.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.5), MAT_DUMP_LID);
    lid.position.set(cx2, 0.93, cz2 - 0.15);
    lid.rotation.x = -0.35;
    group.add(lid);
  }
}

// ── Parks ─────────────────────────────────────────────────────────────────────
function addPark(group, cx, cz, cellSize) {
  const half = cellSize / 2 - 1;

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(cellSize - 2, cellSize - 2), MAT_GRASS);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.03, cz);
  group.add(grass);

  // Crossing paths
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, cellSize - 2), MAT_PARK_PATH);
  p1.rotation.x = -Math.PI / 2;
  p1.position.set(cx, 0.04, cz);
  group.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(cellSize - 2, 1.1), MAT_PARK_PATH);
  p2.rotation.x = -Math.PI / 2;
  p2.position.set(cx, 0.04, cz);
  group.add(p2);

  // Fountain
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.38, 12), MAT_FOUNTAIN);
  base.position.set(cx, 0.19, cz);
  group.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.1, 12), MAT_F_WATER);
  water.position.set(cx, 0.43, cz);
  group.add(water);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.2, 6), MAT_FOUNTAIN);
  post.position.set(cx, 1.0, cz);
  group.add(post);

  // (no PointLight here — too many parks would tank perf)

  // Trees (4 corners, 2-layer canopy)
  const treePlaces = [
    [-half * 0.52, -half * 0.52, 0.85],
    [ half * 0.52, -half * 0.52, 1.0 ],
    [-half * 0.52,  half * 0.52, 0.9 ],
    [ half * 0.52,  half * 0.52, 1.05],
  ];
  for (const [tx, tz, sc] of treePlaces) {
    const th = 1.8 * sc;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * sc, 0.24 * sc, th, 7), MAT_TREE_T);
    trunk.position.set(cx + tx, th / 2, cz + tz);
    trunk.castShadow = true;
    group.add(trunk);
    const tMat = seededRand(cx + tx, cz + tz) > 0.5 ? MAT_TREE_C1 : MAT_TREE_C2;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.35 * sc, 2.4 * sc, 8), tMat);
    c1.position.set(cx + tx, th + 1.3 * sc, cz + tz);
    c1.castShadow = true;
    group.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * sc, 1.7 * sc, 8), tMat);
    c2.position.set(cx + tx, th + 2.8 * sc, cz + tz);
    c2.castShadow = true;
    group.add(c2);
  }

  // Benches (4 sides)
  const benchDirs = [
    [half * 0.65, 0, 0],
    [-half * 0.65, 0, Math.PI],
    [0, half * 0.65, Math.PI / 2],
    [0, -half * 0.65, -Math.PI / 2],
  ];
  for (const [bx, bz, ry] of benchDirs) {
    addBench(group, cx + bx, cz + bz, ry);
  }
}

function addBench(group, bx, bz, rotY) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.4), MAT_BENCH);
  seat.position.set(0, 0.45, 0);
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.07), MAT_BENCH);
  back.position.set(0, 0.7, 0.17);
  g.add(back);
  for (const sx of [-0.58, 0.58]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), MAT_BENCH_LEG);
    leg.position.set(sx, 0.2, 0);
    g.add(leg);
  }
  g.position.set(bx, 0, bz);
  g.rotation.y = rotY;
  group.add(g);
}

// ── Landmark: Stadium ────────────────────────────────────────────────────────
function addStadium(group, cx, cz, cellSize) {
  // Grass field
  const field = new THREE.Mesh(new THREE.CircleGeometry(cellSize / 2 - 1.5, 24), MAT_FIELD);
  field.rotation.x = -Math.PI / 2;
  field.position.set(cx, 0.03, cz);
  field.receiveShadow = true;
  group.add(field);

  // Center circle + halfway line
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 24), MAT_MARK_W);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.05, cz);
  group.add(ring);
  const midline = new THREE.Mesh(new THREE.PlaneGeometry(0.3, cellSize - 5), MAT_MARK_W);
  midline.rotation.x = -Math.PI / 2;
  midline.position.set(cx, 0.05, cz);
  group.add(midline);

  // Tiered bleacher rings, open on the south side (entrance gap)
  const gap = Math.PI * 0.35;
  const thetaStart = Math.PI / 2 + gap / 2;
  const thetaLen = Math.PI * 2 - gap;
  const tiers = [
    { r: cellSize / 2 - 1.2, h: 4.2 },
    { r: cellSize / 2 - 2.4, h: 2.8 },
    { r: cellSize / 2 - 3.6, h: 1.5 },
  ];
  for (const { r, h } of tiers) {
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 28, 1, true, thetaStart, thetaLen),
      MAT_BLEACHER
    );
    wall.position.set(cx, h / 2, cz);
    wall.castShadow = true;
    group.add(wall);
    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.3, 28, 1, true, thetaStart, thetaLen),
      MAT_BLEACH_TOP
    );
    trim.position.set(cx, h + 0.15, cz);
    group.add(trim);
  }

  // Floodlight towers at 4 diagonals
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = cx + sx * (cellSize / 2 - 1.5);
    const pz = cz + sz * (cellSize / 2 - 1.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 11, 6), MAT_POLE);
    pole.position.set(px, 5.5, pz);
    group.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.25), MAT_FLOOD);
    panel.position.set(px, 11.2, pz);
    panel.lookAt(cx, 2, cz);
    group.add(panel);
  }
}

// ── Landmark: Construction site ──────────────────────────────────────────────
function addConstructionSite(group, cx, cz, cellSize) {
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(cellSize - 2, cellSize - 2), MAT_DIRT);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(cx, 0.03, cz);
  dirt.receiveShadow = true;
  group.add(dirt);

  // Half-built steel frame (2 floors of columns + beams) in one corner
  const fx = cx - 3.5, fz = cz - 3.5;
  const W = 8, D = 8;
  for (const [ox, oz] of [[-W/2, -D/2], [W/2, -D/2], [-W/2, D/2], [W/2, D/2], [0, -D/2], [0, D/2]]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, 8, 0.35), MAT_STEEL);
    col.position.set(fx + ox, 4, fz + oz);
    col.castShadow = true;
    group.add(col);
  }
  for (const y of [4, 8]) {
    for (const oz of [-D/2, D/2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.35, 0.3, 0.3), MAT_STEEL);
      beam.position.set(fx, y, fz + oz);
      group.add(beam);
    }
    for (const ox of [-W/2, 0, W/2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, D), MAT_STEEL);
      beam.position.set(fx + ox, y, fz);
      group.add(beam);
    }
  }
  // Poured slab on level 1
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.25, D / 2), MAT_GREY_ROOF);
  slab.position.set(fx, 4.1, fz - D / 4);
  group.add(slab);

  // Tower crane
  const kx = cx + 5, kz = cz + 4;
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.7, 16, 0.7), MAT_CRANE);
  mast.position.set(kx, 8, kz);
  mast.castShadow = true;
  group.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(13, 0.45, 0.45), MAT_CRANE);
  jib.position.set(kx - 4, 15.6, kz);
  jib.castShadow = true;
  group.add(jib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), MAT_METAL);
  counter.position.set(kx + 3, 15.4, kz);
  group.add(counter);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7, 4), MAT_METAL);
  cable.position.set(kx - 8, 12, kz);
  group.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), MAT_STEEL);
  hook.position.set(kx - 8, 8.2, kz);
  group.add(hook);

  // Sand pile + cones + barriers
  const sand = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 10), MAT_DIRT);
  sand.position.set(cx + 4, 0.8, cz - 5);
  sand.castShadow = true;
  group.add(sand);
  for (const [ox, oz] of [[-6, 5], [-3.5, 6.5], [-1, 5.5], [2, 7]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 8), MAT_CONE);
    cone.position.set(cx + ox, 0.4, cz + oz);
    group.add(cone);
  }
  for (const [ox, oz, ry] of [[-7, 0, Math.PI / 2], [7, -2, Math.PI / 2], [0, -8, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.12), MAT_BARRIER);
    bar.position.set(cx + ox, 0.7, cz + oz);
    bar.rotation.y = ry;
    group.add(bar);
    for (const lx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), MAT_METAL);
      leg.position.set(cx + ox + (ry ? 0 : lx), 0.35, cz + oz + (ry ? lx : 0));
      group.add(leg);
    }
  }
}

// ── Landmark: Monument plaza ─────────────────────────────────────────────────
function addPlaza(group, cx, cz, cellSize) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(cellSize - 2, cellSize - 2), MAT_PLAZA);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.03, cz);
  floor.receiveShadow = true;
  group.add(floor);

  // Concentric decorative rings
  for (const r of [3.2, 6.4]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.35, 32), MAT_MARK_W);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.045, cz);
    group.add(ring);
  }

  // Central obelisk on a stepped base
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 3.4), MAT_MONUMENT);
  base1.position.set(cx, 0.25, cz);
  group.add(base1);
  const base2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), MAT_MONUMENT);
  base2.position.set(cx, 0.75, cz);
  group.add(base2);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 9, 4), MAT_MONUMENT);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.set(cx, 5.5, cz);
  shaft.castShadow = true;
  group.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.2, 4), MAT_GOLD);
  tip.rotation.y = Math.PI / 4;
  tip.position.set(cx, 10.6, cz);
  group.add(tip);

  // Planters at the four corners + benches facing the monument
  const half = cellSize / 2 - 2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.6), MAT_MONUMENT);
    pot.position.set(cx + sx * half, 0.35, cz + sz * half);
    group.add(pot);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), MAT_TREE_C1);
    bush.position.set(cx + sx * half, 1.1, cz + sz * half);
    group.add(bush);
  }
  addBench(group, cx - 5.5, cz, Math.PI / 2 * 3);
  addBench(group, cx + 5.5, cz, Math.PI / 2);

  // Two flag poles
  for (const ox of [-2.8, 2.8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), MAT_POLE);
    pole.position.set(cx + ox, 3.5, cz - 5.5);
    group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9),
      new THREE.MeshLambertMaterial({ color: ox < 0 ? 0xcf3434 : 0x2f6fcf, side: THREE.DoubleSide }));
    flag.position.set(cx + ox + 0.85, 6.4, cz - 5.5);
    group.add(flag);
  }
}

// ── Water (canal cells) ──────────────────────────────────────────────────────
function addWater(group, cx, cz, row, col, grid) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), MAT_WATER);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, -0.15, cz);
  group.add(water);

  // Embankment walls along edges that border non-water cells
  const rows = grid.length, cols = grid[0].length;
  const edges = [
    [row - 1, col, cx, cz - CELL / 2, CELL, 0],   // north
    [row + 1, col, cx, cz + CELL / 2, CELL, 0],   // south
    [row, col - 1, cx - CELL / 2, cz, 0.5, CELL], // west
    [row, col + 1, cx + CELL / 2, cz, 0.5, CELL], // east
  ];
  for (const [r, c, ex, ez, w, d] of edges) {
    const neighbor = (r >= 0 && r < rows && c >= 0 && c < cols) ? grid[r][c] : 6;
    if (neighbor === 6) continue;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w || 0.5, 0.9, d || 0.5), MAT_EMBANK);
    wall.position.set(ex, 0.45, ez);
    group.add(wall);
  }
}

// ── Building layout helpers ──────────────────────────────────────────────────
function getBuildingPositions(n, half) {
  if (n === 1) return [[0, 0, half * 1.6, half * 1.6]];
  if (n === 2) return [
    [-half * 0.4, 0, half * 0.9, half * 1.6],
    [ half * 0.5, 0, half * 0.7, half * 1.4],
  ];
  if (n === 3) return [
    [-half * 0.5, -half * 0.4, half * 0.8, half * 0.9],
    [ half * 0.5, -half * 0.3, half * 0.8, half * 1.0],
    [0,            half * 0.5,  half * 1.4, half * 0.7],
  ];
  return [
    [-half * 0.5, -half * 0.45, half * 0.8, half * 0.8],
    [ half * 0.5, -half * 0.45, half * 0.7, half * 0.8],
    [-half * 0.5,  half * 0.45, half * 0.8, half * 0.8],
    [ half * 0.5,  half * 0.45, half * 0.7, half * 0.8],
  ];
}

// ── Boundary walls ───────────────────────────────────────────────────────────
function addBoundaryWalls(group, totalW, totalD) {
  const h = 12, t = 2;
  const walls = [
    [totalW + t, h, t, 0, h / 2, -totalD / 2],
    [totalW + t, h, t, 0, h / 2,  totalD / 2],
    [t, h, totalD, -totalW / 2, h / 2, 0],
    [t, h, totalD,  totalW / 2, h / 2, 0],
  ];
  for (const [w, hy, d, x, y, z] of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hy, d), MAT_WALL);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
}

// ── Street lights (amber sodium-vapor style) ─────────────────────────────────
function addStreetLights(group, rows, cols, grid, offsetX, offsetZ, cellSize) {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== 0) continue;
      if ((row + col) % 6 !== 0) continue;

      const wx = offsetX + col * cellSize;
      const wz = offsetZ + row * cellSize;

      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6), MAT_POLE);
      pole.position.set(wx + 3.5, 3.75, wz + 3.5);
      group.add(pole);
      // Horizontal arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), MAT_POLE);
      arm.position.set(wx + 3.5 - 0.9, 7.6, wz + 3.5);
      group.add(arm);
      // Lamp head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 0.44), MAT_LAMPHEAD);
      head.position.set(wx + 3.5 - 1.8, 7.5, wz + 3.5);
      group.add(head);
      // Amber point light
      const light = new THREE.PointLight(0xffaa44, 1.1, 30);
      light.position.set(wx + 3.5 - 1.8, 7.2, wz + 3.5);
      group.add(light);
    }
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────
function seededRand(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export { CELL, CITY_GRID };
