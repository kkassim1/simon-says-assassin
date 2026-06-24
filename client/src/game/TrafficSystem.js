import * as THREE from 'three';
import { CELL, CITY_GRID } from './CityMap.js';

const CAR_SPEED = 18;
const COP_SPEED = 22;
const LIGHT_CYCLE = 8;
const STOP_DISTANCE = 7.5;
const ROAD_BOUND = 150;

const MAT_TIRE = new THREE.MeshLambertMaterial({ color: 0x08080c });
const MAT_GLASS = new THREE.MeshLambertMaterial({ color: 0x8fd0ff, emissive: new THREE.Color(0x123044) });
const MAT_CHROME = new THREE.MeshLambertMaterial({ color: 0xc9c9d2 });
const MAT_RED_ON = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const MAT_YELLOW_ON = new THREE.MeshBasicMaterial({ color: 0xffc400 });
const MAT_GREEN_ON = new THREE.MeshBasicMaterial({ color: 0x29ff6a });
const MAT_OFF = new THREE.MeshBasicMaterial({ color: 0x15151a });
const MAT_POLE = new THREE.MeshLambertMaterial({ color: 0x555966 });
const MAT_SIGNAL_BOX = new THREE.MeshLambertMaterial({ color: 0x111118 });

const CAR_COLORS = [0xb92f2f, 0x2e86de, 0x20bf6b, 0xf7b731, 0x8854d0, 0xd1d8e0, 0xeb3b5a, 0x4b6584];

export class TrafficSystem {
  constructor(scene, carCount = 30, copCount = 7) {
    this.scene = scene;
    this.time = 0;
    this.lights = [];
    this.vehicles = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildLights();
    this._buildVehicles(carCount, copCount);
    this.update(0);
  }

  update(delta) {
    this.time += delta;
    this._updateLights();
    for (const vehicle of this.vehicles) vehicle.update(delta, this);
  }

  shouldVehicleStop(position, dir) {
    const light = this._nextLight(position, dir, STOP_DISTANCE);
    return !!light && this._redForDirection(light, dir);
  }

  shouldPedestrianWait(position, dir) {
    const light = this._nearestLight(position, 9);
    if (!light) return false;
    return this._redForPedestrian(light, dir);
  }

  getHitVehicleAt(position, radius = 2.2) {
    for (const vehicle of this.vehicles) {
      const d = Math.hypot(vehicle.group.position.x - position.x, vehicle.group.position.z - position.z);
      if (d < radius) return vehicle;
    }
    return null;
  }

  dispose() {
    this.scene.remove(this.group);
  }

  _buildLights() {
    for (const intersection of getIntersections()) {
      const light = {
        ...intersection,
        phase: (Math.abs(intersection.x + intersection.z) / CELL) % 2,
        meshes: [],
      };
      this.lights.push(light);
      this._addSignalMeshes(light);
    }
  }

  _buildVehicles(carCount, copCount) {
    const lanes = getRoadLanes();
    const total = carCount + copCount;
    for (let i = 0; i < total; i++) {
      const lane = lanes[i % lanes.length];
      const t = ((i * 37) % 100) / 100;
      const isCop = i >= carCount;
      this.vehicles.push(new TrafficVehicle(this.group, lane, t, i, isCop));
    }
  }

  _updateLights() {
    for (const light of this.lights) {
      const nsGreen = ((this.time / LIGHT_CYCLE + light.phase) % 2) < 1;
      light.nsGreen = nsGreen;
      for (const mesh of light.meshes) {
        const active = mesh.userData.axis === 'ns' ? nsGreen : !nsGreen;
        const color = mesh.userData.color;
        mesh.material = active
          ? (color === 'green' ? MAT_GREEN_ON : MAT_RED_ON)
          : MAT_OFF;
      }
    }
  }

  _addSignalMeshes(light) {
    const corners = [
      [light.x - 6.2, light.z - 6.2, 0],
      [light.x + 6.2, light.z + 6.2, Math.PI],
      [light.x - 6.2, light.z + 6.2, Math.PI / 2],
      [light.x + 6.2, light.z - 6.2, -Math.PI / 2],
    ];
    for (const [x, z, rot] of corners) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 6), MAT_POLE);
      pole.position.set(x, 2.1, z);
      this.group.add(pole);

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.05, 0.28), MAT_SIGNAL_BOX);
      box.position.set(x, 4.25, z);
      box.rotation.y = rot;
      this.group.add(box);

      const axis = Math.abs(Math.sin(rot)) > 0.5 ? 'ew' : 'ns';
      for (const [dy, color] of [[0.24, 'red'], [-0.24, 'green']]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), MAT_OFF);
        lamp.position.set(x + Math.sin(rot) * 0.17, 4.25 + dy, z + Math.cos(rot) * 0.17);
        lamp.userData = { axis, color };
        this.group.add(lamp);
        light.meshes.push(lamp);
      }
    }
  }

  _nextLight(position, dir, distance) {
    let best = null;
    let bestAhead = Infinity;
    for (const light of this.lights) {
      const dx = light.x - position.x;
      const dz = light.z - position.z;
      const side = Math.abs(dir.x) > Math.abs(dir.z) ? Math.abs(dz) : Math.abs(dx);
      const ahead = dx * dir.x + dz * dir.z;
      if (side < 3 && ahead > 0 && ahead < distance && ahead < bestAhead) {
        best = light;
        bestAhead = ahead;
      }
    }
    return best;
  }

  _nearestLight(position, distance) {
    let best = null;
    let bestDist = distance;
    for (const light of this.lights) {
      const d = Math.hypot(light.x - position.x, light.z - position.z);
      if (d < bestDist) {
        best = light;
        bestDist = d;
      }
    }
    return best;
  }

  _redForDirection(light, dir) {
    const movingNS = Math.abs(dir.z) > Math.abs(dir.x);
    return movingNS ? !light.nsGreen : light.nsGreen;
  }

  _redForPedestrian(light, dir) {
    const crossingNS = Math.abs(dir.z) > Math.abs(dir.x);
    return crossingNS ? light.nsGreen : !light.nsGreen;
  }
}

class TrafficVehicle {
  constructor(parent, lane, t, id, isCop) {
    this.lane = lane;
    this.t = t;
    this.id = id;
    this.isCop = isCop;
    this.group = new THREE.Group();
    this.speed = isCop ? COP_SPEED : CAR_SPEED * (0.82 + (id % 5) * 0.08);
    this._build();
    parent.add(this.group);
    this._syncPosition();
  }

  update(delta, traffic) {
    if (!traffic.shouldVehicleStop(this.group.position, this.lane.dir)) {
      this.t = (this.t + (this.speed * delta) / this.lane.length) % 1;
      this._syncPosition();
    }
  }

  _build() {
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.isCop ? 0x1d3557 : CAR_COLORS[this.id % CAR_COLORS.length] });
    const roofMat = new THREE.MeshLambertMaterial({ color: this.isCop ? 0xffffff : 0x20202a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3.8), bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    this.group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.62, 1.45), this.isCop ? roofMat : MAT_GLASS);
    cabin.position.set(0, 1.18, -0.2);
    cabin.castShadow = true;
    this.group.add(cabin);

    if (this.isCop) {
      const lightbar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 0.28), MAT_YELLOW_ON);
      lightbar.position.set(0, 1.6, -0.15);
      this.group.add(lightbar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.08, 3.2), MAT_CHROME);
      stripe.position.set(0, 0.95, 0);
      this.group.add(stripe);
    }

    for (const x of [-1.0, 1.0]) {
      for (const z of [-1.25, 1.25]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.24, 10), MAT_TIRE);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.34, z);
        this.group.add(tire);
      }
    }
  }

  _syncPosition() {
    const x = this.lane.start.x + this.lane.dir.x * this.lane.length * this.t;
    const z = this.lane.start.z + this.lane.dir.z * this.lane.length * this.t;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = Math.atan2(this.lane.dir.x, this.lane.dir.z);
  }
}

function getRoadLanes() {
  const rows = CITY_GRID.length;
  const cols = CITY_GRID[0].length;
  const lanes = [];

  for (let row = 0; row < rows; row++) {
    if (!CITY_GRID[row].every(cell => cell === 0)) continue;
    const z = toWorldZ(row);
    lanes.push(makeLane(-ROAD_BOUND, z - 2.4, ROAD_BOUND, z - 2.4));
    lanes.push(makeLane(ROAD_BOUND, z + 2.4, -ROAD_BOUND, z + 2.4));
  }

  for (let col = 0; col < cols; col++) {
    if (!CITY_GRID.every(row => row[col] === 0)) continue;
    const x = toWorldX(col);
    lanes.push(makeLane(x + 2.4, -ROAD_BOUND, x + 2.4, ROAD_BOUND));
    lanes.push(makeLane(x - 2.4, ROAD_BOUND, x - 2.4, -ROAD_BOUND));
  }

  return lanes;
}

function getIntersections() {
  const intersections = [];
  for (let row = 0; row < CITY_GRID.length; row++) {
    for (let col = 0; col < CITY_GRID[row].length; col++) {
      if (CITY_GRID[row][col] !== 0) continue;
      const hasNS = row > 0 && row < CITY_GRID.length - 1 && CITY_GRID[row - 1][col] === 0 && CITY_GRID[row + 1][col] === 0;
      const hasEW = col > 0 && col < CITY_GRID[row].length - 1 && CITY_GRID[row][col - 1] === 0 && CITY_GRID[row][col + 1] === 0;
      if (hasNS && hasEW) intersections.push({ x: toWorldX(col), z: toWorldZ(row) });
    }
  }
  return intersections;
}

function makeLane(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  return {
    start: new THREE.Vector3(x1, 0, z1),
    dir: new THREE.Vector3(dx / length, 0, dz / length),
    length,
  };
}

function toWorldX(col) {
  return -CITY_GRID[0].length * CELL / 2 + CELL / 2 + col * CELL;
}

function toWorldZ(row) {
  return -CITY_GRID.length * CELL / 2 + CELL / 2 + row * CELL;
}
