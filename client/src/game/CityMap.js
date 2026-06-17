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

export function buildCity(scene) {
  const group = new THREE.Group();
  const boxes = [];   // AABB collision boxes for all building cells

  const rows = CITY_GRID.length;
  const cols = CITY_GRID[0].length;
  const totalW = cols * CELL;
  const totalD = rows * CELL;
  const offsetX = -totalW / 2 + CELL / 2;
  const offsetZ = -totalD / 2 + CELL / 2;

  // Ground
  const groundGeo = new THREE.PlaneGeometry(totalW + 20, totalD + 20);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2c2c3e });
  const markMat = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x5d5d5d });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = offsetX + col * CELL;
      const wz = offsetZ + row * CELL;
      const cell = CITY_GRID[row][col];

      if (cell === 0) {
        const roadGeo = new THREE.PlaneGeometry(CELL, CELL);
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(wx, 0.01, wz);
        road.receiveShadow = true;
        group.add(road);
        addDashLines(group, wx, wz, row, col, CITY_GRID, CELL, markMat);
      } else if (cell === 1) {
        addBuildingCluster(group, wx, wz, CELL);
        boxes.push({ minX: wx - CELL / 2, maxX: wx + CELL / 2, minZ: wz - CELL / 2, maxZ: wz + CELL / 2 });
        const swGeo = new THREE.PlaneGeometry(CELL, CELL);
        const sw = new THREE.Mesh(swGeo, sidewalkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(wx, 0.02, wz);
        sw.receiveShadow = true;
        group.add(sw);
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

function addBuildingCluster(group, cx, cz, cellSize) {
  const buildingMats = [
    new THREE.MeshLambertMaterial({ color: 0x2f3e5c }),
    new THREE.MeshLambertMaterial({ color: 0x1e3a4c }),
    new THREE.MeshLambertMaterial({ color: 0x3d2b4c }),
    new THREE.MeshLambertMaterial({ color: 0x2c2c44 }),
  ];
  const windowMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x886600 });

  const margin = 1.5;
  const halfCell = cellSize / 2 - margin;
  const numBuildings = 1 + Math.floor(seededRand(cx, cz) * 3);
  const positions = getBuildingPositions(numBuildings, halfCell);

  for (const [bx, bz, bw, bd] of positions) {
    const height = 4 + seededRand(cx + bx, cz + bz) * 18;
    const geo = new THREE.BoxGeometry(bw, height, bd);
    const mat = buildingMats[Math.floor(seededRand(bx, bz) * buildingMats.length)];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx + bx, height / 2, cz + bz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    addWindows(group, cx + bx, height, cz + bz, bw, bd, windowMat);
  }
}

function getBuildingPositions(n, half) {
  if (n === 1) return [[0, 0, half * 1.6, half * 1.6]];
  if (n === 2) return [
    [-half * 0.4, 0, half * 0.9, half * 1.6],
    [half * 0.5, 0, half * 0.7, half * 1.4],
  ];
  if (n === 3) return [
    [-half * 0.5, -half * 0.4, half * 0.8, half * 0.9],
    [half * 0.5, -half * 0.3, half * 0.8, half * 1.0],
    [0, half * 0.5, half * 1.4, half * 0.7],
  ];
  return [
    [-half * 0.5, -half * 0.45, half * 0.8, half * 0.8],
    [half * 0.5, -half * 0.45, half * 0.7, half * 0.8],
    [-half * 0.5, half * 0.45, half * 0.8, half * 0.8],
    [half * 0.5, half * 0.45, half * 0.7, half * 0.8],
  ];
}

function addWindows(group, bx, bh, bz, bw, bd, mat) {
  const wSize = 0.6;
  const wGeo = new THREE.PlaneGeometry(wSize, wSize);
  const floors = Math.floor(bh / 2.5);
  const perRow = Math.max(1, Math.floor(bw / 2));

  for (let f = 0; f < floors; f++) {
    const y = 1.5 + f * 2.5;
    for (let i = 0; i < perRow; i++) {
      const frac = (i + 0.5) / perRow;
      const x = -bw / 2 + frac * bw;
      const wFront = new THREE.Mesh(wGeo, mat);
      wFront.position.set(bx + x, y, bz + bd / 2 + 0.01);
      group.add(wFront);
      const wBack = new THREE.Mesh(wGeo, mat);
      wBack.position.set(bx + x, y, bz - bd / 2 - 0.01);
      wBack.rotation.y = Math.PI;
      group.add(wBack);
    }
  }
}

function addPark(group, cx, cz, cellSize) {
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const treeTrunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
  const treeTopMat = new THREE.MeshLambertMaterial({ color: 0x27ae60 });

  const half = cellSize / 2 - 1;
  const parkGeo = new THREE.PlaneGeometry(cellSize - 2, cellSize - 2);
  const park = new THREE.Mesh(parkGeo, grassMat);
  park.rotation.x = -Math.PI / 2;
  park.position.set(cx, 0.03, cz);
  group.add(park);

  const positions = [
    [-half * 0.5, -half * 0.5],
    [half * 0.5, -half * 0.5],
    [-half * 0.5, half * 0.5],
    [half * 0.5, half * 0.5],
    [0, 0],
  ];

  for (const [tx, tz] of positions) {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 2, 6);
    const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
    trunk.position.set(cx + tx, 1, cz + tz);
    trunk.castShadow = true;
    group.add(trunk);

    const topGeo = new THREE.ConeGeometry(1.5, 3, 7);
    const top = new THREE.Mesh(topGeo, treeTopMat);
    top.position.set(cx + tx, 4, cz + tz);
    top.castShadow = true;
    group.add(top);
  }
}

function addDashLines(group, wx, wz, row, col, grid, cellSize, mat) {
  const dashGeo = new THREE.PlaneGeometry(0.3, 3);
  const numDashes = 3;
  const spacing = cellSize / (numDashes + 1);

  if (col > 0 && col < grid[0].length - 1) {
    for (let i = 1; i <= numDashes; i++) {
      const dash = new THREE.Mesh(dashGeo, mat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(wx - cellSize / 2 + i * spacing, 0.03, wz);
      group.add(dash);
    }
  }
}

function addBoundaryWalls(group, totalW, totalD) {
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x444466 });
  const h = 8;
  const t = 2;

  const walls = [
    [totalW + t, h, t, 0, h / 2, -totalD / 2],
    [totalW + t, h, t, 0, h / 2, totalD / 2],
    [t, h, totalD, -totalW / 2, h / 2, 0],
    [t, h, totalD, totalW / 2, h / 2, 0],
  ];

  for (const [w, hy, d, x, y, z] of walls) {
    const geo = new THREE.BoxGeometry(w, hy, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function addStreetLights(group, rows, cols, grid, offsetX, offsetZ, cellSize) {
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xffffd0, emissive: 0xaaaa40 });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== 0) continue;
      if ((row + col) % 3 !== 0) continue;

      const wx = offsetX + col * cellSize;
      const wz = offsetZ + row * cellSize;

      const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 6);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(wx + 3, 3, wz + 3);
      group.add(pole);

      const headGeo = new THREE.BoxGeometry(1, 0.3, 0.3);
      const head = new THREE.Mesh(headGeo, lightMat);
      head.position.set(wx + 3, 6.2, wz + 3);
      group.add(head);

      const light = new THREE.PointLight(0xffffd0, 0.8, 25);
      light.position.set(wx + 3, 6, wz + 3);
      group.add(light);
    }
  }
}

function seededRand(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export { CELL, CITY_GRID };
