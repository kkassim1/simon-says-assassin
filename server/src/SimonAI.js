const KIDNAP_LOCATIONS = [
  { id: 'docks',     label: 'the Docks',          x: 130,  z: 130  },
  { id: 'alley',     label: 'the Back Alley',      x: -130, z: 70   },
  { id: 'roof',      label: 'the Rooftop',         x: 70,   z: -130 },
  { id: 'warehouse', label: 'the Warehouse',       x: -110, z: -110 },
  { id: 'plaza',     label: 'the Central Plaza',   x: 10,   z: 10   },
  { id: 'bridge',    label: 'the Bridge',          x: 100,  z: -50  },
];

// Generate a task for a single player given the current alive opponents.
// Used in continuous mode whenever a new assignment is needed.
export function generateTaskForPlayer(player, alivePlayers) {
  if (!alivePlayers || alivePlayers.length === 0) return _makeSurviveTask();

  const roll        = Math.random();
  const isSimonSays = Math.random() > 0.15; // 85% real tasks

  if (roll < 0.45) {
    const target = _pick(alivePlayers);
    return {
      type: 'kill',
      targetId: target.id,
      targetName: target.name,
      simonSays: isSimonSays,
      label: isSimonSays
        ? `Simon says: Eliminate ${target.name}`
        : `Eliminate ${target.name}`,
      points: 300,
      trap: !isSimonSays,
    };
  } else if (roll < 0.72) {
    const target = _pick(alivePlayers);
    const loc    = _pick(KIDNAP_LOCATIONS);
    return {
      type: 'kidnap',
      targetId: target.id,
      targetName: target.name,
      locationId: loc.id,
      locationLabel: loc.label,
      locationX: loc.x,
      locationZ: loc.z,
      simonSays: isSimonSays,
      label: isSimonSays
        ? `Simon says: Kidnap ${target.name} and bring them to ${loc.label}`
        : `Kidnap ${target.name} and bring them to ${loc.label}`,
      points: 500,
      trap: !isSimonSays,
    };
  } else {
    return _makeSurviveTask();
  }
}

function _makeSurviveTask() {
  const shuffled = [...KIDNAP_LOCATIONS].sort(() => Math.random() - 0.5).slice(0, 2);
  const waypoints = shuffled.map(loc => ({ x: loc.x, z: loc.z, label: loc.label }));
  return {
    type: 'survive',
    simonSays: true,
    label: `Simon says: Patrol ${waypoints.map(w => w.label).join(' → ')}`,
    points: 200,
    trap: false,
    waypoints,
    currentWaypoint: 0,
  };
}

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export { KIDNAP_LOCATIONS };
