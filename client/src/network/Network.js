import { io } from 'socket.io-client';

// When accessed from another device on LAN, use that device's hostname automatically
const isLocalClient = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const SERVER_URL = isLocalClient
  ? `http://${window.location.hostname}:3000`
  : (import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3000`);

export { SERVER_URL };

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

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        this.socket.disconnect();
        reject(new Error(`Could not connect to Simon server at ${SERVER_URL}.`));
      }, 8000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.socket.off('connect', onConnect);
        this.socket.off('connect_error', onConnectError);
      };

      const onConnect = () => {
        cleanup();
        resolve(this.socket.id);
      };

      const onConnectError = () => {
        cleanup();
        this.socket.disconnect();
        reject(new Error(`Could not connect to Simon server at ${SERVER_URL}.`));
      };

      this.socket.on('connect', onConnect);
      this.socket.on('connect_error', onConnectError);
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

  quickPlay(playerName) {
    this.socket.emit('room:quickplay', { playerName });
  }

  startGame() {
    this.socket.emit('room:start');
  }

  leaveRoom() {
    this.socket.emit('room:leave');
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

  sendPickupCollect(pickupId) {
    this.socket.emit('action:pickup', { pickupId });
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
