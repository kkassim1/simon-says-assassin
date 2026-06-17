import { v4 as uuidv4 } from 'uuid';
import { generateTaskForPlayer, KIDNAP_LOCATIONS } from './SimonAI.js';

const LOBBY_COUNTDOWN = 5;
const GAME_DURATION   = 600;   // 10 minutes
const RESPAWN_DELAY   = 15;    // seconds before respawn
const RESPAWN_PENALTY = 50;    // points deducted on death
const MAX_PLAYERS     = 4;
const MAX_HP          = 3;
const WITNESS_RANGE   = 30;
const COP_SPEED       = 12;    // faster than walk (10), slower than sprint (17)
const COP_CATCH_RANGE = 3.5;
const ARREST_DURATION = 30;    // seconds player is frozen
const COP_TICK_MS     = 150;   // ms between cop position updates

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const PLAYER_NAMES  = ['Ghost', 'Viper', 'Raven', 'Cobra', 'Shade', 'Frost', 'Dagger', 'Storm'];

const SPAWN_POINTS = [
  { x:  20, z:  20 },
  { x: -20, z:  20 },
  { x:  20, z: -20 },
  { x: -20, z: -20 },
];

export class GameRoom {
  constructor(io, roomCode) {
    this.io       = io;
    this.roomCode = roomCode;
    this.players  = new Map();
    this.state    = 'lobby';

    this.tasks          = {};
    this.scores         = {};
    this.aliveStatus    = {};
    this.capturedStatus = {};
    this.playerHp       = {};
    this.wantedLevel    = {};
    this.bountyTarget   = null;
    this.allies         = {};

    this.gameTimer = null;

    this.activeCops      = new Map();  // copId -> { id, x, z, targetId }
    this.arrestedPlayers = {};          // playerId -> true while arrested
    this._copInterval    = null;
  }

  // ── Lobby ────────────────────────────────────────

  addPlayer(socket, playerName) {
    if (this.players.size >= MAX_PLAYERS || this.state !== 'lobby') return false;
    const idx = this.players.size;
    const player = {
      id: socket.id,
      name: playerName || PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)],
      color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
      spawnIdx: idx,
      x: SPAWN_POINTS[idx].x, y: 0, z: SPAWN_POINTS[idx].z,
      rot: 0, isBot: false,
    };
    this.players.set(socket.id, player);
    this.scores[socket.id] = 0;
    socket.join(this.roomCode);
    this.broadcastLobbyState();
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    delete this.scores[socketId];
    delete this.tasks[socketId];
    if (this.players.size === 0) { this.cleanup(); return; }
    this.broadcastLobbyState();
  }

  broadcastLobbyState() {
    this.io.to(this.roomCode).emit('lobby:update', {
      players: this.getPlayerList(), roomCode: this.roomCode, state: this.state,
    });
  }

  getPlayerList() { return Array.from(this.players.values()); }

  // ── Game start ───────────────────────────────────

  startGame() {
    if (this.state !== 'lobby') return;
    this.state = 'countdown';
    this._fillBots();
    this.io.to(this.roomCode).emit('game:countdown', { seconds: LOBBY_COUNTDOWN });
    setTimeout(() => this._startContinuous(), LOBBY_COUNTDOWN * 1000);
  }

  _fillBots() {
    const needed = Math.max(0, MAX_PLAYERS - this.players.size);
    for (let i = 0; i < needed; i++) {
      const botId = `bot_${uuidv4().slice(0, 8)}`;
      const idx   = this.players.size;
      this.players.set(botId, {
        id: botId,
        name: PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)],
        color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
        spawnIdx: idx,
        x: SPAWN_POINTS[idx % SPAWN_POINTS.length].x, y: 0,
        z: SPAWN_POINTS[idx % SPAWN_POINTS.length].z,
        rot: 0, isBot: true,
      });
      this.scores[botId] = 0;
    }
  }

  _startContinuous() {
    const players = this.getPlayerList();

    for (const p of players) {
      this.aliveStatus[p.id]    = true;
      this.capturedStatus[p.id] = null;
      this.playerHp[p.id]       = MAX_HP;
      this.wantedLevel[p.id]    = 0;
      const sp = SPAWN_POINTS[p.spawnIdx % SPAWN_POINTS.length];
      p.x = sp.x; p.z = sp.z;
    }

    for (const p of players) {
      this.tasks[p.id] = this._generateTask(p.id);
    }

    // Assign secret allies among real players
    this.allies = {};
    const real = players.filter(p => !p.isBot);
    if (real.length >= 2) {
      const s = [...real].sort(() => Math.random() - 0.5);
      this.allies[s[0].id] = s[1].id;
      this.allies[s[1].id] = s[0].id;
    }

    this._updateBounty();
    this.state = 'playing';

    this.io.to(this.roomCode).emit('game:start', {
      duration: GAME_DURATION,
      tasks: this.tasks,
      players,
      scores: this.scores,
      allies: this.allies,
      bountyTarget: this.bountyTarget,
      maxHp: MAX_HP,
    });

    this._startBotAI();
    this.gameTimer = setTimeout(() => this.endGame(), GAME_DURATION * 1000);
  }

  // ── Movement ─────────────────────────────────────

  movePlayer(socketId, data) {
    const p = this.players.get(socketId);
    if (!p || this.state !== 'playing') return;
    if (this.arrestedPlayers[socketId]) return;
    p.x = data.x; p.y = data.y; p.z = data.z; p.rot = data.rot;
    this.io.to(this.roomCode).emit('player:move', { id: socketId, x: p.x, y: p.y, z: p.z, rot: p.rot });
  }

  // ── Actions ──────────────────────────────────────

  attemptKill(attackerId, targetId) {
    if (this.state !== 'playing') return;
    if (!this.aliveStatus[attackerId] || !this.aliveStatus[targetId]) return;

    const task        = this.tasks[attackerId];
    const attackerName = this.players.get(attackerId)?.name;
    const targetName   = this.players.get(targetId)?.name;

    if (task && task.type === 'kill' && task.targetId === targetId) {
      if (task.trap) {
        this.scores[attackerId] = Math.max(0, (this.scores[attackerId] || 0) - 200);
        this.io.to(this.roomCode).emit('game:event', {
          type: 'trap_triggered', actorId: attackerId, actorName: attackerName,
          message: `${attackerName} fell for Simon's trap! -200 pts`,
        });
        setTimeout(() => this._assignNewTask(attackerId), 600);
        return;
      }

      this.playerHp[targetId] = Math.max(0, (this.playerHp[targetId] ?? MAX_HP) - 1);
      const isBetrayal = this.allies[attackerId] === targetId;

      if (this.playerHp[targetId] <= 0) {
        let bonus = 0;
        if (isBetrayal)                        bonus += 400;
        if (this.bountyTarget === targetId)    bonus += 200;
        bonus += (this.wantedLevel[targetId] || 0) * 100;
        const total = task.points + bonus;

        this.scores[attackerId] = (this.scores[attackerId] || 0) + total;

        this.io.to(this.roomCode).emit('game:event', {
          type: isBetrayal ? 'betrayal_kill' : 'player_killed',
          actorId: attackerId, targetId,
          actorName: attackerName, targetName,
          message: isBetrayal
            ? `BETRAYAL! ${attackerName} turned on ally ${targetName}! +${total} pts`
            : `${attackerName} eliminated ${targetName}!${bonus > 0 ? ' BONUS!' : ''} +${total} pts`,
          scores: this.scores,
        });

        this._checkWanted(attackerId);
        this._updateBounty();
        this.io.to(this.roomCode).emit('player:bounty', { bountyTarget: this.bountyTarget });
        this._handleDeath(targetId);
        setTimeout(() => this._assignNewTask(attackerId), 600);
      } else {
        this.io.to(this.roomCode).emit('game:event', {
          type: 'player_damaged',
          actorId: attackerId, targetId,
          actorName: attackerName, targetName,
          hp: this.playerHp[targetId], maxHp: MAX_HP,
          message: `${attackerName} hit ${targetName}! (${this.playerHp[targetId]}/${MAX_HP} HP)`,
        });
      }
    } else {
      this.scores[attackerId] = Math.max(0, (this.scores[attackerId] || 0) - 100);
      this.io.to(this.roomCode).emit('game:event', {
        type: 'wrong_target', actorId: attackerId,
        message: `${attackerName} hit the wrong target! -100 pts`,
      });
    }
  }

  startKidnap(attackerId, targetId) {
    if (this.state !== 'playing') return;
    if (!this.aliveStatus[attackerId] || !this.aliveStatus[targetId]) return;
    if (this.capturedStatus[targetId]) return;

    const task        = this.tasks[attackerId];
    const attackerName = this.players.get(attackerId)?.name;
    const targetName   = this.players.get(targetId)?.name;

    if (!task || task.type !== 'kidnap' || task.targetId !== targetId) {
      this.scores[attackerId] = Math.max(0, (this.scores[attackerId] || 0) - 100);
      return;
    }
    if (task.trap) {
      this.scores[attackerId] = Math.max(0, (this.scores[attackerId] || 0) - 200);
      this.io.to(this.roomCode).emit('game:event', {
        type: 'trap_triggered', actorId: attackerId, actorName: attackerName,
        message: `${attackerName} fell for Simon's trap! -200 pts`,
      });
      setTimeout(() => this._assignNewTask(attackerId), 600);
      return;
    }

    this.capturedStatus[targetId] = attackerId;
    this.io.to(this.roomCode).emit('game:event', {
      type: 'kidnap_started', actorId: attackerId, targetId,
      actorName: attackerName, targetName,
      message: `${attackerName} grabbed ${targetName}!`,
    });
  }

  completeKidnap(attackerId) {
    if (this.state !== 'playing') return;
    const task = this.tasks[attackerId];
    if (!task || task.type !== 'kidnap') return;
    const targetId = task.targetId;
    if (this.capturedStatus[targetId] !== attackerId) return;

    this.scores[attackerId] = (this.scores[attackerId] || 0) + task.points;
    this.capturedStatus[targetId] = null;

    this.io.to(this.roomCode).emit('game:event', {
      type: 'kidnap_complete', actorId: attackerId, targetId,
      actorName: this.players.get(attackerId)?.name,
      targetName: this.players.get(targetId)?.name,
      message: `${this.players.get(attackerId)?.name} delivered ${this.players.get(targetId)?.name}! +${task.points} pts`,
      scores: this.scores,
    });

    this._checkWanted(attackerId);
    this._updateBounty();
    this.io.to(this.roomCode).emit('player:bounty', { bountyTarget: this.bountyTarget });
    this._handleDeath(targetId);
    setTimeout(() => this._assignNewTask(attackerId), 600);
  }

  breakFree(playerId) {
    if (!this.capturedStatus[playerId]) return;
    if (Math.random() < 0.5) {
      this.io.to(this.roomCode).emit('game:event', {
        type: 'escape_attempt', targetId: playerId,
        message: `${this.players.get(playerId)?.name} is struggling!`,
      });
      return;
    }
    this.capturedStatus[playerId] = null;
    this.io.to(this.roomCode).emit('game:event', {
      type: 'escaped', targetId: playerId,
      targetName: this.players.get(playerId)?.name,
      message: `${this.players.get(playerId)?.name} broke free!`,
    });
  }

  // ── Death & Respawn ──────────────────────────────

  _handleDeath(targetId) {
    this.aliveStatus[targetId]    = false;
    this.capturedStatus[targetId] = null;

    // Reassign tasks for anyone who had this player as their target
    for (const [pid, task] of Object.entries(this.tasks)) {
      if (task.targetId === targetId && this.aliveStatus[pid]) {
        setTimeout(() => this._assignNewTask(pid), 800);
      }
    }

    this._scheduleRespawn(targetId);
  }

  _scheduleRespawn(playerId) {
    this.io.to(this.roomCode).emit('player:dying', {
      playerId, respawnIn: RESPAWN_DELAY,
      playerName: this.players.get(playerId)?.name,
    });

    setTimeout(() => {
      if (this.state !== 'playing') return;

      this.scores[playerId] = Math.max(0, (this.scores[playerId] || 0) - RESPAWN_PENALTY);
      this.playerHp[playerId]    = MAX_HP;
      this.aliveStatus[playerId] = true;
      this.wantedLevel[playerId] = Math.max(0, (this.wantedLevel[playerId] || 0) - 1);

      const p  = this.players.get(playerId);
      const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
      if (p) { p.x = sp.x; p.z = sp.z; }

      this.io.to(this.roomCode).emit('player:respawn', {
        playerId, x: sp.x, z: sp.z, scores: this.scores,
      });

      setTimeout(() => this._assignNewTask(playerId), 300);
    }, RESPAWN_DELAY * 1000);
  }

  // ── Task assignment ──────────────────────────────

  _generateTask(playerId) {
    const player       = this.players.get(playerId);
    const alivePlayers = this.getPlayerList()
      .filter(p => p.id !== playerId && this.aliveStatus[p.id] !== false);
    if (player?.isBot) {
      const realAlive = alivePlayers.filter(p => !p.isBot);
      if (realAlive.length > 0 && Math.random() < 0.75) {
        return generateTaskForPlayer(player, realAlive);
      }
    }
    return generateTaskForPlayer(player, alivePlayers);
  }

  _assignNewTask(playerId) {
    if (this.state !== 'playing') return;
    if (!this.aliveStatus[playerId]) return;
    const task = this._generateTask(playerId);
    this.tasks[playerId] = task;
    this.io.to(this.roomCode).emit('task:assigned', {
      playerId, task,
      playerName: this.players.get(playerId)?.name,
    });
  }

  // ── Helpers ──────────────────────────────────────

  _checkWanted(attackerId) {
    const attacker = this.players.get(attackerId);
    if (!attacker) return;
    let witnesses = 0;
    for (const [id, p] of this.players) {
      if (id === attackerId || !this.aliveStatus[id]) continue;
      const dx = p.x - attacker.x, dz = p.z - attacker.z;
      if (Math.sqrt(dx * dx + dz * dz) < WITNESS_RANGE) witnesses++;
    }
    if (witnesses > 0) {
      this.wantedLevel[attackerId] = Math.min(3, (this.wantedLevel[attackerId] || 0) + 1);
      this.io.to(this.roomCode).emit('player:wanted', {
        playerId: attackerId,
        playerName: attacker.name,
        level: this.wantedLevel[attackerId],
      });
    }
  }

  _updateBounty() {
    const prevTarget = this.bountyTarget;
    let topId = null, topScore = -1, secondScore = -1;
    for (const [id, score] of Object.entries(this.scores)) {
      if (score > topScore)         { secondScore = topScore; topScore = score; topId = id; }
      else if (score > secondScore) { secondScore = score; }
    }
    this.bountyTarget = (topScore >= 300 && topScore - secondScore >= 300) ? topId : null;

    if (this.bountyTarget && this.bountyTarget !== prevTarget) {
      this._spawnCop(this.bountyTarget);
    } else if (!this.bountyTarget && prevTarget) {
      this._despawnAllCops();
    }
  }

  // ── Cop AI ───────────────────────────────────────

  _spawnCop(targetId) {
    for (const cop of this.activeCops.values()) {
      if (cop.targetId === targetId) return;
    }
    const target = this.players.get(targetId);
    const spawnX = target ? (target.x > 0 ? -120 : 120) : 0;
    const spawnZ = target ? (target.z > 0 ? -120 : 120) : 0;
    const copId  = `cop_${uuidv4().slice(0, 8)}`;
    this.activeCops.set(copId, { id: copId, x: spawnX, z: spawnZ, targetId });

    this.io.to(this.roomCode).emit('cop:spawned', {
      copId, x: spawnX, z: spawnZ,
      targetId, targetName: target?.name || '?',
    });

    if (!this._copInterval) {
      this._copInterval = setInterval(() => this._tickCops(), COP_TICK_MS);
    }
  }

  _tickCops() {
    if (this.state !== 'playing') return;
    const dt = COP_TICK_MS / 1000;

    for (const [copId, cop] of this.activeCops) {
      if (this.arrestedPlayers[cop.targetId]) continue;

      const target = this.players.get(cop.targetId);
      if (!target || !this.aliveStatus[cop.targetId]) {
        this._despawnCop(copId);
        continue;
      }

      const dx = target.x - cop.x;
      const dz = target.z - cop.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < COP_CATCH_RANGE) {
        this._arrestPlayer(cop.targetId, copId);
      } else {
        cop.x += (dx / dist) * COP_SPEED * dt;
        cop.z += (dz / dist) * COP_SPEED * dt;
        this.io.to(this.roomCode).emit('cop:move', { copId, x: cop.x, z: cop.z });
      }
    }
  }

  _arrestPlayer(playerId, copId) {
    if (this.arrestedPlayers[playerId]) return;
    this.arrestedPlayers[playerId] = true;
    this.bountyTarget = null;

    this.io.to(this.roomCode).emit('player:bounty', { bountyTarget: null });
    this.io.to(this.roomCode).emit('player:arrested', {
      playerId,
      playerName: this.players.get(playerId)?.name,
      duration: ARREST_DURATION,
    });

    this._despawnCop(copId);

    setTimeout(() => {
      if (this.state !== 'playing') return;
      delete this.arrestedPlayers[playerId];
      this.io.to(this.roomCode).emit('player:released', { playerId });
    }, ARREST_DURATION * 1000);
  }

  _despawnCop(copId) {
    this.activeCops.delete(copId);
    this.io.to(this.roomCode).emit('cop:despawned', { copId });
    if (this.activeCops.size === 0 && this._copInterval) {
      clearInterval(this._copInterval);
      this._copInterval = null;
    }
  }

  _despawnAllCops() {
    for (const copId of this.activeCops.keys()) {
      this.io.to(this.roomCode).emit('cop:despawned', { copId });
    }
    this.activeCops.clear();
    if (this._copInterval) {
      clearInterval(this._copInterval);
      this._copInterval = null;
    }
  }

  // ── Bot AI ───────────────────────────────────────

  _startBotAI() {
    for (const [id, player] of this.players) {
      if (player.isBot) this._botTick(id, 5000 + Math.random() * 10000);
    }
  }

  _botTick(botId, delay = 10000) {
    setTimeout(() => {
      if (this.state !== 'playing' || !this.players.has(botId)) return;
      if (!this.aliveStatus[botId]) { this._botTick(botId, 3000); return; }

      const task = this.tasks[botId];
      if (!task || task.trap || !task.targetId || !this.aliveStatus[task.targetId]) {
        this._botTick(botId, 4000);
        return;
      }

      if (task.type === 'kill') {
        this.attemptKill(botId, task.targetId);
      } else if (task.type === 'kidnap') {
        this.startKidnap(botId, task.targetId);
        setTimeout(() => { if (this.state === 'playing') this.completeKidnap(botId); },
          6000 + Math.random() * 5000);
      }

      this._botTick(botId, 10000 + Math.random() * 12000);
    }, delay);
  }

  // ── End game ─────────────────────────────────────

  endGame() {
    this.state = 'ended';
    clearTimeout(this.gameTimer);
    this._despawnAllCops();

    const sorted = Array.from(this.players.values())
      .map(p => ({ ...p, score: this.scores[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);

    this.io.to(this.roomCode).emit('game:end', { leaderboard: sorted, winner: sorted[0] });
  }

  cleanup() { clearTimeout(this.gameTimer); this._despawnAllCops(); }
}
