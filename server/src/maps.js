// Map definitions shared with the client at game start (the server sends the
// chosen map's grid + locations in `game:countdown`, so the client never
// hard-codes a layout).
//
// Cell types: 0=road, 1=building (blocks movement), 2=park, 3=stadium,
// 4=construction site, 5=monument plaza, 6=water (blocks movement)

export const CELL = 20;

const DOWNTOWN_GRID = [
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 5, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 2, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 1, 0, 4, 1, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 3, 0, 1, 1, 0, 1, 1, 0, 1],
  [2, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
];

const RIVERSIDE_GRID = [
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 2, 0, 3, 1, 0, 2, 6, 6, 1, 0, 5, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 2, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 2, 0, 1, 6, 6, 1, 0, 4, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 2, 0, 1, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 2, 0, 1, 1, 0, 2, 6, 6, 1, 0, 1, 2, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 2, 1],
  [2, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 1, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 6, 6, 1, 0, 1, 1, 0, 1, 1],
];

const GRAND_PARK_GRID = [
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
  [1, 2, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 2, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 4, 1],
  [1, 1, 0, 1, 2, 0, 1, 1, 1, 1, 0, 2, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 2, 2, 2, 2, 0, 1, 1, 0, 1, 1],
  [1, 2, 0, 1, 1, 0, 2, 3, 2, 2, 0, 1, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 2, 2, 5, 2, 0, 1, 1, 0, 2, 1],
  [1, 1, 0, 1, 1, 0, 2, 2, 2, 2, 0, 1, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
  [1, 2, 0, 1, 1, 0, 1, 2, 1, 1, 0, 1, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 2, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1],
];

export const MAPS = [
  {
    id: 'downtown',
    name: 'Neon Downtown',
    grid: DOWNTOWN_GRID,
    locations: [
      { id: 'docks',     label: 'the Docks',         x: 130,  z: 130  },
      { id: 'alley',     label: 'the Back Alley',    x: -130, z: 70   },
      { id: 'roof',      label: 'the Rooftop',       x: 70,   z: -130 },
      { id: 'warehouse', label: 'the Warehouse',     x: -110, z: -110 },
      { id: 'plaza',     label: 'the Central Plaza', x: 10,   z: 10   },
      { id: 'bridge',    label: 'the Bridge',        x: 100,  z: -50  },
    ],
  },
  {
    id: 'riverside',
    name: 'Riverside',
    grid: RIVERSIDE_GRID,
    locations: [
      { id: 'north-bridge', label: 'the North Bridge', x: 10,   z: -110 },
      { id: 'south-bridge', label: 'the South Bridge', x: 10,   z: 130  },
      { id: 'boardwalk',    label: 'the Boardwalk',    x: -30,  z: -90  },
      { id: 'stadium',      label: 'the Stadium',      x: -90,  z: -90  },
      { id: 'crane-yard',   label: 'the Crane Yard',   x: 70,   z: -30  },
      { id: 'east-market',  label: 'the East Market',  x: 110,  z: 90   },
    ],
  },
  {
    id: 'grand-park',
    name: 'Grand Park',
    grid: GRAND_PARK_GRID,
    locations: [
      { id: 'stadium',      label: 'the Park Stadium',  x: -10,  z: -10  },
      { id: 'monument',     label: 'the Monument',      x: 10,   z: 10   },
      { id: 'north-gate',   label: 'the North Gate',    x: 10,   z: -110 },
      { id: 'south-gate',   label: 'the South Gate',    x: 10,   z: 110  },
      { id: 'construction', label: 'the Building Site', x: 130,  z: -90  },
      { id: 'west-market',  label: 'the West Market',   x: -130, z: 50   },
    ],
  },
];

export function pickRandomMap() {
  return MAPS[Math.floor(Math.random() * MAPS.length)];
}

function gridOffsets(grid) {
  return {
    x: -(grid[0].length * CELL) / 2 + CELL / 2,
    z: -(grid.length * CELL) / 2 + CELL / 2,
  };
}

// 8 spawn points on road cells, spread toward the compass points
export function computeSpawnPoints(grid) {
  const off = gridOffsets(grid);
  const roads = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      if (grid[row][col] === 0) {
        roads.push({ x: off.x + col * CELL, z: off.z + row * CELL });
      }
    }
  }
  const R = 110;
  const anchors = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { x: Math.cos(a) * R, z: Math.sin(a) * R };
  });
  return anchors.map(anchor => {
    let best = roads[0], bestD = Infinity;
    for (const r of roads) {
      const d = (r.x - anchor.x) ** 2 + (r.z - anchor.z) ** 2;
      if (d < bestD) { bestD = d; best = r; }
    }
    return { x: best.x, z: best.z };
  });
}

// Hide spots derived from the grid — MUST match client/src/game/CityMap.js
// (parks: tree corners; plaza: planters; construction: sand pile).
export function hideSpotsFromGrid(grid) {
  const off = gridOffsets(grid);
  const spots = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      const v = grid[row][col];
      const cx = off.x + col * CELL;
      const cz = off.z + row * CELL;
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
