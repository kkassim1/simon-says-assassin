import * as THREE from 'three';

const NPC_COLORS = [0x95a5a6, 0xbdc3c7, 0x7f8c8d, 0xecf0f1];
const NPC_NAMES = ['Civilian', 'Passerby', 'Bystander', 'Tourist'];
const NPC_SPEED = 2.5;
const NPC_RADIUS = 0.5;

let _buildingBoxes = [];
export function setNPCBuildingBoxes(boxes) { _buildingBoxes = boxes; }

function _collidesWithBuilding(x, z) {
  for (const box of _buildingBoxes) {
    if (
      x > box.minX + NPC_RADIUS && x < box.maxX - NPC_RADIUS &&
      z > box.minZ + NPC_RADIUS && z < box.maxZ - NPC_RADIUS
    ) return true;
  }
  return false;
}

export class NPC {
  constructor(scene, id) {
    this.scene = scene;
    this.id = id;

    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * 260,
      0,
      (Math.random() - 0.5) * 260
    );

    this.target = this._newTarget();
    this.group = new THREE.Group();
    this._build();
    this.group.position.copy(this.position);
    scene.add(this.group);

    this._idleTime = 0;
    this._waitTime = 1 + Math.random() * 3;
    this._waiting = false;
  }

  _build() {
    const color = NPC_COLORS[this.id % NPC_COLORS.length];

    const bodyGeo = new THREE.CapsuleGeometry(0.38, 0.9, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    this.group.add(body);

    const headGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0d9b5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.75;
    this.group.add(head);
  }

  _newTarget() {
    const px = (Math.random() - 0.5) * 260;
    const pz = (Math.random() - 0.5) * 260;
    return new THREE.Vector3(px, 0, pz);
  }

  update(delta) {
    if (this._waiting) {
      this._idleTime += delta;
      if (this._idleTime >= this._waitTime) {
        this._waiting = false;
        this._idleTime = 0;
        this.target = this._newTarget();
      }
      return;
    }

    const dir = new THREE.Vector3().subVectors(this.target, this.position);
    const dist = dir.length();

    if (dist < 0.5) {
      this._waiting = true;
      this._waitTime = 1 + Math.random() * 4;
      return;
    }

    dir.normalize();
    const step = Math.min(NPC_SPEED * delta, dist);
    const nx = Math.max(-155, Math.min(155, this.position.x + dir.x * step));
    const nz = Math.max(-155, Math.min(155, this.position.z + dir.z * step));

    if (_collidesWithBuilding(nx, nz)) {
      // Hit a building — wait briefly and pick a new destination
      this._waiting = true;
      this._waitTime = 0.5 + Math.random() * 1.5;
      this.target = this._newTarget();
      return;
    }

    this.position.x = nx;
    this.position.z = nz;

    this.group.position.copy(this.position);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
  }

  getPosition() {
    return this.position;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}

export function createNPCs(scene, count = 10) {
  return Array.from({ length: count }, (_, i) => new NPC(scene, i));
}
