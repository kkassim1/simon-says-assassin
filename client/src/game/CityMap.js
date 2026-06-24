import * as THREE from 'three';

// 16×16 grid layout: 0=road, 1=building block, 2=park
const CITY_GRID = [
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 0
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 1
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [1, 2, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 0, 1], // 3
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 4
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 5
  [1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 2, 1, 0, 1], // 6
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 7
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 8
  [1, 1, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 1], // 9
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 10
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 11
  [1, 1, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 1], // 12
  [2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 2], // 13
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 14
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], // 15
];

const CELL = 20;

// ── Shared materials (created once) ─────────────────────────────────────────
const MAT_GROUND    = new THREE.MeshLambertMaterial({ color: 0x0d0d14 });
const MAT_ROAD      = new THREE.MeshLambertMaterial({ color: 0x191920 });
const MAT_SIDEWALK  = new THREE.MeshLambertMaterial({ color: 0x36363f });
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
const MAT_GRASS     = new THREE.MeshLambertMaterial({ color: 0x1a4020 });
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

// Building style palettes
const STYLE_PALETTES = [
  // 0: Glass tower – dark teal, tall, blue windows
  { colors: [0x0d2233, 0x1a3a4c, 0x0a1826], heightMult: 1.7, win: 'blue' },
  // 1: Brick brownstone – warm reds, medium, yellow windows
  { colors: [0x6b2f1a, 0x7d3820, 0x5a2010], heightMult: 0.75, win: 'yellow' },
  // 2: Concrete block – greys, mixed
  { colors: [0x2a2a34, 0x363640, 0x222230], heightMult: 1.0, win: 'mixed' },
  // 3: Neon district – deep purple, neon windows + signs
  { colors: [0x1a0a2e, 0x251040, 0x120820], heightMult: 1.1, win: 'neon' },
];

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
        addBuildingCluster(group, wx, wz, CELL);
        addSidewalkProps(group, wx, wz, CELL);
        boxes.push({ minX: wx - CELL / 2, maxX: wx + CELL / 2, minZ: wz - CELL / 2, maxZ: wz + CELL / 2 });
      } else if (cell === 2) {
        addPark(group, wx, wz, CELL);
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

}

function addCrosswalk(group, cx, cz, dir) {
  const n = 5;
  const sw = 0.75, sl = 3.0, gap = 1.0;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap;
    const geo = dir === 'vert'
      ? new THREE.PlaneGeometry(sl, sw)
      : new THREE.PlaneGeometry(sw, sl);
    const m = new THREE.Mesh(geo, MAT_MARK_W);
    m.rotation.x = -Math.PI / 2;
    m.position.set(
      dir === 'vert' ? cx : cx + off,
      0.04,
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
  const palette  = STYLE_PALETTES[styleIdx];
  const margin   = 1.5;
  const halfCell = cellSize / 2 - margin;
  const n        = 1 + Math.floor(seededRand(cx, cz) * 3);
  const positions = getBuildingPositions(n, halfCell);

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

    addWindows(group, cx + bx, height, cz + bz, bw, bd, styleIdx, palette.win);
    if (height > 9) addRooftopDetails(group, cx + bx, height, cz + bz, bw, bd, styleIdx);

    const neonChance = styleIdx === 3 ? 0.65 : 0.12;
    if (seededRand(cx + bx * 2.3, cz + bz * 1.7) < neonChance) {
      addNeonSign(group, cx + bx, height, cz + bz, bw, bd);
    }
  }
}

function addWindows(group, bx, bh, bz, bw, bd, styleIdx, winStyle) {
  const floors = Math.min(Math.floor(bh / 2.5), 5);   // max 5 floors
  const perRow = Math.min(Math.max(1, Math.floor(bw / 2.5)), 3); // max 3 per row

  let litMat, darkMat;
  if (winStyle === 'neon') {
    const ni = Math.floor(seededRand(bx * 3, bz * 5) * NEON_WIN_SETS.length);
    [litMat, darkMat] = NEON_WIN_SETS[ni];
  } else {
    [litMat, darkMat] = WIN_SETS[winStyle] || WIN_SETS.mixed;
  }

  // Front face only to halve draw calls; MeshBasicMaterial on windows = no lighting calc
  const litBasic  = new THREE.MeshBasicMaterial({ color: litMat.color });
  const darkBasic = new THREE.MeshBasicMaterial({ color: darkMat.color });

  for (let f = 0; f < floors; f++) {
    const y = 1.5 + f * 2.5;
    for (let i = 0; i < perRow; i++) {
      const frac  = (i + 0.5) / perRow;
      const x     = -bw / 2 + frac * bw;
      const isLit = seededRand(bx + x * 10 + f * 0.3, bz + i * 0.7) > 0.28;
      const mat   = isLit ? litBasic : darkBasic;

      const wf = new THREE.Mesh(GEO_WIN, mat);
      wf.position.set(bx + x, y, bz + bd / 2 + 0.01);
      group.add(wf);
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
