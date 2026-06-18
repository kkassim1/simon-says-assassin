import { Network } from './network/Network.js';
import { Lobby } from './ui/Lobby.js';
import { Game } from './game/Game.js';
import { InputHandler, VirtualInput } from './input/InputHandler.js';
import { TouchControls } from './input/TouchControls.js';
import './style.css';

const isMobile = ('ontouchstart' in window)
  || navigator.maxTouchPoints > 0
  || window.matchMedia('(pointer: coarse)').matches
  || /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let network, lobby, game, inputHandler, touchControls;

async function main() {
  const appEl = document.getElementById('app');

  network = new Network();
  const myId = await network.connect();

  lobby = new Lobby(appEl, network);
  lobby.setSocketId(myId);
  lobby.show();

  // Network → Lobby bridge
  network.on('room:joined', ({ roomCode, ok }) => {
    if (!ok) return;
    lobby.onRoomJoined(roomCode, true); // server validates host
  });

  network.on('room:error', ({ message }) => {
    alert(message);
  });

  let latestPlayers = [];
  network.on('lobby:update', ({ players }) => {
    latestPlayers = players;
    lobby.updatePlayers(players);
  });

  // Transition from lobby to game on countdown
  network.on('game:countdown', () => {
    lobby.hide();
    launchGame(latestPlayers, myId, appEl);
  });

  // Server confirmed reset — all clients return to lobby
  network.on('game:reset', () => {
    returnToLobby();
  });
}

function launchGame(players, myId, container) {
  if (isMobile) {
    const vi = new VirtualInput();
    inputHandler = vi;
    touchControls = new TouchControls(vi, container);
    touchControls.show();
  } else {
    inputHandler = new InputHandler();
  }

  game = new Game(network, myId, players, container);
  game.init(inputHandler);
}

function returnToLobby() {
  if (game) {
    game.hud?.removeGameEnd();
    game.destroy();
    game = null;
  }
  if (touchControls) {
    touchControls.destroy();
    touchControls = null;
  }
  if (inputHandler) {
    inputHandler.destroy?.();
    inputHandler = null;
  }
  lobby.show();
}

main().catch(console.error);
