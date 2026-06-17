// Virtual joystick + action buttons for mobile

export class TouchControls {
  constructor(virtualInput, container) {
    this.input = virtualInput;
    this.container = container;

    this._joystickActive = false;
    this._joystickOrigin = { x: 0, y: 0 };
    this._joystickId = null;

    this._buildUI();
    this._attachEvents();
  }

  _buildUI() {
    this.el = document.createElement('div');
    this.el.id = 'touch-controls';
    this.el.innerHTML = `
      <div id="joystick-zone">
        <div id="joystick-base">
          <div id="joystick-knob"></div>
        </div>
      </div>
      <div id="action-buttons">
        <button id="btn-action" class="action-btn">⚡<span>ACT</span></button>
        <button id="btn-sprint" class="action-btn sprint-btn">💨<span>RUN</span></button>
      </div>
    `;
    this.container.appendChild(this.el);

    this.base = this.el.querySelector('#joystick-base');
    this.knob = this.el.querySelector('#joystick-knob');
    this.btnAction = this.el.querySelector('#btn-action');
    this.btnSprint = this.el.querySelector('#btn-sprint');
  }

  _attachEvents() {
    const zone = this.el.querySelector('#joystick-zone');

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._joystickActive = true;
      this._joystickId = t.identifier;
      this._joystickOrigin = { x: t.clientX, y: t.clientY };
      this.base.style.opacity = '1';
      this.base.style.left = (t.clientX - zone.getBoundingClientRect().left - 45) + 'px';
      this.base.style.top = (t.clientY - zone.getBoundingClientRect().top - 45) + 'px';
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joystickId) continue;
        const dx = t.clientX - this._joystickOrigin.x;
        const dy = t.clientY - this._joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 40;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const nx = Math.cos(angle) * clampedDist;
        const ny = Math.sin(angle) * clampedDist;

        this.knob.style.transform = `translate(${nx}px, ${ny}px)`;
        this.input.moveX = (clampedDist / maxDist) * Math.cos(angle);
        this.input.moveY = (clampedDist / maxDist) * Math.sin(angle);
      }
    }, { passive: false });

    const endJoystick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          this._joystickActive = false;
          this._joystickId = null;
          this.input.moveX = 0;
          this.input.moveY = 0;
          this.knob.style.transform = 'translate(0,0)';
          this.base.style.opacity = '0.4';
        }
      }
    };
    zone.addEventListener('touchend', endJoystick);
    zone.addEventListener('touchcancel', endJoystick);

    this.btnAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.actionPressed = true;
    }, { passive: false });
    this.btnAction.addEventListener('touchend', (e) => {
      e.preventDefault();
      setTimeout(() => { this.input.actionPressed = false; }, 100);
    }, { passive: false });

    this.btnSprint.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.sprintActive = true;
    }, { passive: false });
    this.btnSprint.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.input.sprintActive = false;
    }, { passive: false });
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }

  destroy() {
    this.container.removeChild(this.el);
  }
}
