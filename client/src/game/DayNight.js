import * as THREE from 'three';

// Full day→night→day cycle length in seconds. Runs off the shared game clock
// (all clients receive game:start within ms of each other, so the cycle stays
// visually in sync across players).
const PERIOD = 240;

export class DayNight {
  /**
   * palette: { day: {...}, night: {...} } from the map theme
   * (see THEMES in CityMap.js), each with sky/ambient/sun hex colors,
   * ambientIntensity, sunIntensity, and fill intensity.
   */
  constructor(scene, ambient, sun, fill, palette) {
    this.scene = scene;
    this.ambient = ambient;
    this.sun = sun;
    this.fill = fill;

    const parse = (p) => ({
      sky: new THREE.Color(p.sky),
      ambient: new THREE.Color(p.ambient),
      ambientIntensity: p.ambientIntensity,
      sun: new THREE.Color(p.sun),
      sunIntensity: p.sunIntensity,
      fill: p.fill,
    });
    this.day = parse(palette.day);
    this.night = parse(palette.night);

    this._sky = new THREE.Color();
    this._tmp = new THREE.Color();
  }

  /** elapsed: seconds since game start */
  update(elapsed) {
    // 1 at noon, 0 at midnight, smooth transitions
    const dayness = 0.5 + 0.5 * Math.cos((elapsed / PERIOD) * Math.PI * 2);
    const t = 1 - dayness; // 0=day, 1=night
    const { day, night } = this;

    this._sky.copy(day.sky).lerp(night.sky, t);
    this.scene.background = this._sky;
    if (this.scene.fog) this.scene.fog.color.copy(this._sky);

    this.ambient.color.copy(this._tmp.copy(day.ambient).lerp(night.ambient, t));
    this.ambient.intensity = day.ambientIntensity + (night.ambientIntensity - day.ambientIntensity) * t;

    this.sun.color.copy(this._tmp.copy(day.sun).lerp(night.sun, t));
    this.sun.intensity = day.sunIntensity + (night.sunIntensity - day.sunIntensity) * t;

    if (this.fill) this.fill.intensity = day.fill + (night.fill - day.fill) * t;
  }
}
