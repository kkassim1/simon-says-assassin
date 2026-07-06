import { CITY_GRID, CELL } from '../game/CityMap.js';

const SIZE = 168; // canvas px

export class Minimap {
  constructor(container) {
    this.el = document.createElement('canvas');
    this.el.id = 'minimap';
    this.el.width = SIZE;
    this.el.height = SIZE;
    container.appendChild(this.el);
    this.ctx = this.el.getContext('2d');

    this.worldW = CITY_GRID[0].length * CELL;
    this.worldD = CITY_GRID.length * CELL;

    this._base = this._renderBase();
  }

  // Pre-render static city layout once
  _renderBase() {
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext('2d');

    ctx.fillStyle = 'rgba(10, 12, 24, 0.85)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const rows = CITY_GRID.length;
    const cols = CITY_GRID[0].length;
    const cw = SIZE / cols;
    const ch = SIZE / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = CITY_GRID[row][col];
        if (cell === 1) ctx.fillStyle = '#2e2e3c';
        else if (cell === 2) ctx.fillStyle = '#1d4a26';
        else continue; // roads stay background color
        ctx.fillRect(col * cw + 0.5, row * ch + 0.5, cw - 1, ch - 1);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    return c;
  }

  _toMap(x, z) {
    return [
      ((x + this.worldW / 2) / this.worldW) * SIZE,
      ((z + this.worldD / 2) / this.worldD) * SIZE,
    ];
  }

  /**
   * @param {object} me        { x, z, rot }
   * @param {Array}  cops      [{ x, z }]
   * @param {object|null} waypoint  { x, z } current mission location (drop-off / patrol)
   */
  update(me, cops = [], waypoint = null) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(this._base, 0, 0);

    // Mission waypoint (pulsing gold ring)
    if (waypoint) {
      const [wx, wy] = this._toMap(waypoint.x, waypoint.z);
      const pulse = 3.5 + Math.sin(performance.now() / 250) * 1.5;
      ctx.strokeStyle = '#ffce3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffce3a';
      ctx.beginPath();
      ctx.arc(wx, wy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cops (blue dots)
    ctx.fillStyle = '#5dade2';
    for (const cop of cops) {
      const [cx, cy] = this._toMap(cop.x, cop.z);
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Me (white heading triangle)
    const [mx, my] = this._toMap(me.x, me.z);
    ctx.save();
    ctx.translate(mx, my);
    // Player rot is atan2(dx, dz); facing -z (map north) must point up
    ctx.rotate(Math.PI - (me.rot ?? 0));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.6, 4);
    ctx.lineTo(-3.6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  destroy() {
    this.el.remove();
  }
}
