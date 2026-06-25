export class SoundManager {
  constructor(settingsStore = null) {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
    this.settings = {
      masterVolume: 0.85,
      musicVolume: 0.45,
      sfxVolume: 0.8,
      ambientVolume: 0.35,
    };
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this._musicNodes = [];
    this._ambientNodes = [];
    this._musicTimer = null;
    this._ambientTimer = null;

    if (this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    this._unsubscribe = settingsStore?.subscribe((settings) => this.applySettings(settings)) || null;
    this.applySettings(this.settings);
  }

  play(type) {
    if (!this.ctx) return;
    this.resume();
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

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.masterVolume, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.08);
    this.ambientGain.gain.setTargetAtTime(this.settings.ambientVolume, now, 0.08);
  }

  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    this.resume();
    const playBar = () => {
      const notes = [110, 146.83, 164.81, 196, 220, 196, 164.81, 146.83];
      notes.forEach((freq, i) => this._musicTone(freq, 0.42, i * 360));
      this._musicTone(55, 1.8, 0, 'sine', 0.18);
      this._musicTone(65.41, 1.8, 1440, 'sine', 0.15);
    };
    playBar();
    this._musicTimer = setInterval(playBar, 2880);
  }

  startAmbience() {
    if (!this.ctx || this._ambientTimer) return;
    this.resume();
    this._startNoiseBed();
    const pulseCity = () => {
      this._ambientTone(70 + Math.random() * 25, 0.3, 'sawtooth', 0.06);
      if (Math.random() > 0.55) this._ambientTone(420 + Math.random() * 220, 0.18, 'triangle', 0.035, 220);
    };
    pulseCity();
    this._ambientTimer = setInterval(pulseCity, 1200);
  }

  stopAllLoops() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    if (this._ambientTimer) clearInterval(this._ambientTimer);
    this._musicTimer = null;
    this._ambientTimer = null;
    for (const node of [...this._musicNodes, ...this._ambientNodes]) {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    }
    this._musicNodes = [];
    this._ambientNodes = [];
  }

  destroy() {
    this.stopAllLoops();
    this._unsubscribe?.();
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
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  _musicTone(freq, dur, delayMs = 0, type = 'triangle', vol = 0.12) {
    this._loopTone(freq, dur, type, vol, delayMs, this.musicGain, this._musicNodes);
  }

  _ambientTone(freq, dur, type = 'sine', vol = 0.05, delayMs = 0) {
    this._loopTone(freq, dur, type, vol, delayMs, this.ambientGain, this._ambientNodes);
  }

  _loopTone(freq, dur, type, vol, delayMs, output, bucket) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delayMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(output);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    bucket.push(osc);
    osc.onended = () => {
      const idx = bucket.indexOf(osc);
      if (idx >= 0) bucket.splice(idx, 1);
    };
  }

  _startNoiseBed() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    noise.buffer = buffer;
    noise.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.value = 0.18;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    noise.start();
    this._ambientNodes.push(noise, filter, gain);
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
