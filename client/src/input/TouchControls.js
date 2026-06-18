// Virtual joystick + action buttons for mobile/touch devices

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

    this.zone      = this.el.querySelector('#joystick-zone');
    this.base      = this.el.querySelector('#joystick-base');
    this.knob      = this.el.querySelector('#joystick-knob');
    this.btnAction = this.el.querySelector('#btn-action');
    this.btnSprint = this.el.querySelector('#btn-sprint');
  }

  _attachEvents() {
    this.zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._joystickActive = true;
      this._joystickId = t.identifier;
      this._joystickOrigin = { x: t.clientX, y: t.clientY };

      // Snap base under finger — clear 'bottom' so 'top' takes sole effect
      const rect = this.zone.getBoundingClientRect();
      const halfBase = this.base.offsetWidth / 2;
      this.base.style.bottom = 'auto';
      this.base.style.left   = (t.clientX - rect.left - halfBase) + 'px';
      this.base.style.top    = (t.clientY - rect.top  - halfBase) + 'px';
      this.base.style.opacity = '1';
    }, { passive: false });

    this.zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joystickId) continue;
        const dx = t.clientX - this._joystickOrigin.x;
        const dy = t.clientY - this._joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.base.offsetWidth * 0.5;
        const clamp = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        this.knob.style.transform =
          `translate(${Math.cos(angle) * clamp}px, ${Math.sin(angle) * clamp}px)`;
        this.input.moveX = (clamp / maxDist) * Math.cos(angle);
        this.input.moveY = (clamp / maxDist) * Math.sin(angle);
      }
    }, { passive: false });

    const endJoystick = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joystickId) continue;
        this._joystickActive = false;
        this._joystickId = null;
        this.input.moveX = 0;
        this.input.moveY = 0;
        this.knob.style.transform = 'translate(0,0)';
        this.base.style.opacity = '0.45';
        // Reset base to default position
        this.base.style.top    = 'auto';
        this.base.style.bottom = '0';
        this.base.style.left   = '0';
      }
    };
    this.zone.addEventListener('touchend',    endJoystick, { passive: false });
    this.zone.addEventListener('touchcancel', endJoystick, { passive: false });

    this.btnAction.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.actionPressed = true;
    }, { passive: false });
    this.btnAction.addEventListener('touchend', (e) => {
      e.preventDefault();
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
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
