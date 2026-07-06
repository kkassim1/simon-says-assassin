import * as THREE from 'three';

const STYLE = {
  speed:  { color: 0x00e5ff, geo: () => new THREE.ConeGeometry(0.55, 1.1, 4) },
  radar:  { color: 0x39ff6a, geo: () => new THREE.TorusGeometry(0.55, 0.16, 8, 18) },
  points: { color: 0xffd23a, geo: () => new THREE.OctahedronGeometry(0.62) },
};

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // id -> { mesh, type, x, z, pending }
    this._t = 0;
  }

  spawn({ id, x, z, type }) {
    if (this.items.has(id)) return;
    const style = STYLE[type] || STYLE.points;
    const mat = new THREE.MeshLambertMaterial({
      color: style.color,
      emissive: new THREE.Color(style.color).multiplyScalar(0.45),
    });
    const mesh = new THREE.Mesh(style.geo(), mat);
    mesh.position.set(x, 1.2, z);

    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.0, 20),
      new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(x, 0.06, z);

    this.scene.add(mesh);
    this.scene.add(glow);
    this.items.set(id, { mesh, glow, type, x, z, pending: false });
  }

  remove(id) {
    const item = this.items.get(id);
    if (!item) return;
    this.scene.remove(item.mesh);
    this.scene.remove(item.glow);
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();
    item.glow.geometry.dispose();
    item.glow.material.dispose();
    this.items.delete(id);
  }

  /** Bob/spin animation + return the id of a pickup within collectRange of pos (once). */
  update(delta, pos = null, collectRange = 2.5) {
    this._t += delta;
    let hit = null;
    for (const [id, item] of this.items) {
      item.mesh.rotation.y += delta * 2.2;
      item.mesh.position.y = 1.2 + Math.sin(this._t * 2.5 + item.x) * 0.25;
      // Retry after 1.5s in case the server rejected the collect (arrested, dragged, lag)
      if (item.pending && this._t - item.pendingAt > 1.5) item.pending = false;
      if (hit === null && pos && !item.pending) {
        const dx = pos.x - item.x, dz = pos.z - item.z;
        if (dx * dx + dz * dz < collectRange * collectRange) {
          item.pending = true; // don't re-send while waiting for the server
          item.pendingAt = this._t;
          hit = id;
        }
      }
    }
    return hit;
  }

  dispose() {
    for (const id of [...this.items.keys()]) this.remove(id);
  }
}
