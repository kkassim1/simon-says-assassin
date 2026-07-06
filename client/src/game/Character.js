import * as THREE from 'three';

const SKIN_COLOR  = 0xf5cba7;
const PANTS_COLOR = 0x1a2535;
const SHOE_COLOR  = 0x111111;
const HAIR_COLORS = [0x1b120d, 0x2b1b12, 0x5a341f, 0x111111];

export const PUNCH_DURATION = 0.28; // seconds

/**
 * Builds a humanoid character using pivot groups for limbs so they can be animated.
 * Returns { jacketMat, legL, legR, armL, armR } where armL/armR are inner animation
 * groups (children of shoulder pivots that hold the resting splay rotation).
 */
export function buildCharacter(group, colorHex, hatIdx = 0) {
  const col     = new THREE.Color(colorHex);
  const jacketM = humanMaterial(col, 0.7, 0.45);
  const shirtM  = humanMaterial(col.clone().offsetHSL(0, -0.16, 0.16), 0.68, 0.5);
  const skinM   = humanMaterial(SKIN_COLOR, 0.78, 0.45);
  const pantsM  = humanMaterial(PANTS_COLOR, 0.82, 0.42);
  const shoeM   = humanMaterial(SHOE_COLOR, 0.55, 0.35);
  const hairM   = humanMaterial(HAIR_COLORS[hatIdx % HAIR_COLORS.length], 0.8, 0.5);

  function add(parent, geo, mat, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    parent.add(m);
    return m;
  }

  const legGeo  = new THREE.CapsuleGeometry(0.095, 0.56, 4, 10);
  const shoeGeo = new THREE.BoxGeometry(0.23, 0.13, 0.4);
  const armGeo  = new THREE.CapsuleGeometry(0.075, 0.44, 4, 10);
  const handGeo = new THREE.SphereGeometry(0.095, 10, 8);

  // Leg pivot groups (pivot at hip, y=0.9).
  const legL = new THREE.Group();
  legL.position.set(-0.16, 0.9, 0);
  group.add(legL);
  add(legL, legGeo,  pantsM, 0, -0.36,  0);
  const shoeL = add(legL, shoeGeo, shoeM,  0, -0.79,  0.08);
  shoeL.rotation.x = -0.08;

  const legR = new THREE.Group();
  legR.position.set(0.16, 0.9, 0);
  group.add(legR);
  add(legR, legGeo,  pantsM, 0, -0.36,  0);
  const shoeR = add(legR, shoeGeo, shoeM,  0, -0.79,  0.08);
  shoeR.rotation.x = -0.08;

  // Torso, hips, and a simple layered outfit.
  add(group, new THREE.CapsuleGeometry(0.28, 0.34, 4, 14), jacketM, 0, 1.24, 0);
  add(group, new THREE.BoxGeometry(0.36, 0.34, 0.04), shirtM, 0, 1.25, 0.18, false);
  add(group, new THREE.BoxGeometry(0.42, 0.13, 0.25), pantsM, 0, 0.87, 0);

  // Arm pivot groups: outer group handles shoulder splay, inner group animates.
  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.36, 1.50, 0);
  shoulderL.rotation.z = 0.22;
  group.add(shoulderL);
  const armL = new THREE.Group();
  shoulderL.add(armL);
  add(armL, armGeo,  jacketM, 0, -0.27, 0);
  add(armL, handGeo, skinM,   0, -0.54, 0, false);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.36, 1.50, 0);
  shoulderR.rotation.z = -0.22;
  group.add(shoulderR);
  const armR = new THREE.Group();
  shoulderR.add(armR);
  add(armR, armGeo,  jacketM, 0, -0.27, 0);
  add(armR, handGeo, skinM,   0, -0.54, 0, false);

  // Neck and head.
  add(group, new THREE.CylinderGeometry(0.085, 0.105, 0.18, 10), skinM, 0, 1.66, 0, false);
  add(group, new THREE.SphereGeometry(0.255, 18, 14), skinM, 0, 1.96, 0);

  const hair = add(group, new THREE.SphereGeometry(0.262, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairM, 0, 2.04, -0.02);
  hair.scale.set(1.04, 0.74, 1.0);
  add(group, new THREE.SphereGeometry(0.055, 8, 6), skinM, -0.265, 1.96, 0, false);
  add(group, new THREE.SphereGeometry(0.055, 8, 6), skinM,  0.265, 1.96, 0, false);

  const eyeM   = new THREE.MeshBasicMaterial({ color: 0x141414 });
  const browM  = humanMaterial(hairM.color, 0.8, 0.5);
  const mouthM = new THREE.MeshBasicMaterial({ color: 0x7a2c2c });
  const eyeGeo = new THREE.SphereGeometry(0.032, 8, 6);
  add(group, eyeGeo, eyeM, -0.085, 1.99, 0.235, false);
  add(group, eyeGeo, eyeM,  0.085, 1.99, 0.235, false);
  add(group, new THREE.BoxGeometry(0.095, 0.018, 0.012), browM, -0.085, 2.065, 0.24, false).rotation.z = 0.1;
  add(group, new THREE.BoxGeometry(0.095, 0.018, 0.012), browM,  0.085, 2.065, 0.24, false).rotation.z = -0.1;
  const nose = add(group, new THREE.ConeGeometry(0.035, 0.095, 8), skinM, 0, 1.94, 0.265, false);
  nose.rotation.x = Math.PI / 2;
  add(group, new THREE.BoxGeometry(0.12, 0.018, 0.012), mouthM, 0, 1.84, 0.245, false);

  _addHat(group, hatIdx % 4, col);

  return { jacketMat: jacketM, legL, legR, armL, armR };
}

function humanMaterial(color, roughness = 0.72, metalness = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: metalness * 0.04,
  });
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
  const darkM  = humanMaterial(0x111111, 0.65, 0.4);
  const brownM = humanMaterial(0x3d2b1f, 0.78, 0.3);
  const colM   = humanMaterial(playerColor, 0.72, 0.35);
  const whiteM = humanMaterial(0xffffff, 0.85, 0.25);

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
