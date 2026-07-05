const DEFAULTS = {
  masterVolume: 0.85,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  ambientVolume: 0.35,
  graphicsQuality: 'high',
  cameraView: 'tactical',
};

const STORAGE_KEY = 'ssa_settings';

export class SettingsStore {
  constructor() {
    this.values = this._load();
    this.listeners = new Set();
  }

  get() {
    return { ...this.values };
  }

  update(patch) {
    this.values = { ...this.values, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    for (const listener of this.listeners) listener(this.get());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.get());
    return () => this.listeners.delete(listener);
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }
}

export const settingsStore = new SettingsStore();

export function createSettingsPanel(store = settingsStore) {
  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div class="settings-panel">
      <div class="settings-head">
        <h2>Settings</h2>
        <button class="settings-close" type="button">Close</button>
      </div>
      <label class="setting-row">
        <span>Master Volume</span>
        <input data-setting="masterVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="setting-row">
        <span>Music</span>
        <input data-setting="musicVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="setting-row">
        <span>Effects</span>
        <input data-setting="sfxVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="setting-row">
        <span>City Ambience</span>
        <input data-setting="ambientVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="setting-row">
        <span>Graphics</span>
        <select data-setting="graphicsQuality">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label class="setting-row">
        <span>Camera</span>
        <select data-setting="cameraView">
          <option value="tactical">Tactical</option>
          <option value="thirdPerson">3D Follow</option>
        </select>
      </label>
    </div>
  `;

  const sync = (values) => {
    for (const input of overlay.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      input.value = values[key];
    }
  };
  const unsubscribe = store.subscribe(sync);

  overlay.addEventListener('input', (event) => {
    const input = event.target.closest('[data-setting]');
    if (!input) return;
    const key = input.dataset.setting;
    const value = input.type === 'range' ? Number(input.value) : input.value;
    store.update({ [key]: value });
  });

  overlay.querySelector('.settings-close').addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.style.display = 'none';
  });

  return {
    el: overlay,
    show() { overlay.style.display = 'flex'; },
    destroy() { unsubscribe(); overlay.remove(); },
  };
}
