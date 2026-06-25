import { createSettingsPanel, settingsStore } from './Settings.js';

export class HUD {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div id="hud-top">
        <div id="timer-display">⏱ <span id="timer-val">10:00</span></div>
        <div id="score-display">Score: <span id="score-val">0</span></div>
        <div id="wanted-display" style="display:none"></div>
        <button id="btn-hud-settings">⚙</button>
        <button id="btn-hud-help">❓</button>
      </div>

      <div id="hud-instructions" style="display:none">
        <div id="hud-instr-panel">
          <button id="btn-hud-help-close">✕ Close</button>
          <h3>Controls</h3>
          <div class="instr-cols">
            <div class="instr-col"><strong>⌨️ Keyboard</strong><ul><li>WASD / Arrows — Move</li><li>E or Space — Act</li><li>Shift — Sprint</li></ul></div>
            <div class="instr-col"><strong>📱 Mobile</strong><ul><li>Joystick — Move</li><li>ACT — Act</li><li>RUN — Sprint</li></ul></div>
          </div>
          <h3>Missions</h3>
          <ul>
            <li>🔪 Kill — Get close, press Act</li>
            <li>🪢 Kidnap — Grab with Act, follow arrow to drop-off</li>
            <li>🛡️ Survive — Stay alive</li>
            <li>⚠️ No "Simon says" = TRAP (-200 pts)</li>
          </ul>
          <h3>Key Rules</h3>
          <ul>
            <li>🤝 Secret ally — betray for +400 bonus</li>
            <li>💰 Bounty on top player — kill for +200</li>
            <li>🚔 Cop chases bounty player — 30s arrest if caught</li>
            <li>Mash Act to escape a kidnap</li>
          </ul>
        </div>
      </div>
      <div id="health-bar-wrap">
        <div id="health-bar"><div id="health-fill"></div></div>
        <span id="health-label">HP</span>
      </div>
      <div id="ally-info" style="display:none"></div>
      <div id="bounty-banner" style="display:none">💰 BOUNTY on YOU — 🚔 COP IS COMING!</div>
      <div id="simon-banner"></div>
      <div id="task-box">
        <div id="task-icon">🎯</div>
        <div id="task-text">Waiting for Simon...</div>
      </div>
      <div id="target-arrow" style="opacity:0">▲</div>
      <div id="event-feed"></div>
      <div id="action-hint"></div>
      <div id="escape-prompt" style="display:none">MASH [E / ACT] TO ESCAPE!</div>
      <div id="respawn-overlay" style="display:none">
        <div id="respawn-inner">
          <div id="respawn-label">You were eliminated</div>
          <div id="respawn-count">15</div>
          <div id="respawn-sub">seconds until respawn • -50 pts</div>
        </div>
      </div>
      <div id="arrest-overlay" style="display:none">
        <div id="arrest-inner">
          <div id="arrest-label">🚔 YOU'VE BEEN ARRESTED</div>
          <div id="arrest-count">30</div>
          <div id="arrest-sub">seconds until release • bounty cleared</div>
        </div>
      </div>
      <div id="damage-flash"></div>
    `;
    container.appendChild(this.el);
    this.settingsPanel = createSettingsPanel(settingsStore);
    container.appendChild(this.settingsPanel.el);
    this._gameTimerInterval = null;

    this.el.querySelector('#btn-hud-settings').addEventListener('click', () => {
      this.settingsPanel.show();
    });

    this.el.querySelector('#btn-hud-help').addEventListener('click', () => {
      this.el.querySelector('#hud-instructions').style.display = 'flex';
    });
    this.el.querySelector('#btn-hud-help-close').addEventListener('click', () => {
      this.el.querySelector('#hud-instructions').style.display = 'none';
    });
  }

  // ── Game timer ───────────────────────────────────

  startGameTimer(durationSeconds) {
    if (this._gameTimerInterval) clearInterval(this._gameTimerInterval);
    let remaining = durationSeconds;
    const tick = () => {
      this.el.querySelector('#timer-val').textContent = _mmss(remaining);
      if (remaining <= 0) { clearInterval(this._gameTimerInterval); return; }
      remaining--;
    };
    tick();
    this._gameTimerInterval = setInterval(tick, 1000);
  }

  // ── Task ─────────────────────────────────────────

  setTask(task) {
    const box  = this.el.querySelector('#task-box');
    const text = this.el.querySelector('#task-text');
    const icon = this.el.querySelector('#task-icon');

    if (!task) { text.textContent = 'Waiting for Simon...'; box.className = ''; return; }

    text.textContent = task.label;
    if (task.trap)              { box.className = 'task-trap';    icon.textContent = '⚠️'; }
    else if (task.type === 'kill')   { box.className = 'task-kill';    icon.textContent = '🔪'; }
    else if (task.type === 'kidnap') { box.className = 'task-kidnap';  icon.textContent = '🪢'; }
    else                        { box.className = 'task-survive'; icon.textContent = '🛡️'; }

    this._flashSimonBanner(task.label);
  }

  // ── Health ───────────────────────────────────────

  setHealth(hp, max) {
    const fill = this.el.querySelector('#health-fill');
    fill.style.width      = `${Math.max(0, hp / max) * 100}%`;
    fill.style.background = hp > 1 ? '#2ecc71' : '#e74c3c';
  }

  // ── Wanted ───────────────────────────────────────

  setWanted(level) {
    const el = this.el.querySelector('#wanted-display');
    if (!level) { el.style.display = 'none'; return; }
    el.style.display  = 'block';
    el.textContent    = '⭐'.repeat(level);
  }

  // ── Ally ─────────────────────────────────────────

  setAllyInfo(allyName) {
    const el = this.el.querySelector('#ally-info');
    if (!allyName) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `🤝 <strong>Secret Ally:</strong>&nbsp;${allyName} <span style="color:#aaa;font-size:0.75rem">&nbsp;— betray for +400!</span>`;
  }

  // ── Bounty ───────────────────────────────────────

  setBountyActive(active) {
    this.el.querySelector('#bounty-banner').style.display = active ? 'block' : 'none';
  }

  // ── Direction arrow ──────────────────────────────

  setTargetArrow(angleDeg) {
    const arrow = this.el.querySelector('#target-arrow');
    if (angleDeg === null) { arrow.style.opacity = '0'; return; }
    arrow.style.opacity   = '1';
    arrow.style.transform = `translateX(-50%) rotate(${angleDeg}deg)`;
  }

  // ── Escape prompt ────────────────────────────────

  showEscapePrompt(show) {
    this.el.querySelector('#escape-prompt').style.display = show ? 'block' : 'none';
  }

  // ── Respawn overlay ──────────────────────────────

  showRespawnCountdown(seconds) {
    const overlay = this.el.querySelector('#respawn-overlay');
    overlay.style.display = 'flex';
    this.el.querySelector('#respawn-count').textContent = seconds;
  }

  hideRespawn() {
    this.el.querySelector('#respawn-overlay').style.display = 'none';
  }

  // ── Arrest overlay ───────────────────────────────

  showArrestCountdown(seconds) {
    const overlay = this.el.querySelector('#arrest-overlay');
    overlay.style.display = 'flex';
    this.el.querySelector('#arrest-count').textContent = seconds;
  }

  hideArrestCountdown() {
    this.el.querySelector('#arrest-overlay').style.display = 'none';
  }

  // ── Damage flash ─────────────────────────────────

  flashDamage() {
    const flash = this.el.querySelector('#damage-flash');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 350);
  }

  // ── Simon banner ─────────────────────────────────

  _flashSimonBanner(text) {
    const banner = this.el.querySelector('#simon-banner');
    banner.textContent = text;
    banner.classList.add('visible');
    setTimeout(() => banner.classList.remove('visible'), 4000);
  }

  showCountdown(seconds) {
    this._flashSimonBanner(`Game starting in ${seconds}s...`);
  }

  // ── Score + events ───────────────────────────────

  setScore(score) { this.el.querySelector('#score-val').textContent = score; }

  addEvent(msg, type = 'neutral') {
    const feed = this.el.querySelector('#event-feed');
    const item = document.createElement('div');
    item.className = `event-item event-${type}`;
    item.textContent = msg;
    feed.prepend(item);
    if (feed.children.length > 5) feed.removeChild(feed.lastChild);
    setTimeout(() => item.remove(), 6000);
  }

  setActionHint(text) {
    const hint = this.el.querySelector('#action-hint');
    hint.textContent  = text;
    hint.style.opacity = text ? '1' : '0';
  }

  // ── Game end ─────────────────────────────────────

  showGameEnd(leaderboard, myId, onPlayAgain) {
    if (this._gameTimerInterval) clearInterval(this._gameTimerInterval);
    const winner   = leaderboard[0];
    const isWinner = winner?.id === myId;
    const overlay  = document.createElement('div');
    overlay.id = 'end-screen';
    overlay.innerHTML = `
      <h1>${isWinner ? '🏆 YOU WIN!' : '💀 GAME OVER'}</h1>
      <div class="leaderboard">
        ${leaderboard.map((p, i) => `
          <div class="lb-row ${p.id === myId ? 'lb-me' : ''}">
            <span class="lb-rank">${['🥇','🥈','🥉','4️⃣'][i] || (i + 1)}</span>
            <span class="lb-name">${p.name}</span>
            <span class="lb-score">${p.score} pts</span>
          </div>
        `).join('')}
      </div>
      <button id="btn-play-again">Play Again</button>
    `;
    document.body.appendChild(overlay);
    this._endOverlay = overlay;
    overlay.querySelector('#btn-play-again').addEventListener('click', () => onPlayAgain?.());
  }

  removeGameEnd() {
    if (this._endOverlay) {
      this._endOverlay.remove();
      this._endOverlay = null;
    }
  }

  show() { this.el.style.display = 'block'; }
  hide() { this.el.style.display = 'none'; }

  destroy() {
    this.settingsPanel?.destroy();
  }
}

function _mmss(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
