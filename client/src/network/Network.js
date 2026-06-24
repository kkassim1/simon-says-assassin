import { io } from 'socket.io-client';

// When accessed from another device on LAN, use that device's hostname automatically
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  `http://${window.location.hostname}:3000`;

export class Network {
  constructor() {
    this.socket = null;
    this.handlers = {};
  }

  connect() {
    this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    this.socket.onAny((event, data) => {
      const fn = this.handlers[event];
      if (fn) fn(data);
    });

    return new Promise((resolve) => {
      this.socket.on('connect', () => resolve(this.socket.id));
    });
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  createRoom(playerName) {
    this.socket.emit('room:create', { playerName });
  }

  joinRoom(roomCode, playerName) {
    this.socket.emit('room:join', { roomCode, playerName });
  }

  startGame() {
    this.socket.emit('room:start');
  }

  sendMove(state) {
    this.socket.emit('player:move', state);
  }

  sendKill(targetId) {
    this.socket.emit('action:kill', { targetId });
  }

  sendKidnapStart(targetId) {
    this.socket.emit('action:kidnap_start', { targetId });
  }

  sendKidnapComplete() {
    this.socket.emit('action:kidnap_complete');
  }

  sendBreakFree() {
    this.socket.emit('action:break_free');
  }

  sendVehicleHit(vehicleId) {
    this.socket.emit('action:vehicle_hit', { vehicleId });
  }

  resetRoom() {
    this.socket.emit('room:reset');
  }

  get id() {
    return this.socket?.id;
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
