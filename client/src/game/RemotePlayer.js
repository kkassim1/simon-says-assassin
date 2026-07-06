import * as THREE from 'three';
import { buildCharacter, animateCharacter, PUNCH_DURATION } from './Character.js';
import { hideSpotsFromGrid } from './CityMap.js';

let _hideSpots = [];
export function refreshHideSpots() { _hideSpots = hideSpotsFromGrid(); }

function _inHideSpot(pos) {
  for (const s of _hideSpots) {
    const dx = pos.x - s.x, dz = pos.z - s.z;
    if (dx * dx + dz * dz < s.r * s.r) return true;
  }
  return false;
}

export class RemotePlayer {
  constructor(scene, id, name, color, hatIdx = 0) {
    this.scene  = scene;
    this.id     = id;
    this.name   = name;
    this.color  = color;
    this.hatIdx = hatIdx;
    this.isAlive = true;
    this.hp      = 3;

    this.targetPos = new THREE.Vector3();
    this.targetRot = 0;
    this.isCaptured = false;
    this.isDragging = false;

    this._animTime   = 0;
    this._punchTimer = 0;
    this._prevPos    = new THREE.Vector3();
    this._speed       = 0;      // smoothed world units/sec
    this._revealTimer = 0;      // seconds the identity stays revealed
    this.alwaysVisible = false; // cops etc. never disguise

    this.group   = new THREE.Group();
    this.bodyMat = null;
    this._limbs  = null;
    this._build();
    scene.add(this.group);
  }

  _build() {
    const built = buildCharacter(this.group, this.color, this.hatIdx);
    this.bodyMat = built.jacketMat;
    this._limbs  = built;

    // Name label above hat
    this.label = _makeLabel(this.name, this.color);
    this.label.position.y = 3.6;
    this.group.add(this.label);

    // HP bar (3 segments floating above label)
    this.hpBars = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.38, 0.12, 0.05);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00e44a });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(-0.42 + i * 0.42, 4.0, 0);
      this.group.add(bar);
      this.hpBars.push(bar);
    }
  }

  setHp(hp) {
    this.hp = hp;
    for (let i = 0; i < this.hpBars.length; i++) {
      this.hpBars[i].material.color.setHex(i < hp ? 0x00e44a : 0x333333);
    }
  }

  flashDamage() {
    this._revealTimer = 3;
    const orig = this.bodyMat.color.clone();
    this.bodyMat.color.setHex(0xff2222);
    setTimeout(() => this.bodyMat.color.copy(orig), 280);
  }

  flashAttack() {
    this._punchTimer = PUNCH_DURATION;
    this._revealTimer = 3;
    const orig = this.bodyMat.color.clone();
    this.bodyMat.color.setHex(0xffcc00);
    setTimeout(() => this.bodyMat.color.copy(orig), 220);
  }

  setCaptured(captured) {
    this.isCaptured = captured;
  }

  applyServerState(x, y, z, rot) {
    this.targetPos.set(x, y, z);
    this.targetRot = rot;
  }

  update(delta, viewerPos = null) {
    const t = Math.min(1, delta * 12);
    this._prevPos.copy(this.group.position);
    this.group.position.lerp(this.targetPos, t);
    this.group.rotation.y += _angleDiff(this.targetRot, this.group.rotation.y) * t;

    const movedDist = this.group.position.distanceTo(this._prevPos);
    if (delta > 0) {
      // Smooth instantaneous speed so lerp jitter doesn't flicker the disguise
      this._speed += ((movedDist / delta) - this._speed) * Math.min(1, delta * 6);
    }
    this._updateDisguise(delta, viewerPos);

    // Crouch when hiding
    const targetScaleY = this._hiddenVisual ? 0.62 : 1;
    this.group.scale.y += (targetScaleY - this.group.scale.y) * Math.min(1, delta * 10);

    if (this._limbs) {
      this._animTime += delta;
      if (this._punchTimer > 0) this._punchTimer -= delta;

      const moved = movedDist > 0.002;

      let state = 'idle';
      if (this.isCaptured) state = 'captured';
      else if (this.isDragging) state = 'drag';
      else if (moved) state = 'walk';
      else if (this._hiddenVisual) state = 'hide';

      const punch = this._punchTimer > 0
        ? 1 - this._punchTimer / PUNCH_DURATION
        : 0;
      animateCharacter(this._limbs, this._animTime, state, punch);
    }
  }

  // Blend-in-the-crowd: name tag + HP bars hide while this player moves at a
  // civilian pace. Sprinting, attacking, taking damage, dragging a hostage,
  // being captured, or standing close to the viewer reveals them.
  // Standing still in a hide spot fades the whole body and beats proximity.
  _updateDisguise(delta, viewerPos) {
    if (this._revealTimer > 0) this._revealTimer -= delta;
    if (this._speed > 12) this._revealTimer = Math.max(this._revealTimer, 1.5);

    // Same hide timer as the server (7s hide / 8s cooldown)
    const inSpot = !this.alwaysVisible && !this.isCaptured && !this.isDragging &&
      this._speed < 2 && _inHideSpot(this.group.position);
    const now = Date.now();
    let hiding = false;
    if (!inSpot) {
      this._hideStart = null;
    } else if (this._hideCooldownUntil && now < this._hideCooldownUntil) {
      hiding = false;
    } else {
      if (!this._hideStart) this._hideStart = now;
      if (now - this._hideStart > 7000) {
        this._hideStart = null;
        this._hideCooldownUntil = now + 8000;
      } else {
        hiding = true;
      }
    }
    this.setHiddenVisual(hiding);

    const near = viewerPos && this.group.position.distanceTo(viewerPos) < 10;
    const exposed = !hiding && (
      this.alwaysVisible || this._revealTimer > 0 || near ||
      this.isCaptured || this.isDragging
    );

    if (this.label) this.label.visible = exposed;
    for (const bar of this.hpBars) bar.visible = exposed;
  }

  setHiddenVisual(hidden) {
    if (this._hiddenVisual === hidden) return;
    this._hiddenVisual = hidden;
    if (!this._bodyMats) {
      this._bodyMats = [];
      this.group.traverse((obj) => {
        if (obj.isMesh) {
          this._bodyMats.push({ mat: obj.material, wasTransparent: obj.material.transparent });
        }
      });
    }
    for (const { mat, wasTransparent } of this._bodyMats) {
      mat.transparent = hidden || wasTransparent;
      mat.opacity = hidden ? 0.35 : 1;
    }
  }

  setAlive(alive) {
    this.isAlive       = alive;
    this.group.visible = alive;
  }

  dispose() { this.scene.remove(this.group); }
}

function _angleDiff(target, current) {
  let d = target - current;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
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
