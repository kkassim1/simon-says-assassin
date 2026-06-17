export class Lobby {
  constructor(container, network) {
    this.container = container;
    this.network = network;
    this.onGameReady = null;

    this.el = document.createElement('div');
    this.el.id = 'lobby';
    this.el.innerHTML = `
      <div id="lobby-inner">
        <div id="lobby-title">
          <div class="simon-eye">👁</div>
          <h1>SIMON SAYS</h1>
          <h2>Assassin</h2>
        </div>

        <div id="name-section">
          <input id="player-name" type="text" placeholder="Enter your name" maxlength="12" />
        </div>

        <div id="lobby-actions">
          <button id="btn-create" class="lobby-btn primary">Create Room</button>
          <div class="divider">— or —</div>
          <div id="join-row">
            <input id="room-code-input" type="text" placeholder="Room code" maxlength="4" />
            <button id="btn-join" class="lobby-btn">Join</button>
          </div>
        </div>

        <div id="lobby-room" style="display:none">
          <div id="room-code-display"></div>
          <div id="player-list"></div>
          <button id="btn-start" class="lobby-btn primary" style="display:none">Start Game</button>
          <div id="waiting-msg">Waiting for players...</div>
        </div>

        <div id="lobby-error" style="display:none"></div>

        <button id="btn-how-to-play" class="lobby-btn secondary" style="margin-top:4px">❓ How to Play</button>

        <div id="demo-notice">Free demo: 3 games remaining</div>
      </div>

      <div id="instructions-overlay" style="display:none">
        <div id="instructions-panel">
          <button id="btn-close-instructions">✕</button>
          <h2>How to Play</h2>

          <div class="instr-section">
            <h3>🎮 Controls</h3>
            <div class="instr-cols">
              <div class="instr-col">
                <strong>⌨️ Keyboard</strong>
                <ul>
                  <li>WASD / Arrows — Move</li>
                  <li>E or Space — Act</li>
                  <li>Shift — Sprint</li>
                </ul>
              </div>
              <div class="instr-col">
                <strong>📱 Mobile</strong>
                <ul>
                  <li>Left joystick — Move</li>
                  <li>ACT button — Act</li>
                  <li>RUN button — Sprint</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="instr-section">
            <h3>🎯 Missions</h3>
            <ul>
              <li>🔪 <strong>Kill</strong> — Get close to target, press Act to eliminate (+300 pts)</li>
              <li>🪢 <strong>Kidnap</strong> — Grab target with Act, follow the arrow to the drop-off location (+500 pts)</li>
              <li>🛡️ <strong>Survive</strong> — Stay alive for bonus points</li>
              <li>⚠️ <strong>TRAP</strong> — Tasks without "Simon says" are traps! Doing them costs -200 pts</li>
            </ul>
          </div>

          <div class="instr-section">
            <h3>⚡ Key Rules</h3>
            <ul>
              <li>🤝 You have a <strong>secret ally</strong> — work together or betray them for +400 bonus</li>
              <li>⭐ Being seen committing crimes raises your <strong>Wanted</strong> level</li>
              <li>💰 The top player gets a <strong>Bounty</strong> — everyone can earn +200 for eliminating them</li>
              <li>🚔 A <strong>Cop</strong> will chase the bounty player — get caught = 30s arrest</li>
              <li>If kidnapped, <strong>mash Act</strong> repeatedly to break free</li>
              <li>Dying costs -50 pts and a 15s respawn penalty</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    container.appendChild(this.el);

    this._isHost = false;
    this._myId = null;

    this._bind();
  }

  setSocketId(id) {
    this._myId = id;
  }

  _bind() {
    this.el.querySelector('#btn-create').addEventListener('click', () => {
      const name = this._getName();
      this.network.createRoom(name);
      this._isHost = true;
    });

    this.el.querySelector('#btn-join').addEventListener('click', () => {
      const code = this.el.querySelector('#room-code-input').value.toUpperCase().trim();
      const name = this._getName();
      if (!code) return this._showError('Enter a room code.');
      this.network.joinRoom(code, name);
    });

    this.el.querySelector('#btn-start').addEventListener('click', () => {
      this.network.startGame();
    });

    this.el.querySelector('#btn-how-to-play').addEventListener('click', () => {
      this.el.querySelector('#instructions-overlay').style.display = 'flex';
    });

    this.el.querySelector('#btn-close-instructions').addEventListener('click', () => {
      this.el.querySelector('#instructions-overlay').style.display = 'none';
    });

    this.el.querySelector('#room-code-input').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  _getName() {
    const raw = this.el.querySelector('#player-name').value.trim();
    return raw || 'Agent';
  }

  onRoomJoined(roomCode, isHost) {
    this._isHost = isHost;
    this.el.querySelector('#lobby-actions').style.display = 'none';
    const roomSection = this.el.querySelector('#lobby-room');
    roomSection.style.display = 'block';
    this.el.querySelector('#room-code-display').innerHTML = `
      Room: <span class="code">${roomCode}</span>
      <small>(share this code with friends)</small>
    `;
    if (isHost) {
      this.el.querySelector('#btn-start').style.display = 'block';
      this.el.querySelector('#waiting-msg').textContent = 'You\'re the host. Start when ready!';
    }
  }

  updatePlayers(players) {
    const list = this.el.querySelector('#player-list');
    list.innerHTML = players.map(p => `
      <div class="lobby-player" style="border-left: 4px solid ${p.color}">
        <span class="player-dot" style="background:${p.color}"></span>
        ${p.name} ${p.isBot ? '<em>(AI)</em>' : ''}
        ${p.id === this._myId ? '<strong>(You)</strong>' : ''}
      </div>
    `).join('');
  }

  _showError(msg) {
    const err = this.el.querySelector('#lobby-error');
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => { err.style.display = 'none'; }, 3000);
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
