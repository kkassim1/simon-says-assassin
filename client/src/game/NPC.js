import * as THREE from 'three';

const NPC_SPEED  = 2.5;
const COP_WALK_SPEED = 3.2;
const NPC_RADIUS = 0.5;

// Varied skin tones
const SKIN_TONES = [0xf5cba7, 0xe8b88a, 0xc68642, 0x8d5524, 0xfad9b0, 0xd4956a];

// Varied civilian clothing colors
const JACKET_COLORS = [
  0x2980b9, 0x8e44ad, 0x27ae60, 0xc0392b, 0xe67e22,
  0x16a085, 0x2c3e50, 0x7f8c8d, 0xd35400, 0x1abc9c,
];
const PANTS_COLORS = [0x1a2535, 0x2c3e50, 0x34495e, 0x4a4a4a, 0x1e1e2e, 0x2e2e1e];

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
  constructor(scene, id, role = 'civilian') {
    this.scene = scene;
    this.id    = id;
    this.role  = role;

    this.position = new THREE.Vector3(
      (Math.random() - 0.5) * 260,
      0,
      (Math.random() - 0.5) * 260
    );

    this.target   = this._newTarget();
    this.group    = new THREE.Group();
    this._animT   = Math.random() * Math.PI * 2; // offset so they don't all sync
    this._waiting  = false;
    this._idleTime = 0;
    this._waitTime = 1 + Math.random() * 3;
    this._dir      = new THREE.Vector3();

    this._build();
    this.group.position.copy(this.position);
    scene.add(this.group);
  }

  _build() {
    const skinColor    = SKIN_TONES[this.id % SKIN_TONES.length];
    const isCop = this.role === 'cop';
    const jacketColor  = isCop ? 0x1d3557 : JACKET_COLORS[this.id % JACKET_COLORS.length];
    const pantsColor   = isCop ? 0x111827 : PANTS_COLORS[this.id % PANTS_COLORS.length];

    const skinM   = new THREE.MeshLambertMaterial({ color: skinColor });
    const jacketM = new THREE.MeshLambertMaterial({ color: jacketColor });
    const pantsM  = new THREE.MeshLambertMaterial({ color: pantsColor });
    const shoeM   = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const eyeM    = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const badgeM  = new THREE.MeshBasicMaterial({ color: 0xffd447 });

    function mk(geo, mat, x, y, z, shadow = true) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (shadow) m.castShadow = true;
      return m;
    }

    // ── Leg pivot groups (pivot at hip) ─────────────────────────
    this._legL = new THREE.Group();
    this._legL.position.set(-0.13, 0.78, 0);
    this._legL.add(mk(new THREE.BoxGeometry(0.18, 0.58, 0.2),  pantsM, 0, -0.29, 0));
    this._legL.add(mk(new THREE.BoxGeometry(0.2,  0.15, 0.3),  shoeM,  0, -0.65, 0.03));
    this.group.add(this._legL);

    this._legR = new THREE.Group();
    this._legR.position.set(0.13, 0.78, 0);
    this._legR.add(mk(new THREE.BoxGeometry(0.18, 0.58, 0.2),  pantsM, 0, -0.29, 0));
    this._legR.add(mk(new THREE.BoxGeometry(0.2,  0.15, 0.3),  shoeM,  0, -0.65, 0.03));
    this.group.add(this._legR);

    // ── Torso ────────────────────────────────────────────────────
    this.group.add(mk(new THREE.BoxGeometry(0.44, 0.6, 0.24), jacketM, 0, 1.1, 0));
    if (isCop) this.group.add(mk(new THREE.BoxGeometry(0.12, 0.14, 0.03), badgeM, 0.14, 1.22, 0.135, false));

    // ── Arm pivot groups ─────────────────────────────────────────
    const armGeo  = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6);
    const handGeo = new THREE.SphereGeometry(0.09, 5, 5);

    const shL = new THREE.Group();
    shL.position.set(-0.31, 1.35, 0);
    shL.rotation.z = 0.2;
    this.group.add(shL);
    this._armL = new THREE.Group();
    this._armL.add(mk(armGeo,  jacketM, 0, -0.25, 0));
    this._armL.add(mk(handGeo, skinM,   0, -0.52, 0, false));
    shL.add(this._armL);

    const shR = new THREE.Group();
    shR.position.set(0.31, 1.35, 0);
    shR.rotation.z = -0.2;
    this.group.add(shR);
    this._armR = new THREE.Group();
    this._armR.add(mk(armGeo,  jacketM, 0, -0.25, 0));
    this._armR.add(mk(handGeo, skinM,   0, -0.52, 0, false));
    shR.add(this._armR);

    // ── Neck ─────────────────────────────────────────────────────
    this.group.add(mk(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 6), skinM, 0, 1.47, 0, false));

    // ── Head ─────────────────────────────────────────────────────
    this.group.add(mk(new THREE.SphereGeometry(0.24, 7, 7), skinM, 0, 1.79, 0));

    // ── Eyes ─────────────────────────────────────────────────────
    const eyeGeo = new THREE.SphereGeometry(0.044, 4, 4);
    this.group.add(mk(eyeGeo, eyeM, -0.09, 1.83, 0.21, false));
    this.group.add(mk(eyeGeo, eyeM,  0.09, 1.83, 0.21, false));

    // ── Simple hat (varies by id) ────────────────────────────────
    _addHat(this.group, isCop ? 3 : this.id % 3, jacketM);
  }

  _newTarget() {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 260,
      0,
      (Math.random() - 0.5) * 260
    );
  }

  update(delta, traffic = null) {
    if (this._waiting) {
      this._idleTime += delta;
      // idle arm sway
      const t = this._animT + this._idleTime * 1.5;
      this._armL.rotation.x =  Math.sin(t) * 0.04;
      this._armR.rotation.x = -Math.sin(t) * 0.04;
      this._legL.rotation.x = 0;
      this._legR.rotation.x = 0;
      if (this._idleTime >= this._waitTime) {
        this._waiting  = false;
        this._idleTime = 0;
        this.target    = this._newTarget();
      }
      return;
    }

    const dir  = this._dir.subVectors(this.target, this.position);
    const dist = dir.length();

    if (dist < 0.5) {
      this._waiting  = true;
      this._waitTime = 1 + Math.random() * 4;
      return;
    }

    dir.normalize();
    const speed = this.role === 'cop' ? COP_WALK_SPEED : NPC_SPEED;
    const step = Math.min(speed * delta, dist);
    const nx   = Math.max(-155, Math.min(155, this.position.x + dir.x * step));
    const nz   = Math.max(-155, Math.min(155, this.position.z + dir.z * step));

    if (traffic?.shouldPedestrianWait(this.position, dir)) {
      this._armL.rotation.x =  Math.sin(this._animT + performance.now() * 0.001) * 0.04;
      this._armR.rotation.x = -this._armL.rotation.x;
      this._legL.rotation.x = 0;
      this._legR.rotation.x = 0;
      return;
    }

    if (_collidesWithBuilding(nx, nz)) {
      this._waiting  = true;
      this._waitTime = 0.5 + Math.random() * 1.5;
      this.target    = this._newTarget();
      return;
    }

    this.position.x = nx;
    this.position.z = nz;
    this.group.position.copy(this.position);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);

    // Walk animation
    this._animT += delta;
    const t = this._animT * Math.PI * 5;
    this._legL.rotation.x =  Math.sin(t) * 0.5;
    this._legR.rotation.x = -Math.sin(t) * 0.5;
    this._armL.rotation.x =  Math.sin(t) * 0.38;
    this._armR.rotation.x = -Math.sin(t) * 0.38;
  }

  getPosition() { return this.position; }

  dispose() { this.scene.remove(this.group); }
}

function _addHat(group, style, jacketMat) {
  const darkM  = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const brownM = new THREE.MeshLambertMaterial({ color: 0x3d2b1f });

  function mk(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
  }

  switch (style) {
    case 0: // baseball cap
      mk(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 8), darkM,  0, 2.21, 0);
      mk(new THREE.CylinderGeometry(0.18, 0.26, 0.18, 8), darkM,  0, 2.30, 0);
      mk(new THREE.BoxGeometry(0.26, 0.04, 0.18),          darkM,  0, 2.20, 0.22);
      break;
    case 1: // beanie (jacket color)
      mk(new THREE.SphereGeometry(0.27, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), jacketMat, 0, 1.97, 0);
      mk(new THREE.SphereGeometry(0.065, 5, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), 0, 2.28, 0);
      break;
    case 2: // fedora
      mk(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 8), brownM, 0, 2.21, 0);
      mk(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 8), brownM, 0, 2.32, 0);
      break;
    case 3: // police cap
      mk(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8), jacketMat, 0, 2.2, 0);
      mk(new THREE.CylinderGeometry(0.2, 0.26, 0.16, 8), jacketMat, 0, 2.29, 0);
      mk(new THREE.BoxGeometry(0.32, 0.04, 0.18), jacketMat, 0, 2.19, 0.22);
      break;
  }
}

export function createNPCs(scene, count = 10, copCount = 0) {
  const npcs = [];
  for (let i = 0; i < count; i++) npcs.push(new NPC(scene, i, 'civilian'));
  for (let i = 0; i < copCount; i++) npcs.push(new NPC(scene, count + i, 'cop'));
  return npcs;
}
