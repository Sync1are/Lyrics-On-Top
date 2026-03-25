const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  theme: 'warm-amber',
  themes: {
    'warm-amber': {
      colorCurrent: '#fffaf0',
      colorFaded: 'rgba(255, 250, 240, 0.35)',
      colorAccent: '#d4a24e',
      colorAccentLow: 'rgba(212, 162, 78, 0.25)',
      colorTrack: 'rgba(255, 250, 240, 0.5)',
      colorMuted: 'rgba(255, 250, 240, 0.18)',
    },
    'cool-blue': {
      colorCurrent: '#e0f0ff',
      colorFaded: 'rgba(224, 240, 255, 0.35)',
      colorAccent: '#4a9eff',
      colorAccentLow: 'rgba(74, 158, 255, 0.25)',
      colorTrack: 'rgba(224, 240, 255, 0.5)',
      colorMuted: 'rgba(224, 240, 255, 0.18)',
    },
    'neon-purple': {
      colorCurrent: '#f0e0ff',
      colorFaded: 'rgba(240, 224, 255, 0.35)',
      colorAccent: '#b44aff',
      colorAccentLow: 'rgba(180, 74, 255, 0.25)',
      colorTrack: 'rgba(240, 224, 255, 0.5)',
      colorMuted: 'rgba(240, 224, 255, 0.18)',
    },
    'minimal-dark': {
      colorCurrent: '#ffffff',
      colorFaded: 'rgba(255, 255, 255, 0.30)',
      colorAccent: '#888888',
      colorAccentLow: 'rgba(136, 136, 136, 0.25)',
      colorTrack: 'rgba(255, 255, 255, 0.45)',
      colorMuted: 'rgba(255, 255, 255, 0.15)',
    },
    'spotify-green': {
      colorCurrent: '#e0ffe0',
      colorFaded: 'rgba(224, 255, 224, 0.35)',
      colorAccent: '#1db954',
      colorAccentLow: 'rgba(29, 185, 84, 0.25)',
      colorTrack: 'rgba(224, 255, 224, 0.5)',
      colorMuted: 'rgba(224, 255, 224, 0.18)',
    },
  },
  animation: {
    style: 'fade-slide',
    duration: 420,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
  animations: {
    'fade-slide': {
      name: 'Fade & Slide',
      keyframes: `
        0% { opacity: 0; transform: translateY(14px); }
        100% { opacity: 1; transform: translateY(0); }
      `,
    },
    'fade': {
      name: 'Simple Fade',
      keyframes: `
        0% { opacity: 0; }
        100% { opacity: 1; }
      `,
    },
    'slide-up': {
      name: 'Slide Up',
      keyframes: `
        0% { opacity: 0; transform: translateY(30px); }
        100% { opacity: 1; transform: translateY(0); }
      `,
    },
    'zoom': {
      name: 'Zoom In',
      keyframes: `
        0% { opacity: 0; transform: scale(0.8); }
        100% { opacity: 1; transform: scale(1); }
      `,
    },
    'typewriter': {
      name: 'Typewriter',
      keyframes: `
        0% { opacity: 0; transform: translateX(-20px); }
        100% { opacity: 1; transform: translateX(0); }
      `,
    },
  },
  typography: {
    currentFont: 'Playfair Display',
    currentSize: 32,
    currentWeight: 500,
    contextFont: 'DM Sans',
    contextSize: 15,
    contextWeight: 400,
  },
  display: {
    showVisualizer: false,
    visualizerWithLyrics: false,
    showAlbumCover: false,
    albumCoverPosition: 'left',
    albumCoverSize: 80,
    showProgress: false,
    progressFormat: 'elapsed', // 'elapsed', 'remaining', 'both'
    progressPosition: 'bottom-right',
    layout: 'three-line',
  },
  window: {
    position: 'bottom-center',
    opacity: 1.0,
    width: 800,
    height: 260,
  },
};

class ConfigManager {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        // Merge with defaults to ensure all keys exist
        return this.deepMerge(DEFAULT_SETTINGS, data);
      }
    } catch (err) {
      console.error('[Config] Failed to load settings:', err.message);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  saveSettings() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.settings, null, 2));
      console.log('[Config] Settings saved');
    } catch (err) {
      console.error('[Config] Failed to save settings:', err.message);
    }
  }

  get(key) {
    const keys = key.split('.');
    let value = this.settings;
    for (const k of keys) {
      if (value === undefined) return undefined;
      value = value[k];
    }
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this.settings;
    for (let i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] === undefined) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this.saveSettings();
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.settings));
  }

  setAll(settings) {
    this.settings = this.deepMerge(DEFAULT_SETTINGS, settings);
    this.saveSettings();
  }

  getTheme() {
    const themeName = this.settings.theme;
    return this.settings.themes[themeName] || this.settings.themes['warm-amber'];
  }

  getAnimation() {
    const animName = this.settings.animation.style;
    const anim = this.settings.animations[animName] || this.settings.animations['fade-slide'];
    return {
      ...anim,
      duration: this.settings.animation.duration,
      easing: this.settings.animation.easing,
    };
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  reset() {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }
}

module.exports = { ConfigManager, DEFAULT_SETTINGS };
