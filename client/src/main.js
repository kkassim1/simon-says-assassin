import { Network, SERVER_URL } from './network/Network.js';
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
  let myId;
  try {
    myId = await network.connect();
  } catch (error) {
    showLoadingError(error.message);
    return;
  }
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
      <button id="loading-retry" type="button" style="display:none">Retry</button>
    </div>
  `;
  el.querySelector('#loading-retry').addEventListener('click', () => {
    window.location.reload();
  });
  container.appendChild(el);
  return el;
}

function showLoading(text) {
  if (!loadingEl) return;
  loadingEl.querySelector('#loading-text').textContent = text;
  loadingEl.querySelector('.loading-bar').style.display = 'block';
  loadingEl.querySelector('#loading-retry').style.display = 'none';
  loadingEl.style.display = 'flex';
}

function showLoadingError(text) {
  if (!loadingEl) return;
  loadingEl.querySelector('#loading-text').innerHTML = `
    <strong>Could not reach the game server.</strong>
    <small>${text}<br />For local play, start the backend with <code>cd server && npm run dev</code>.</small>
  `;
  loadingEl.querySelector('.loading-bar').style.display = 'none';
  loadingEl.querySelector('#loading-retry').style.display = 'inline-flex';
  loadingEl.style.display = 'flex';
  console.error(`Connection failed. Expected server: ${SERVER_URL}`);
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
