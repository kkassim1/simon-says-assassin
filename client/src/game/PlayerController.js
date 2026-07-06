import * as THREE from 'three';
import { buildCharacter, animateCharacter, PUNCH_DURATION } from './Character.js';

const SPEED            = 10;
const SPRINT_MULT      = 1.7;
const COLLISION_RADIUS = 0.6;
const CAMERA_VIEWS     = ['tactical', 'thirdPerson'];
const CAMERA_FOLLOW_DAMPING = 7;
const CAMERA_LOOK_DAMPING   = 9;
const CAMERA_YAW_DAMPING    = 5;
const PLAYER_TURN_DAMPING   = 16;
const MOVEMENT_INPUT_DAMPING = 14;

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
    this._visualRotation = 0;
    this.isAlive   = true;
    this.isCaptured = false;
    this.isDragging = false;
    this.speedMultiplier = 1;   // pickup boosts

    this._animTime   = 0;
    this._punchTimer = 0;
    this._smoothedInput = new THREE.Vector2();

    this.group     = new THREE.Group();
    this.bodyMat   = null;
    this._limbs    = null;
    this._buildMesh();
    scene.add(this.group);

    this.camera       = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.cameraView   = 'tactical';
    this.cameraOffset = new THREE.Vector3(0, 18, 16);
    this.cameraTarget = new THREE.Vector3();
    this._cameraLookAt = new THREE.Vector3();
    this._cameraYaw = 0;
    this._cameraInitialized = false;
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

  setHiddenVisual(hidden) {
    if (this._hiddenVisual === hidden) return;
    this._hiddenVisual = hidden;
    if (!this._bodyMats) {
      this._bodyMats = [];
      this.group.traverse((obj) => {
        if (obj.isMesh && obj !== this.actionRing) {
          this._bodyMats.push({ mat: obj.material, wasTransparent: obj.material.transparent });
        }
      });
    }
    for (const { mat, wasTransparent } of this._bodyMats) {
      mat.transparent = hidden || wasTransparent;
      mat.opacity = hidden ? 0.35 : 1;
    }
  }

  update(delta, input, isSprinting) {
    if (!this.isAlive || this.isCaptured) {
      if (this.isCaptured && this._limbs) {
        this._animTime += delta;
        animateCharacter(this._limbs, this._animTime, 'captured');
      }
      return;
    }

    const speed = SPEED * (isSprinting ? SPRINT_MULT : 1) * this.speedMultiplier;
    const targetInput = this._inputToWorld(input);
    this._smoothedInput.lerp(targetInput, _dampAlpha(MOVEMENT_INPUT_DAMPING, delta));

    const dx = this._smoothedInput.x;
    const dz = this._smoothedInput.y;
    const moving = this._smoothedInput.lengthSq() > 0.0009;

    if (moving) {
      this.rotation = Math.atan2(dx, dz);

      const nx = this.position.x + dx * speed * delta;
      const nz = this.position.z + dz * speed * delta;
      const bound = 158;
      const cx = Math.max(-bound, Math.min(bound, nx));
      const cz = Math.max(-bound, Math.min(bound, nz));

      // If already inside a building, allow movement so the player can escape
      const stuck = _collidesWithBuilding(this.position.x, this.position.z);
      if (stuck || !_collidesWithBuilding(cx, this.position.z)) this.position.x = cx;
      if (stuck || !_collidesWithBuilding(this.position.x, cz)) this.position.z = cz;
    }

    this._visualRotation = _dampAngle(this._visualRotation, this.rotation, PLAYER_TURN_DAMPING, delta);
    this.group.rotation.y = this._visualRotation;
    this.group.position.copy(this.position);

    // Crouch when hiding: whole body ducks down
    const targetScaleY = this._hiddenVisual ? 0.62 : 1;
    this.group.scale.y += (targetScaleY - this.group.scale.y) * _dampAlpha(10, delta);

    // Animation
    if (this._limbs) {
      this._animTime += delta;
      if (this._punchTimer > 0) this._punchTimer -= delta;

      let state = 'idle';
      if (this.isDragging) state = 'drag';
      else if (moving) state = isSprinting ? 'sprint' : 'walk';
      else if (this._hiddenVisual) state = 'hide';

      const punch = this._punchTimer > 0
        ? 1 - this._punchTimer / PUNCH_DURATION
        : 0;
      animateCharacter(this._limbs, this._animTime, state, punch);
    }
  }

  triggerPunch() {
    this._punchTimer = PUNCH_DURATION;
  }

  setCameraView(view) {
    const nextView = CAMERA_VIEWS.includes(view) ? view : 'tactical';
    const changed = nextView !== this.cameraView;
    this.cameraView = nextView;
    this.camera.fov = this.cameraView === 'thirdPerson' ? 68 : 60;
    this.camera.updateProjectionMatrix();
    if (changed) {
      this._cameraYaw = this.rotation;
      this._cameraInitialized = false;
    }
  }

  toggleCameraView() {
    this.setCameraView(this.cameraView === 'thirdPerson' ? 'tactical' : 'thirdPerson');
    return this.cameraView;
  }

  getCameraYaw() {
    return this.cameraView === 'thirdPerson' ? this._cameraYaw : Math.PI;
  }

  updateCamera(delta = 1 / 60) {
    this.updateCameraAt(this.position, this.rotation, delta);
  }

  updateCameraAt(position, rotation = this.rotation, delta = 1 / 60) {
    if (this.cameraView === 'thirdPerson') {
      this._updateThirdPersonCamera(position, rotation, delta);
    } else {
      this._updateTacticalCamera(position, delta);
    }
  }

  _updateTacticalCamera(position, delta) {
    const target = position.clone().add(new THREE.Vector3(0, 1, 0));
    const alpha = _dampAlpha(8, delta);
    this.cameraTarget.lerp(target, alpha);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
  }

  _updateThirdPersonCamera(position, rotation, delta) {
    this._cameraYaw = _dampAngle(this._cameraYaw, rotation, CAMERA_YAW_DAMPING, delta);

    const forward = new THREE.Vector3(Math.sin(this._cameraYaw), 0, Math.cos(this._cameraYaw));
    const target = position.clone().add(new THREE.Vector3(0, 2.1, 0));
    const desired = target.clone()
      .addScaledVector(forward, -9.5)
      .add(new THREE.Vector3(0, 3.6, 0));
    const lookAt = target.clone().addScaledVector(forward, 7);

    if (!this._cameraInitialized) {
      this.cameraTarget.copy(target);
      this.camera.position.copy(desired);
      this._cameraLookAt.copy(lookAt);
      this._cameraInitialized = true;
    }

    this.cameraTarget.lerp(target, _dampAlpha(CAMERA_FOLLOW_DAMPING, delta));
    this.camera.position.lerp(desired, _dampAlpha(CAMERA_FOLLOW_DAMPING, delta));
    this._cameraLookAt.lerp(lookAt, _dampAlpha(CAMERA_LOOK_DAMPING, delta));
    this.camera.lookAt(this._cameraLookAt);
  }

  _inputToWorld(input) {
    const ix = input.x || 0;
    const iy = input.y || 0;
    if (Math.abs(ix) < 0.001 && Math.abs(iy) < 0.001) return new THREE.Vector2(0, 0);

    if (this.cameraView !== 'thirdPerson') return _clampVectorLength(new THREE.Vector2(ix, iy), 1);

    const yaw = this._cameraYaw;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    const worldX = rightX * ix + forwardX * -iy;
    const worldZ = rightZ * ix + forwardZ * -iy;

    return _clampVectorLength(new THREE.Vector2(worldX, worldZ), 1);
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

function _dampAlpha(lambda, delta) {
  return 1 - Math.exp(-lambda * Math.min(delta, 0.1));
}

function _dampAngle(current, target, lambda, delta) {
  return current + _angleDiff(target, current) * _dampAlpha(lambda, delta);
}

function _angleDiff(target, current) {
  let d = target - current;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function _clampVectorLength(vector, maxLength) {
  if (vector.lengthSq() > maxLength * maxLength) vector.setLength(maxLength);
  return vector;
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
