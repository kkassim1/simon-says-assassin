import * as THREE from 'three';
import { buildCharacter, animateCharacter, PUNCH_DURATION } from './Character.js';

const SPEED            = 10;
const SPRINT_MULT      = 1.7;
const COLLISION_RADIUS = 0.6;

let buildingBoxes = [];
export function setBuildingBoxes(boxes) { buildingBoxes = boxes; }

export class PlayerController {
  constructor(scene, color = '#e74c3c', name = 'You', hatIdx = 0) {
    this.scene   = scene;
    this.color   = color;
    this.name    = name;
    this.hatIdx  = hatIdx;

    this.position  = new THREE.Vector3(0, 0, 0);
    this.rotation  = 0;
    this.isAlive   = true;
    this.isCaptured = false;
    this.isDragging = false;

    this._animTime   = 0;
    this._punchTimer = 0;

    this.group     = new THREE.Group();
    this.bodyMat   = null;
    this._limbs    = null;
    this._buildMesh();
    scene.add(this.group);

    this.camera       = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.cameraOffset = new THREE.Vector3(0, 18, 16);
    this.cameraTarget = new THREE.Vector3();
  }

  _buildMesh() {
    const built = buildCharacter(this.group, this.color, this.hatIdx);
    this.bodyMat = built.jacketMat;
    this._limbs  = built;

    // Name label above hat
    this.labelSprite = _makeLabel(this.name, this.color);
    this.labelSprite.position.y = 3.6;
    this.group.add(this.labelSprite);

    // Action indicator ring at feet
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0,
    });
    this.actionRing = new THREE.Mesh(ringGeo, ringMat);
    this.actionRing.rotation.x = -Math.PI / 2;
    this.actionRing.position.y = 0.1;
    this.group.add(this.actionRing);
  }

  showActionRing(visible) {
    this.actionRing.material.opacity = visible ? 0.8 : 0;
  }

  update(delta, input, isSprinting) {
    if (!this.isAlive || this.isCaptured) {
      if (this.isCaptured && this._limbs) {
        this._animTime += delta;
        animateCharacter(this._limbs, this._animTime, 'captured');
      }
      return;
    }

    const speed = SPEED * (isSprinting ? SPRINT_MULT : 1);
    const dx = input.x;
    const dz = input.y;
    const moving = Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01;

    if (moving) {
      this.rotation = Math.atan2(dx, dz);
      this.group.rotation.y = this.rotation;

      const nx = this.position.x + dx * speed * delta;
      const nz = this.position.z + dz * speed * delta;
      const bound = 158;
      const cx = Math.max(-bound, Math.min(bound, nx));
      const cz = Math.max(-bound, Math.min(bound, nz));

      if (!_collidesWithBuilding(cx, this.position.z)) this.position.x = cx;
      if (!_collidesWithBuilding(this.position.x, cz)) this.position.z = cz;
    }

    this.group.position.copy(this.position);

    // Animation
    if (this._limbs) {
      this._animTime += delta;
      if (this._punchTimer > 0) this._punchTimer -= delta;

      let state = 'idle';
      if (this.isDragging) state = 'drag';
      else if (moving) state = isSprinting ? 'sprint' : 'walk';

      const punch = this._punchTimer > 0
        ? 1 - this._punchTimer / PUNCH_DURATION
        : 0;
      animateCharacter(this._limbs, this._animTime, state, punch);
    }
  }

  triggerPunch() {
    this._punchTimer = PUNCH_DURATION;
  }

  updateCamera() {
    const target = this.position.clone().add(new THREE.Vector3(0, 1, 0));
    this.cameraTarget.lerp(target, 0.1);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
  }

  setAlive(alive) {
    this.isAlive       = alive;
    this.group.visible = alive;
  }

  setCaptured(captured) {
    this.isCaptured = captured;
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
  }

  getState() {
    return { x: this.position.x, y: this.position.y, z: this.position.z, rot: this.rotation };
  }

  dispose() { this.scene.remove(this.group); }
}

function _collidesWithBuilding(x, z) {
  for (const box of buildingBoxes) {
    if (
      x > box.minX + COLLISION_RADIUS && x < box.maxX - COLLISION_RADIUS &&
      z > box.minZ + COLLISION_RADIUS && z < box.maxZ - COLLISION_RADIUS
    ) return true;
  }
  return false;
}

function _makeLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(4, 4, 248, 56, 8);
  ctx.fill();
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 36);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}
