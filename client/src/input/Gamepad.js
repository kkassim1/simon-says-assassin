// Gamepad (standard mapping) support, merged into keyboard and touch handlers.
// A: act · X: act · RT/LT/B: sprint · Y: toggle 3D view · Start: menu
// Left stick / D-pad: move

const DEADZONE = 0.18;

export class GamepadPoller {
  constructor() {
    this._prev = {};
  }

  /** Poll once per frame. Returns null when no controller is connected. */
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) return null;

    const b = (i) => Boolean(pad.buttons[i]?.pressed);

    let x = pad.axes[0] || 0;
    let y = pad.axes[1] || 0;
    if (Math.hypot(x, y) < DEADZONE) { x = 0; y = 0; }

    // D-pad overrides stick
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }

    const actionEdge = this._edge('action', b(0) || b(2));       // A / X
    const sprint     = b(1) || b(6) || b(7);                     // B / LT / RT

    // Y toggles camera view, Start opens the menu — reuse the existing
    // keyboard listeners by dispatching synthetic key events.
    if (this._edge('view', b(3))) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }));
    }
    if (this._edge('menu', b(9))) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }

    return { x, y, sprint, actionEdge };
  }

  _edge(name, pressed) {
    const was = this._prev[name];
    this._prev[name] = pressed;
    return pressed && !was;
  }
}
