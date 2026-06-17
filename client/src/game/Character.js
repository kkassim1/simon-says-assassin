import * as THREE from 'three';

const SKIN_COLOR  = 0xf5cba7;
const PANTS_COLOR = 0x1a2535;
const SHOE_COLOR  = 0x111111;

/**
 * Builds a humanoid character into `group` using the given player color.
 * hatIdx 0-3 gives each player a distinct hat silhouette.
 * Returns the jacket MeshLambertMaterial so callers can flash it on damage.
 */
export function buildCharacter(group, colorHex, hatIdx = 0) {
  const col     = new THREE.Color(colorHex);
  const jacketM = new THREE.MeshLambertMaterial({ color: col });
  const skinM   = new THREE.MeshLambertMaterial({ color: SKIN_COLOR });
  const pantsM  = new THREE.MeshLambertMaterial({ color: PANTS_COLOR });
  const shoeM   = new THREE.MeshLambertMaterial({ color: SHOE_COLOR });

  function mesh(geo, mat, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) { m.castShadow = true; m.receiveShadow = false; }
    group.add(m);
    return m;
  }

  // ── Shoes ───────────────────────────────────────
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.18, 0.36);
  mesh(shoeGeo, shoeM, -0.16, 0.09, 0.04);
  mesh(shoeGeo, shoeM,  0.16, 0.09, 0.04);

  // ── Legs ────────────────────────────────────────
  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  mesh(legGeo, pantsM, -0.16, 0.54, 0);
  mesh(legGeo, pantsM,  0.16, 0.54, 0);

  // ── Torso / jacket ──────────────────────────────
  mesh(new THREE.BoxGeometry(0.5, 0.66, 0.26), jacketM, 0, 1.23, 0);

  // ── Arms ────────────────────────────────────────
  const armGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.56, 6);
  const armL = mesh(armGeo, jacketM, -0.36, 1.22, 0);
  armL.rotation.z = 0.22;
  const armR = mesh(armGeo, jacketM,  0.36, 1.22, 0);
  armR.rotation.z = -0.22;

  // Hands
  const handGeo = new THREE.SphereGeometry(0.1, 6, 6);
  mesh(handGeo, skinM, -0.4, 0.96, 0, false);
  mesh(handGeo, skinM,  0.4, 0.96, 0, false);

  // ── Neck ────────────────────────────────────────
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 6), skinM, 0, 1.64, 0, false);

  // ── Head ────────────────────────────────────────
  mesh(new THREE.SphereGeometry(0.27, 8, 8), skinM, 0, 1.99, 0);

  // Eyes
  const eyeM   = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.SphereGeometry(0.052, 5, 5);
  mesh(eyeGeo, eyeM, -0.1, 2.02, 0.23, false);
  mesh(eyeGeo, eyeM,  0.1, 2.02, 0.23, false);

  // ── Hat (4 styles, one per player slot) ─────────
  _addHat(group, hatIdx % 4, col);

  return jacketM;
}

function _addHat(group, style, playerColor) {
  const darkM  = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const brownM = new THREE.MeshLambertMaterial({ color: 0x3d2b1f });
  const colM   = new THREE.MeshLambertMaterial({ color: playerColor });
  const whiteM = new THREE.MeshLambertMaterial({ color: 0xffffff });

  function add(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
  }

  switch (style) {
    case 0: // Black baseball cap + peak
      add(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 8), darkM, 0, 2.24, 0);
      add(new THREE.CylinderGeometry(0.20, 0.28, 0.20, 8), darkM, 0, 2.34, 0);
      add(new THREE.BoxGeometry(0.28, 0.04, 0.2),           darkM, 0, 2.23, 0.24);
      break;

    case 1: // Beanie (player color) with white pom
      add(
        new THREE.SphereGeometry(0.30, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        colM, 0, 1.99, 0
      );
      add(new THREE.SphereGeometry(0.075, 6, 6), whiteM, 0, 2.32, 0);
      break;

    case 2: // Brown fedora
      add(new THREE.CylinderGeometry(0.37, 0.37, 0.05, 8), brownM, 0, 2.23, 0);
      add(new THREE.CylinderGeometry(0.20, 0.25, 0.26, 8), brownM, 0, 2.36, 0);
      break;

    case 3: // Hood (player color, slightly behind head)
      add(
        new THREE.SphereGeometry(0.31, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
        colM, 0, 1.99, -0.04
      );
      break;
  }
}
