import * as THREE from 'three';
import { buildCharacter } from './Character.js';

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

    this.group   = new THREE.Group();
    this.bodyMat = null;
    this._build();
    scene.add(this.group);
  }

  _build() {
    this.bodyMat = buildCharacter(this.group, this.color, this.hatIdx);

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
    const orig = this.bodyMat.color.clone();
    this.bodyMat.color.setHex(0xff2222);
    setTimeout(() => this.bodyMat.color.copy(orig), 280);
  }

  flashAttack() {
    const orig = this.bodyMat.color.clone();
    this.bodyMat.color.setHex(0xffcc00);
    setTimeout(() => this.bodyMat.color.copy(orig), 220);
  }

  applyServerState(x, y, z, rot) {
    this.targetPos.set(x, y, z);
    this.targetRot = rot;
  }

  update() {
    this.group.position.lerp(this.targetPos, 0.2);
    this.group.rotation.y += _angleDiff(this.targetRot, this.group.rotation.y) * 0.2;
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
