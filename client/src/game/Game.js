import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildCity, setCityGrid, setCityTheme, getCityTheme, hideSpotsFromGrid } from './CityMap.js';
import { PlayerController, setBuildingBoxes } from './PlayerController.js';
import { RemotePlayer, refreshHideSpots } from './RemotePlayer.js';
import { DayNight } from './DayNight.js';
import { createNPCs, setNPCBuildingBoxes } from './NPC.js';
import { TrafficSystem } from './TrafficSystem.js';
import { Pickups } from './Pickups.js';
import { HUD } from '../ui/HUD.js';
import { SoundManager } from './SoundManager.js';
import { settingsStore } from '../ui/Settings.js';

const ACTION_RANGE        = 3.5;
// Hide timings — mirror server/src/GameRoom.js
const HIDE_DURATION_MS = 7000;
const HIDE_COOLDOWN_MS = 8000;
const KIDNAP_DELIVER_RANGE = 4;
const MOVE_EMIT_RATE      = 50;

export class Game {
  constructor(network, myId, playerList, container, onLeaveMatch = null, map = null) {
    this.network   = network;
    this.myId      = myId;
    this.container = container;
    this.onLeaveMatch = onLeaveMatch;
    this.map       = map;

    this.scene         = null;
    this.renderer      = null;
    this.player        = null;
    this.remotePlayers = new Map();
    this.npcs          = [];
    this.hud           = null;
    this.sounds        = new SoundManager(settingsStore);
    this.settings      = settingsStore.get();
    this.composer      = null;
    this.bloomPass     = null;
    this._unsubscribeSettings = null;

    this.myTask           = null;
    this.scores           = {};
    this.gameActive       = false;
    this.kidnappingTarget = null;

    this.myHp            = 3;
    this.myMaxHp         = 3;
    this.isBeingKidnapped = false;
    this.wantedLevels    = {};
    this.bountyTargetId  = null;
    this.myAllyId        = null;
    this.myAllyName      = null;
    this.specTarget      = null;

    this._lastMoveEmit = 0;
    this._lastVehicleHit = 0;
    this._animId       = null;
    this._clock        = new THREE.Clock();
    this._respawnTimer = null;
    this._boundOnKeyDown = null;

    this.cops       = new Map();  // copId -> RemotePlayer
    this.traffic    = null;
    this.pickups    = null;
    this._speedBoostTimer = null;
    this._radarUntil = 0;
    this.isArrested = false;
    this._arrestTimer = null;

    this._initialPlayers = playerList;
    this._meInfo         = playerList.find(p => p.id === myId);
  }

  init(inputHandler) {
    this.inputHandler = inputHandler;

    if (this.map?.grid) setCityGrid(this.map.grid);
    setCityTheme(this.map?.id);
    refreshHideSpots();
    this._hideSpots = hideSpotsFromGrid();
    this._localSpeed = 0;
    this._lastPos = new THREE.Vector3();
    this.isHiding = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2240);
    this.scene.fog = new THREE.Fog(0x1a2240, 100, 300);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(this._pixelRatioForQuality(this.settings.graphicsQuality));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Bright blue-sky ambient
    const ambient = new THREE.AmbientLight(0x6688bb, 1.2);
    this.scene.add(ambient);

    // Main sun (warm evening light)
    const moon = new THREE.DirectionalLight(0xffd5a0, 1.4);
    moon.position.set(60, 100, 40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near   = 0.5;
    moon.shadow.camera.far    = 600;
    moon.shadow.camera.left   = -220;
    moon.shadow.camera.right  =  220;
    moon.shadow.camera.top    =  220;
    moon.shadow.camera.bottom = -220;
    this.scene.add(moon);

    // Cool blue fill from opposite side
    const sun = new THREE.DirectionalLight(0x8899cc, 0.5);
    sun.position.set(-60, 40, -60);
    this.scene.add(sun);

    this.dayNight = new DayNight(this.scene, ambient, moon, sun, getCityTheme().dayNight);

    const buildingBoxes = buildCity(this.scene);
    setBuildingBoxes(buildingBoxes);
    setNPCBuildingBoxes(buildingBoxes);
    this.traffic = new TrafficSystem(this.scene, 30, 7);
    this.pickups = new Pickups(this.scene);

    const me = this._meInfo;
    this.player = new PlayerController(
      this.scene,
      me?.color  || '#e74c3c',
      me?.name   || 'You',
      me?.spawnIdx || 0
    );
    if (me) this.player.setPosition(me.x || 0, 0, me.z || 0);
    this.player.setCameraView(this.settings.cameraView);

    for (const p of this._initialPlayers) {
      if (p.id === this.myId) continue;
      const rp = new RemotePlayer(this.scene, p.id, p.name, p.color, p.spawnIdx || 0);
      rp.applyServerState(p.x, p.y, p.z, p.rot || 0);
      this.remotePlayers.set(p.id, rp);
    }

    this.npcs = createNPCs(this.scene, 95, 14);

    this.hud = new HUD(this.container, () => {
      this.sounds.stopAllLoops();
      this.network.leaveRoom();
      this.onLeaveMatch?.();
    }, () => this._toggleCameraView());
    this.hud.show();
    if (this.map?.name) this.hud.addEvent(`🗺️ ${this.map.name}`, 'neutral');
    this._setupPostProcessing();
    this._unsubscribeSettings = settingsStore.subscribe((settings) => this._applySettings(settings));

    this._boundOnResize = this._onResize.bind(this);
    this._boundOnKeyDown = this._onKeyDown.bind(this);
    this._boundOnGamepad = () => this.hud?.addEvent('🎮 Controller connected — A: act · RT: sprint · Y: view', 'neutral');
    window.addEventListener('resize', this._boundOnResize);
    window.addEventListener('keydown', this._boundOnKeyDown);
    window.addEventListener('gamepadconnected', this._boundOnGamepad);
    this._setupNetworkListeners();
    this._loop();
  }

  _setupNetworkListeners() {
    const net = this.network;

    // ── Continuous game start ──────────────────────
    net.on('game:start', (data) => {
      this.scores        = data.scores;
      this.gameActive    = true;
      this.myTask        = data.tasks[this.myId] || null;
      this.kidnappingTarget  = null;
      this.player.isDragging = false;
      this.isBeingKidnapped  = false;
      this.myHp          = data.maxHp || 3;
      this.myMaxHp       = data.maxHp || 3;
      this.bountyTargetId    = data.bountyTarget || null;
      this.wantedLevels  = {};
      this.specTarget    = null;

      this.pickups?.dispose();
      this.player.speedMultiplier = 1;
      this._radarUntil = 0;

      this.myAllyId   = data.allies?.[this.myId] || null;
      this.myAllyName = this.myAllyId
        ? (data.players.find(p => p.id === this.myAllyId)?.name || null)
        : null;

      for (const p of data.players) {
        if (p.id === this.myId) {
          this.player.setPosition(p.x, 0, p.z);
          this.player.setAlive(true);
          this.player.setCaptured(false);
        } else {
          let rp = this.remotePlayers.get(p.id);
          if (!rp) {
            rp = new RemotePlayer(this.scene, p.id, p.name, p.color, p.spawnIdx || 0);
            this.remotePlayers.set(p.id, rp);
          }
          rp.applyServerState(p.x, 0, p.z, 0);
          rp.setAlive(true);
          rp.setHp(this.myMaxHp);
          rp.setCaptured(false);
          rp.isDragging = false;
        }
      }

      this.hud.startGameTimer(data.duration);
      this.hud.setTask(this.myTask);
      this.hud.setScore(this.scores[this.myId] || 0);
      this.hud.setHealth(this.myHp, this.myMaxHp);
      this.hud.setWanted(0);
      this.hud.showEscapePrompt(false);
      this.hud.setAllyInfo(this.myAllyName);
      this.hud.setBountyActive(this.bountyTargetId === this.myId);
      this.hud.hideRespawn();
      this.sounds.startMusic();
      this.sounds.startAmbience();
      this.sounds.play('task');
    });

    // ── New task assigned mid-game ─────────────────
    net.on('task:assigned', (data) => {
      if (data.playerId === this.myId) {
        this.myTask = data.task;
        this.kidnappingTarget = null;
        this.player.isDragging = false;
        this.hud.setTask(data.task);
        this.hud.setTargetArrow(null);
        this.sounds.play('task');
        this.hud.addEvent('Simon has a new mission for you!', 'neutral');
      } else {
        const rp = this.remotePlayers.get(data.playerId);
        if (rp) rp.isDragging = false;
        const name = rp?.name || data.playerName;
        this.hud.addEvent(`Simon reassigned ${name}`, 'neutral');
      }
    });

    // ── Player dying (will respawn in Xs) ──────────
    net.on('player:dying', (data) => {
      if (data.playerId === this.myId) {
        this.kidnappingTarget = null;
        this.player.isDragging = false;
        this.hud.setActionHint('');
        this.hud.showRespawnCountdown(data.respawnIn);
        this._startRespawnCountdown(data.respawnIn);
      } else {
        const rp = this.remotePlayers.get(data.playerId);
        if (rp) rp.setAlive(false);
      }
    });

    // ── Player respawned ───────────────────────────
    net.on('player:respawn', (data) => {
      this.scores = data.scores || this.scores;
      this.hud.setScore(this.scores[this.myId] || 0);

      if (data.playerId === this.myId) {
        this.player.setPosition(data.x, 0, data.z);
        this.player.setAlive(true);
        this.player.setCaptured(false);
        this.player.isDragging = false;
        this.isBeingKidnapped = false;
        this.kidnappingTarget = null;
        this.myHp = this.myMaxHp;
        this.hud.setHealth(this.myHp, this.myMaxHp);
        this.hud.showEscapePrompt(false);
        this.hud.hideRespawn();
        this.specTarget = null;
        if (this._respawnTimer) { clearInterval(this._respawnTimer); this._respawnTimer = null; }
        this.hud.addEvent('You respawned! -50 pts', 'trap');
        this.sounds.play('task');
      } else {
        const rp = this.remotePlayers.get(data.playerId);
        if (rp) {
          rp.applyServerState(data.x, 0, data.z, 0);
          rp.setAlive(true);
          rp.setHp(this.myMaxHp);
        }
      }
    });

    net.on('game:end', (data) => {
      this.gameActive = false;
      this.sounds.stopAllLoops();
      this.hud.showGameEnd(data.leaderboard, this.myId, () => {
        this.network.resetRoom();
      });
    });

    net.on('player:move', (data) => {
      if (data.id === this.myId) {
        // Server is dragging us (we're kidnapped) — update our own position
        if (this.isBeingKidnapped) this.player.setPosition(data.x, data.y, data.z);
        return;
      }
      const rp = this.remotePlayers.get(data.id);
      if (rp) rp.applyServerState(data.x, data.y, data.z, data.rot);
    });

    net.on('game:event', (data) => this._handleGameEvent(data));

    net.on('player:wanted', (data) => {
      this.wantedLevels[data.playerId] = data.level;
      if (data.playerId === this.myId) {
        this.hud.setWanted(data.level);
        this.sounds.play('wanted');
        this.hud.addEvent(`You've been spotted! Wanted ⭐×${data.level}`, 'wanted');
      }
    });

    net.on('player:bounty', (data) => {
      const prev = this.bountyTargetId;
      this.bountyTargetId = data.bountyTarget;
      this.hud.setBountyActive(this.bountyTargetId === this.myId);
      if (this.bountyTargetId && this.bountyTargetId !== prev) {
        const name = this.remotePlayers.get(this.bountyTargetId)?.name || 'Someone';
        this.hud.addEvent(`💰 BOUNTY on ${name}! Kill for +200 bonus`, 'bounty');
        this.sounds.play('bounty');
      }
    });

    net.on('pickup:spawned', (data) => this.pickups?.spawn(data));

    net.on('pickup:removed', (data) => this.pickups?.remove(data.id));

    net.on('pickup:effect', (data) => {
      if (data.type === 'speed') {
        this.player.speedMultiplier = 1.5;
        if (this._speedBoostTimer) clearTimeout(this._speedBoostTimer);
        this._speedBoostTimer = setTimeout(() => { this.player.speedMultiplier = 1; }, data.duration * 1000);
        this.hud.addEvent(`⚡ Speed boost! ${data.duration}s`, 'escape');
        this.sounds.play('task');
      } else if (data.type === 'radar') {
        this._radarUntil = Date.now() + data.duration * 1000;
        this.hud.addEvent(`📡 Radar ping! Everyone visible on the minimap for ${data.duration}s`, 'escape');
        this.sounds.play('task');
      }
    });

    net.on('cop:spawned', (data) => {
      const cop = new RemotePlayer(this.scene, data.copId, '🚔 COP', '#5dade2', 0);
      cop.alwaysVisible = true;
      cop.applyServerState(data.x, 0, data.z, 0);
      this.cops.set(data.copId, cop);
      if (data.targetId === this.myId) {
        this.hud.addEvent('🚔 A COP is coming for you — SPRINT!', 'wanted');
        this.sounds.play('wanted');
      } else {
        this.hud.addEvent(`🚔 COP is chasing ${data.targetName}!`, 'neutral');
      }
    });

    net.on('cop:move', (data) => {
      const cop = this.cops.get(data.copId);
      if (cop) cop.applyServerState(data.x, 0, data.z, 0);
    });

    net.on('cop:despawned', (data) => {
      const cop = this.cops.get(data.copId);
      if (cop) { cop.dispose(); this.cops.delete(data.copId); }
    });

    net.on('player:arrested', (data) => {
      this.hud.addEvent(`🚔 ${data.playerName} got ARRESTED! ${data.duration}s lockup`, 'trap');
      this.sounds.play('trap');
      if (data.playerId === this.myId) {
        this.isArrested = true;
        this.hud.showArrestCountdown(data.duration);
        this._startArrestCountdown(data.duration);
      }
    });

    net.on('player:released', (data) => {
      if (data.playerId === this.myId) {
        this.isArrested = false;
        this.hud.hideArrestCountdown();
        this.hud.addEvent('Released! Back in the game.', 'escape');
        if (this._arrestTimer) { clearInterval(this._arrestTimer); this._arrestTimer = null; }
      }
    });
  }

  _handleGameEvent(data) {
    const { type } = data;

    if (type === 'player_killed' || type === 'kidnap_complete') {
      const rp = this.remotePlayers.get(data.targetId);
      if (rp) { rp.setAlive(false); rp.setCaptured(false); }
      const attackerRp = this.remotePlayers.get(data.actorId);
      if (attackerRp) { attackerRp.flashAttack(); attackerRp.isDragging = false; }
      if (data.targetId === this.myId) {
        this.player.setAlive(false);
        this.isBeingKidnapped = false;
        this.player.setCaptured(false);
        this.hud.showEscapePrompt(false);
        if (this.kidnappingTarget) {
          this.kidnappingTarget = null;
          this.player.isDragging = false;
          this.hud.setActionHint('');
        }
      }
      if (this.kidnappingTarget === data.targetId) {
        this.kidnappingTarget = null;
        this.player.isDragging = false;
        this.hud.setActionHint('');
      }
      this.scores = data.scores || this.scores;
      this.hud.setScore(this.scores[this.myId] || 0);
      this.hud.addEvent(data.message, 'kill');
      this.sounds.play('kill');

    } else if (type === 'betrayal_kill') {
      const rp = this.remotePlayers.get(data.targetId);
      if (rp) { rp.setAlive(false); rp.setCaptured(false); }
      const betrayerRp = this.remotePlayers.get(data.actorId);
      if (betrayerRp) { betrayerRp.flashAttack(); betrayerRp.isDragging = false; }
      if (data.targetId === this.myId) {
        this.player.setAlive(false);
        this.isBeingKidnapped = false;
        this.player.setCaptured(false);
        this.hud.showEscapePrompt(false);
        if (this.kidnappingTarget) { this.kidnappingTarget = null; this.player.isDragging = false; this.hud.setActionHint(''); }
      }
      if (this.kidnappingTarget === data.targetId) {
        this.kidnappingTarget = null;
        this.player.isDragging = false;
        this.hud.setActionHint('');
      }
      this.scores = data.scores || this.scores;
      this.hud.setScore(this.scores[this.myId] || 0);
      this.hud.addEvent(data.message, 'kill');
      this.sounds.play('betrayal');

    } else if (type === 'player_damaged') {
      const rp = this.remotePlayers.get(data.targetId);
      if (rp) { rp.flashDamage(); rp.setHp(data.hp); }
      const attackerRp = this.remotePlayers.get(data.actorId);
      if (attackerRp) attackerRp.flashAttack();
      if (data.targetId === this.myId) {
        this.myHp = data.hp;
        this.hud.setHealth(data.hp, data.maxHp);
        this.hud.flashDamage();
      }
      this.hud.addEvent(data.message, 'hit');
      this.sounds.play('hit');

    } else if (type === 'trap_triggered') {
      this.hud.addEvent(data.message, 'trap');
      this.sounds.play('trap');
      if (data.actorId === this.myId) {
        this.scores[this.myId] = Math.max(0, (this.scores[this.myId] || 0) - 200);
        this.hud.setScore(this.scores[this.myId]);
      }

    } else if (type === 'pickup') {
      this.scores = data.scores || this.scores;
      this.hud.setScore(this.scores[this.myId] || 0);
      if (data.actorId === this.myId) {
        this.hud.addEvent(data.message, 'escape');
        this.sounds.play('task');
      }

    } else if (type === 'wrong_target') {
      this.hud.addEvent(data.message, 'trap');
      if (data.actorId === this.myId) {
        this.scores[this.myId] = Math.max(0, (this.scores[this.myId] || 0) - 100);
        this.hud.setScore(this.scores[this.myId]);
        this.sounds.play('trap');
      }

    } else if (type === 'kidnap_started') {
      this.hud.addEvent(data.message, 'kidnap');
      this.sounds.play('kidnap');
      // Mark the victim as captured (animation)
      const victimRp = this.remotePlayers.get(data.targetId);
      if (victimRp) victimRp.setCaptured(true);
      // Mark the kidnapper as dragging (animation)
      const kidnapperRp = this.remotePlayers.get(data.actorId);
      if (kidnapperRp) kidnapperRp.isDragging = true;
      if (data.targetId === this.myId) {
        this.isBeingKidnapped = true;
        this.player.setCaptured(true);
        this.hud.showEscapePrompt(true);
        this.hud.addEvent(`${data.actorName} is taking you somewhere — ESCAPE!`, 'kidnap');
      }

    } else if (type === 'waypoint_reached') {
      if (data.actorId === this.myId && this.myTask) {
        this.myTask.currentWaypoint = data.waypoint;
        this.hud.addEvent(`Checkpoint reached! Head to ${data.nextLabel}`, 'neutral');
      }
    } else if (type === 'patrol_complete') {
      this.scores = data.scores || this.scores;
      this.hud.setScore(this.scores[this.myId] || 0);
      this.hud.addEvent(data.message, 'neutral');

    } else if (type === 'escape_attempt') {
      if (data.targetId === this.myId) {
        this.hud.addEvent('Keep mashing [E / ACT]!', 'escape');
        this.sounds.play('hit');
      }

    } else if (type === 'escaped') {
      this.hud.addEvent(data.message, 'escape');
      this.sounds.play('escape');
      // Clear victim captured state (remote or local)
      const escapedRp = this.remotePlayers.get(data.targetId);
      if (escapedRp) escapedRp.setCaptured(false);
      // Clear kidnapper dragging state (remote or local) — actorId now always present
      const kidnapperRp = this.remotePlayers.get(data.actorId);
      if (kidnapperRp) kidnapperRp.isDragging = false;
      if (data.targetId === this.myId) {
        this.isBeingKidnapped = false;
        this.player.setCaptured(false);
        this.hud.showEscapePrompt(false);
      }
      if (this.kidnappingTarget === data.targetId) {
        this.kidnappingTarget = null;
        this.player.isDragging = false;
        this.hud.setActionHint('');
      }
    }
  }

  _loop() {
    this._animId = requestAnimationFrame(this._loop.bind(this));
    const delta = this._clock.getDelta();
    this.dayNight?.update(this._clock.elapsedTime);

    if (this.gameActive) {
      if (this.player.isAlive) {
        const movement  = this.isArrested ? { x: 0, y: 0 } : this.inputHandler.getMovement();
        const sprinting = this.isArrested ? false : this.inputHandler.isSprinting();
        this.player.update(delta, movement, sprinting);

        const now = Date.now();
        if (now - this._lastMoveEmit > MOVE_EMIT_RATE) {
          this.network.sendMove(this.player.getState());
          this._lastMoveEmit = now;
        }

        if (this.inputHandler.consumeAction()) this._tryAction();

        if (this.kidnappingTarget && this.myTask?.type === 'kidnap') {
          if (this._distToKidnapLocation() < KIDNAP_DELIVER_RANGE) {
            this.network.sendKidnapComplete();
            this.kidnappingTarget = null;
            this.player.isDragging = false;
            this.hud.setActionHint('');
          }
        }

        this._updateHiding(delta);
        this._updateActionHintAndArrow();
        this._checkVehicleHit();
        this.player.updateCamera(delta);

        const pickupId = this.pickups?.update(delta, this.player.position);
        if (pickupId) this.network.sendPickupCollect(pickupId);

        const radarOn = Date.now() < this._radarUntil;
        this.hud.updateMinimap(
          { x: this.player.position.x, z: this.player.position.z, rot: this.player.rotation },
          [...this.cops.values()].map(c => ({ x: c.group.position.x, z: c.group.position.z })),
          this._currentWaypoint(),
          radarOn
            ? [...this.remotePlayers.values()].filter(rp => rp.isAlive)
                .map(rp => ({ x: rp.group.position.x, z: rp.group.position.z }))
            : []
        );

      } else {
        if (this.inputHandler.consumeAction()) { /* absorb */ }
        this._updateSpectatorCam(delta);
      }
    } else {
      this.player.updateCamera(delta);
    }

    for (const rp of this.remotePlayers.values()) rp.update(delta, this.player.position);
    for (const cop of this.cops.values()) cop.update(delta);
    if (!this.gameActive || !this.player.isAlive) this.pickups?.update(delta);
    this.traffic?.update(delta);
    for (const npc of this.npcs) npc.update(delta, this.traffic);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.player.camera);
  }

  _tryAction() {
    if (!this.gameActive) return;
    if (this.isBeingKidnapped) { this.network.sendBreakFree(); return; }
    if (!this.player.isAlive) return;

    const task = this.myTask;
    if (!task || !task.targetId) return;
    const target = this.remotePlayers.get(task.targetId);
    if (!target || !target.isAlive) return;

    const dist = this.player.position.distanceTo(target.group.position);
    if (dist > ACTION_RANGE) return;

    if (task.type === 'kill') {
      this.player.triggerPunch();
      this.network.sendKill(task.targetId);
    } else if (task.type === 'kidnap') {
      if (this.kidnappingTarget) {
        if (this._distToKidnapLocation() < KIDNAP_DELIVER_RANGE) {
          this.network.sendKidnapComplete();
          this.kidnappingTarget = null;
          this.player.isDragging = false;
        }
      } else {
        this.network.sendKidnapStart(task.targetId);
        this.kidnappingTarget = task.targetId;
        this.player.isDragging = true;
        this.hud.addEvent(`You grabbed ${task.targetName}! Bring them to ${task.locationLabel}`, 'kidnap');
      }
    }
  }

  _checkVehicleHit() {
    if (!this.traffic || this.isBeingKidnapped || this.isArrested) return;
    const vehicle = this.traffic.getHitVehicleAt(this.player.position);
    if (!vehicle) return;
    const now = Date.now();
    if (now - (this._lastVehicleHit || 0) < 1400) return;
    this._lastVehicleHit = now;
    this.network.sendVehicleHit(vehicle.id);
    this.hud.flashDamage();
    this.sounds.play('hit');
  }

  _updateActionHintAndArrow() {
    const task = this.myTask;
    if (!task || !task.targetId) {
      this.player.showActionRing(false);
      if (task?.type === 'survive' && task.waypoints) {
        const wp = task.waypoints[task.currentWaypoint];
        if (wp) {
          const dx = wp.x - this.player.position.x;
          const dz = wp.z - this.player.position.z;
          const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
          this.hud.setActionHint(`📍 Patrol: head to ${wp.label} — ${dist}m (${task.currentWaypoint + 1}/${task.waypoints.length})`);
          this._setTargetArrow(dx, dz);
          return;
        }
      }
      this.hud.setActionHint(task?.type === 'survive' ? 'Stay alive!' : '');
      this.hud.setTargetArrow(null);
      return;
    }

    const target = this.remotePlayers.get(task.targetId);
    if (!target || !target.isAlive) {
      this.player.showActionRing(false);
      this.hud.setActionHint('Target eliminated — new mission incoming...');
      this.hud.setTargetArrow(null);
      return;
    }

    // While dragging a hostage, navigate to the delivery location instead of the target
    if (this.kidnappingTarget) {
      const deliverDist = this._distToKidnapLocation();
      const atDrop = deliverDist < KIDNAP_DELIVER_RANGE;
      this.player.showActionRing(atDrop);
      if (atDrop) {
        this.hud.setActionHint('[E / ACT] — Drop hostage here!');
        this.hud.setTargetArrow(null);
      } else {
        const dx = task.locationX - this.player.position.x;
        const dz = task.locationZ - this.player.position.z;
        this.hud.setActionHint(`📦 Bring ${task.targetName} to ${task.locationLabel} — ${Math.round(deliverDist)}m`);
        this._setTargetArrow(dx, dz);
      }
      return;
    }

    // Navigate to target player
    const dist    = this.player.position.distanceTo(target.group.position);
    const inRange = dist < ACTION_RANGE;
    this.player.showActionRing(inRange);

    if (inRange) {
      this.hud.setActionHint(
        task.type === 'kill' ? '[E / ACT] — Eliminate target' : '[E / ACT] — Grab target'
      );
      this.hud.setTargetArrow(null);
    } else {
      const isBounty = this.bountyTargetId === task.targetId;
      this.hud.setActionHint(`${isBounty ? '💰 ' : ''}${task.targetName} — ${Math.round(dist)}m`);
      const dx  = target.group.position.x - this.player.position.x;
      const dz  = target.group.position.z - this.player.position.z;
      this._setTargetArrow(dx, dz);
    }
  }

  _updateSpectatorCam(delta) {
    if (!this.specTarget || !this.remotePlayers.get(this.specTarget)?.isAlive) {
      this.specTarget = null;
      for (const [id, rp] of this.remotePlayers) {
        if (rp.isAlive) { this.specTarget = id; break; }
      }
    }
    if (this.specTarget) {
      const pos = this.remotePlayers.get(this.specTarget).group.position;
      const rot = this.remotePlayers.get(this.specTarget).group.rotation.y;
      this.player.updateCameraAt(pos, rot, delta);
    }
  }

  _startRespawnCountdown(seconds) {
    if (this._respawnTimer) clearInterval(this._respawnTimer);
    let remaining = seconds;
    this._respawnTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this._respawnTimer);
        this._respawnTimer = null;
        return;
      }
      this.hud.showRespawnCountdown(remaining);
    }, 1000);
  }

  _startArrestCountdown(seconds) {
    if (this._arrestTimer) clearInterval(this._arrestTimer);
    let remaining = seconds;
    this._arrestTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) { clearInterval(this._arrestTimer); this._arrestTimer = null; return; }
      this.hud.showArrestCountdown(remaining);
    }, 1000);
  }

  _updateHiding(delta) {
    if (delta > 0) {
      const moved = this.player.position.distanceTo(this._lastPos);
      this._localSpeed += ((moved / delta) - this._localSpeed) * Math.min(1, delta * 6);
      this._lastPos.copy(this.player.position);
    }

    let inSpot = false;
    if (this._localSpeed < 2 && !this.isBeingKidnapped && !this.player.isDragging) {
      for (const s of this._hideSpots) {
        const dx = this.player.position.x - s.x, dz = this.player.position.z - s.z;
        if (dx * dx + dz * dz < s.r * s.r) { inSpot = true; break; }
      }
    }

    // Same timer state machine as the server: hide runs out, then cools down
    const now = Date.now();
    let hiding = false;
    let badge = null;
    if (!inSpot) {
      this._hideStart = null;
      if (this._hideCooldownUntil && now < this._hideCooldownUntil) badge = null;
    } else if (this._hideCooldownUntil && now < this._hideCooldownUntil) {
      badge = `🫥 SPOTTED — hide again in ${Math.ceil((this._hideCooldownUntil - now) / 1000)}s`;
    } else {
      if (!this._hideStart) this._hideStart = now;
      const left = HIDE_DURATION_MS - (now - this._hideStart);
      if (left <= 0) {
        this._hideStart = null;
        this._hideCooldownUntil = now + HIDE_COOLDOWN_MS;
      } else {
        hiding = true;
        badge = `🫥 HIDDEN ${Math.ceil(left / 1000)}s`;
      }
    }

    if (hiding !== this.isHiding) {
      this.isHiding = hiding;
      this.player.setHiddenVisual(hiding);
    }
    if (badge !== this._hideBadge) {
      this._hideBadge = badge;
      this.hud.setHiddenBadge(badge);
    }
  }

  _currentWaypoint() {
    const task = this.myTask;
    if (!task) return null;
    if (task.type === 'survive' && task.waypoints) {
      const wp = task.waypoints[task.currentWaypoint];
      return wp ? { x: wp.x, z: wp.z } : null;
    }
    if (task.type === 'kidnap' && this.kidnappingTarget) {
      return { x: task.locationX, z: task.locationZ };
    }
    return null;
  }

  _distToKidnapLocation() {
    const task = this.myTask;
    if (!task) return Infinity;
    const dx = this.player.position.x - task.locationX;
    const dz = this.player.position.z - task.locationZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  _setTargetArrow(dx, dz) {
    if (this.settings.cameraView !== 'thirdPerson') {
      this.hud.setTargetArrow(Math.atan2(dx, -dz) * (180 / Math.PI));
      return;
    }

    const targetYaw = Math.atan2(dx, dz);
    const relativeAngle = _angleDiff(this.player.getCameraYaw(), targetYaw);
    this.hud.setTargetArrow(relativeAngle * (180 / Math.PI));
  }

  _onResize() {
    this.player.camera.aspect = window.innerWidth / window.innerHeight;
    this.player.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass?.resolution.set(window.innerWidth, window.innerHeight);
  }

  _onKeyDown(event) {
    if (event.code === 'KeyV' && !event.repeat) this._toggleCameraView();
  }

  _toggleCameraView() {
    const next = this.settings.cameraView === 'thirdPerson' ? 'tactical' : 'thirdPerson';
    settingsStore.update({ cameraView: next });
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.player.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.35,
      0.72
    );
    this.composer.addPass(this.bloomPass);
    this._applySettings(this.settings);
  }

  _applySettings(settings) {
    this.settings = settings;
    if (this.renderer) {
      this.renderer.setPixelRatio(this._pixelRatioForQuality(settings.graphicsQuality));
      this.renderer.shadowMap.enabled = settings.graphicsQuality !== 'low';
    }
    if (this.bloomPass) {
      const quality = settings.graphicsQuality;
      this.bloomPass.enabled = quality !== 'low';
      this.bloomPass.strength = quality === 'high' ? 0.45 : 0.28;
      this.bloomPass.radius = quality === 'high' ? 0.35 : 0.2;
    }
    this.player?.setCameraView(settings.cameraView);
  }

  _pixelRatioForQuality(quality) {
    if (quality === 'low') return 1;
    if (quality === 'medium') return Math.min(window.devicePixelRatio, 1.5);
    return Math.min(window.devicePixelRatio, 2);
  }

  destroy() {
    cancelAnimationFrame(this._animId);
    window.removeEventListener('resize', this._boundOnResize);
    window.removeEventListener('keydown', this._boundOnKeyDown);
    window.removeEventListener('gamepadconnected', this._boundOnGamepad);
    if (this._respawnTimer) clearInterval(this._respawnTimer);
    if (this._arrestTimer) clearInterval(this._arrestTimer);
    if (this._speedBoostTimer) clearTimeout(this._speedBoostTimer);
    this._unsubscribeSettings?.();
    this.pickups?.dispose();
    this.pickups = null;
    this.sounds.destroy();
    this.traffic?.dispose();
    this.traffic = null;
    for (const cop of this.cops.values()) cop.dispose();
    this.cops.clear();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.hud?.el?.parentNode === this.container) {
      this.hud.destroy?.();
      this.container.removeChild(this.hud.el);
    }
  }
}

function _angleDiff(target, current) {
  let d = target - current;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
