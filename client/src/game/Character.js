import * as THREE from 'three';

const SKIN_COLOR  = 0xf5cba7;
const PANTS_COLOR = 0x1a2535;
const SHOE_COLOR  = 0x111111;

export const PUNCH_DURATION = 0.28; // seconds

/**
 * Builds a humanoid character using pivot groups for limbs so they can be animated.
 * Returns { jacketMat, legL, legR, armL, armR } where armL/armR are inner animation
 * groups (children of shoulder pivots that hold the resting splay rotation).
 */
export function buildCharacter(group, colorHex, hatIdx = 0) {
  const col     = new THREE.Color(colorHex);
  const jacketM = new THREE.MeshLambertMaterial({ color: col });
  const skinM   = new THREE.MeshLambertMaterial({ color: SKIN_COLOR });
  const pantsM  = new THREE.MeshLambertMaterial({ color: PANTS_COLOR });
  const shoeM   = new THREE.MeshLambertMaterial({ color: SHOE_COLOR });

  function add(parent, geo, mat, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    parent.add(m);
    return m;
  }

  const legGeo  = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  const shoeGeo = new THREE.BoxGeometry(0.22, 0.18, 0.36);
  const armGeo  = new THREE.CylinderGeometry(0.085, 0.085, 0.56, 6);
  const handGeo = new THREE.SphereGeometry(0.1, 6, 6);

  // ── Leg pivot groups (pivot at hip, y=0.9) ───────────────────
  // Leg mesh at (0, -0.36, 0) local → world center (-0.16, 0.54, 0) ✓
  // Shoe at (0, -0.81, 0.04) local → world center (-0.16, 0.09, 0.04) ✓
  const legL = new THREE.Group();
  legL.position.set(-0.16, 0.9, 0);
  group.add(legL);
  add(legL, legGeo,  pantsM, 0, -0.36,  0);
  add(legL, shoeGeo, shoeM,  0, -0.81,  0.04);

  const legR = new THREE.Group();
  legR.position.set(0.16, 0.9, 0);
  group.add(legR);
  add(legR, legGeo,  pantsM, 0, -0.36,  0);
  add(legR, shoeGeo, shoeM,  0, -0.81,  0.04);

  // ── Torso ─────────────────────────────────────────────────────
  add(group, new THREE.BoxGeometry(0.5, 0.66, 0.26), jacketM, 0, 1.23, 0);

  // ── Arm pivot groups ──────────────────────────────────────────
  // Outer group: shoulder position + resting outward splay (rotation.z)
  // Inner group: receives animation rotations (x = fwd/back, z = spread offset)
  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.36, 1.50, 0);
  shoulderL.rotation.z = 0.22;
  group.add(shoulderL);
  const armL = new THREE.Group();
  shoulderL.add(armL);
  add(armL, armGeo,  jacketM, 0, -0.28, 0);
  add(armL, handGeo, skinM,   0, -0.56, 0, false);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.36, 1.50, 0);
  shoulderR.rotation.z = -0.22;
  group.add(shoulderR);
  const armR = new THREE.Group();
  shoulderR.add(armR);
  add(armR, armGeo,  jacketM, 0, -0.28, 0);
  add(armR, handGeo, skinM,   0, -0.56, 0, false);

  // ── Neck ──────────────────────────────────────────────────────
  add(group, new THREE.CylinderGeometry(0.1, 0.12, 0.16, 6), skinM, 0, 1.64, 0, false);

  // ── Head ──────────────────────────────────────────────────────
  add(group, new THREE.SphereGeometry(0.27, 8, 8), skinM, 0, 1.99, 0);

  const eyeM   = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.SphereGeometry(0.052, 5, 5);
  add(group, eyeGeo, eyeM, -0.1, 2.02, 0.23, false);
  add(group, eyeGeo, eyeM,  0.1, 2.02, 0.23, false);

  // ── Hat ───────────────────────────────────────────────────────
  _addHat(group, hatIdx % 4, col);

  return { jacketMat: jacketM, legL, legR, armL, armR };
}

/**
 * Drives limb rotations each frame.
 * state: 'idle' | 'walk' | 'sprint' | 'drag' | 'captured'
 * punchProgress: 0 = no punch, 0→1 = punch in progress (applied on top of state)
 */
export function animateCharacter(limbs, animTime, state, punchProgress = 0) {
  const { legL, legR, armL, armR } = limbs;

  // Reset z-spread each frame (captured is the only state that changes it)
  armL.rotation.z = 0;
  armR.rotation.z = 0;

  switch (state) {
    case 'walk': {
      const t   = animTime * Math.PI * 5;   // ~2.5 steps/s
      legL.rotation.x =  Math.sin(t) * 0.5;
      legR.rotation.x = -Math.sin(t) * 0.5;
      armL.rotation.x =  Math.sin(t) * 0.4;
      armR.rotation.x = -Math.sin(t) * 0.4;
      break;
    }
    case 'sprint': {
      const t   = animTime * Math.PI * 8;   // ~4 steps/s, bigger swing
      legL.rotation.x =  Math.sin(t) * 0.7;
      legR.rotation.x = -Math.sin(t) * 0.7;
      armL.rotation.x =  Math.sin(t) * 0.55;
      armR.rotation.x = -Math.sin(t) * 0.55;
      break;
    }
    case 'drag': {
      // Dragging victim — arms reach forward, legs keep walking
      const t = animTime * Math.PI * 5;
      legL.rotation.x =  Math.sin(t) * 0.45;
      legR.rotation.x = -Math.sin(t) * 0.45;
      armL.rotation.x = -0.85 + Math.sin(animTime * Math.PI * 7) * 0.06;
      armR.rotation.x = -0.85 + Math.sin(animTime * Math.PI * 7 + 0.5) * 0.06;
      break;
    }
    case 'captured': {
      // Being dragged — arms raised and flailing, legs limp
      const t = animTime * Math.PI * 9;
      armL.rotation.x = -0.5 + Math.sin(t) * 0.12;
      armR.rotation.x = -0.5 + Math.sin(t + 1.0) * 0.12;
      armL.rotation.z =  0.55 + Math.sin(t * 0.7) * 0.1;
      armR.rotation.z = -0.55 - Math.sin(t * 0.7) * 0.1;
      legL.rotation.x =  Math.sin(t * 0.5) * 0.25;
      legR.rotation.x = -Math.sin(t * 0.5) * 0.25;
      break;
    }
    default: { // idle
      const t = animTime * 1.6;   // slow breathing sway
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x =  Math.sin(t) * 0.04;
      armR.rotation.x = -Math.sin(t) * 0.04;
      break;
    }
  }

  // Punch: right arm lunges forward then snaps back — overlays on top of state
  if (punchProgress > 0) {
    const p     = punchProgress;          // 0 = start, 1 = done
    const reach = p < 0.45
      ? -1.5 * (p / 0.45)                // swing forward
      : -1.5 * (1 - (p - 0.45) / 0.55); // snap back
    armR.rotation.x = reach;
  }
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
      add(new THREE.SphereGeometry(0.30, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), colM, 0, 1.99, 0);
      add(new THREE.SphereGeometry(0.075, 6, 6), whiteM, 0, 2.32, 0);
      break;
    case 2: // Brown fedora
      add(new THREE.CylinderGeometry(0.37, 0.37, 0.05, 8), brownM, 0, 2.23, 0);
      add(new THREE.CylinderGeometry(0.20, 0.25, 0.26, 8), brownM, 0, 2.36, 0);
      break;
    case 3: // Hood (player color)
      add(new THREE.SphereGeometry(0.31, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), colM, 0, 1.99, -0.04);
      break;
  }
}
