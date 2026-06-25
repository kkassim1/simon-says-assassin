import { Network } from './network/Network.js';
import { Lobby } from './ui/Lobby.js';
import { Game } from './game/Game.js';
import { InputHandler, VirtualInput } from './input/InputHandler.js';
import { TouchControls } from './input/TouchControls.js';
import './style.css';

const isMobile = window.matchMedia('(pointer: coarse)').matches
  || /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let network, lobby, game, inputHandler, touchControls;
let loadingEl;

async function main() {
  const appEl = document.getElementById('app');
  loadingEl = createLoadingOverlay(appEl);
  showLoading('Connecting to Simon...');

  network = new Network();
  const myId = await network.connect();
  hideLoading();

  lobby = new Lobby(appEl, network);
  lobby.setSocketId(myId);
  lobby.show();

  // Network → Lobby bridge
  network.on('room:joined', ({ roomCode, ok, isHost }) => {
    if (!ok) return;
    hideLoading();
    lobby.onRoomJoined(roomCode, Boolean(isHost));
  });

  network.on('room:error', ({ message }) => {
    hideLoading();
    alert(message);
  });

  network.on('room:left', () => {
    returnToLobby();
  });

  let latestPlayers = [];
  network.on('lobby:update', ({ players }) => {
    latestPlayers = players;
    lobby.updatePlayers(players);
  });

  // Transition from lobby to game on countdown
  network.on('game:countdown', () => {
    showLoading('Building city...');
    lobby.hide();
    requestAnimationFrame(() => {
      launchGame(latestPlayers, myId, appEl);
      setTimeout(hideLoading, 250);
    });
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

  game = new Game(network, myId, players, container, returnToLobby);
  game.init(inputHandler);
}

function createLoadingOverlay(container) {
  const el = document.createElement('div');
  el.id = 'loading-overlay';
  el.innerHTML = `
    <div class="loading-panel">
      <div class="loading-mark">SIMON</div>
      <div id="loading-text">Loading...</div>
      <div class="loading-bar"><span></span></div>
    </div>
  `;
  container.appendChild(el);
  return el;
}

function showLoading(text) {
  if (!loadingEl) return;
  loadingEl.querySelector('#loading-text').textContent = text;
  loadingEl.style.display = 'flex';
}

function hideLoading() {
  if (loadingEl) loadingEl.style.display = 'none';
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
  lobby.el.querySelector('#lobby-actions').style.display = 'flex';
  lobby.el.querySelector('#lobby-room').style.display = 'none';
  lobby.el.querySelector('#btn-start').style.display = 'none';
  lobby.el.querySelector('#waiting-msg').textContent = 'Waiting for players...';
  lobby.show();
}

main().catch(console.error);
