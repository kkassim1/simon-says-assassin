export class SoundManager {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }

  play(type) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (type) {
      case 'hit':       this._hit();    break;
      case 'kill':      this._kill();   break;
      case 'task':      this._task();   break;
      case 'kidnap':    this._kidnap(); break;
      case 'escape':    this._escape(); break;
      case 'trap':      this._trap();   break;
      case 'wanted':    this._wanted(); break;
      case 'bounty':    this._bounty(); break;
      case 'betrayal':  this._betrayal(); break;
    }
  }

  _tone(freq, dur, type = 'square', vol = 0.28, delayMs = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delayMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  _hit() {
    this._tone(160, 0.08, 'sawtooth', 0.4);
    this._tone(100, 0.12, 'sawtooth', 0.25, 60);
  }

  _kill() {
    this._tone(440, 0.12, 'square', 0.45);
    this._tone(330, 0.18, 'sawtooth', 0.35, 110);
    this._tone(110, 0.45, 'sawtooth', 0.3, 260);
  }

  _task() {
    // Ascending three-note chime
    this._tone(523, 0.14, 'sine', 0.3);
    this._tone(659, 0.14, 'sine', 0.3, 140);
    this._tone(784, 0.22, 'sine', 0.35, 280);
  }

  _kidnap() {
    this._tone(220, 0.06, 'sawtooth', 0.5);
    this._tone(196, 0.06, 'sawtooth', 0.45, 70);
    this._tone(165, 0.12, 'sawtooth', 0.4, 140);
  }

  _escape() {
    this._tone(400, 0.1, 'sine', 0.4);
    this._tone(600, 0.12, 'sine', 0.4, 100);
    this._tone(900, 0.18, 'sine', 0.35, 210);
  }

  _trap() {
    this._tone(196, 0.4, 'sawtooth', 0.3);
    this._tone(174, 0.4, 'sawtooth', 0.28, 180);
  }

  _wanted() {
    this._tone(880, 0.1, 'square', 0.32);
    this._tone(880, 0.1, 'square', 0.32, 180);
    this._tone(660, 0.3, 'square', 0.28, 360);
  }

  _bounty() {
    this._tone(659, 0.1, 'sine', 0.35);
    this._tone(784, 0.1, 'sine', 0.35, 110);
    this._tone(1047, 0.25, 'sine', 0.4, 220);
  }

  _betrayal() {
    // Dramatic descending sting
    this._tone(600, 0.1, 'square', 0.5);
    this._tone(500, 0.1, 'square', 0.45, 100);
    this._tone(400, 0.1, 'square', 0.4, 200);
    this._tone(300, 0.5, 'sawtooth', 0.35, 300);
  }
}
