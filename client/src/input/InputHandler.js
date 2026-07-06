import { GamepadPoller } from './Gamepad.js';

export class InputHandler {
  constructor() {
    this.keys = new Set();
    this.actionPressed = false;
    this.sprintPressed = false;
    this.gamepad = new GamepadPoller();
    this._gp = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) {
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyE') {
      this.actionPressed = true;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.sprintPressed = true;
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyE') {
      this.actionPressed = false;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.sprintPressed = false;
    }
  }

  getMovement() {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Normalize diagonal
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) { x /= len; y /= len; }

    // Merge gamepad (polled once per frame here; other getters read the cache)
    this._gp = this.gamepad.poll();
    if (this._gp) {
      if (this._gp.actionEdge) this.actionPressed = true;
      if (Math.hypot(this._gp.x, this._gp.y) > len) return { x: this._gp.x, y: this._gp.y };
    }

    return { x, y };
  }

  consumeAction() {
    const was = this.actionPressed;
    this.actionPressed = false;
    return was;
  }

  isSprinting() {
    return this.sprintPressed || Boolean(this._gp?.sprint);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

// External override for touch / virtual joystick (also merges gamepad, so a
// Bluetooth controller works on phones/tablets)
export class VirtualInput {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    this.actionPressed = false;
    this.sprintActive = false;
    this.gamepad = new GamepadPoller();
    this._gp = null;
  }

  getMovement() {
    this._gp = this.gamepad.poll();
    if (this._gp) {
      if (this._gp.actionEdge) this.actionPressed = true;
      if (Math.hypot(this._gp.x, this._gp.y) > Math.hypot(this.moveX, this.moveY)) {
        return { x: this._gp.x, y: this._gp.y };
      }
    }
    return { x: this.moveX, y: this.moveY };
  }

  consumeAction() { const was = this.actionPressed; this.actionPressed = false; return was; }
  isSprinting() { return this.sprintActive || Boolean(this._gp?.sprint); }
  destroy() {}
}
