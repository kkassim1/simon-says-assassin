export class InputHandler {
  constructor() {
    this.keys = new Set();
    this.actionPressed = false;
    this.sprintPressed = false;

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

    return { x, y };
  }

  consumeAction() {
    const was = this.actionPressed;
    this.actionPressed = false;
    return was;
  }

  isSprinting() {
    return this.sprintPressed;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

// External override for touch / virtual joystick
export class VirtualInput {
  constructor() {
    this.moveX = 0;
    this.moveY = 0;
    this.actionPressed = false;
    this.sprintActive = false;
  }

  getMovement() { return { x: this.moveX, y: this.moveY }; }
  consumeAction() { const was = this.actionPressed; this.actionPressed = false; return was; }
  isSprinting() { return this.sprintActive; }
  destroy() {}
}
