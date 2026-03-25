const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const SpotifyPoller = require('./spotify');
const { fetchLyrics, parseLRC } = require('./lyrics');
const { ConfigManager } = require('./config');

let win;
let settingsWin;
let poller;
let pollingInterval;
let configManager;

// Current state
let currentLyrics = [];   // [{ time, text }]
let currentTrackId = null;
let hasLyrics = false;
let isClickThrough = false;
let isPinned = false;

function setClickThrough(enabled, skipNotify = false) {
  isClickThrough = enabled;
  if (!win) return;
  win.setIgnoreMouseEvents(enabled, { forward: true });
  if (!skipNotify) {
    win.webContents.send('clickthrough-changed', isClickThrough);
  }
}

function setAlwaysOnTop(enabled, skipNotify = false) {
  isPinned = enabled;
  if (!win) return;
  win.setAlwaysOnTop(isPinned, 'screen-saver');
  if (!skipNotify) {
    win.webContents.send('always-on-top-changed', isPinned);
  }
}

function toggleClickThrough() {
  setClickThrough(!isClickThrough);
}

function toggleAlwaysOnTop() {
  setAlwaysOnTop(!isPinned);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 800,
    height: 260,
    x: Math.round((width - 800) / 2),
    y: height - 300,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('renderer.html');
  setClickThrough(false, true);
  setAlwaysOnTop(false, true);
}

ipcMain.on('toggle-clickthrough', () => {
  toggleClickThrough();
});

ipcMain.on('toggle-always-on-top', () => {
  toggleAlwaysOnTop();
});

// ── Settings Window ─────────────────────────────────
function createSettingsWindow() {
  if (settingsWin) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 680,
    height: 580,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWin.loadFile('settings.html');

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('get-settings', (event) => {
  event.sender.send('settings-data', configManager.getAll());
});

ipcMain.on('save-settings', (_event, settings) => {
  configManager.setAll(settings);
  // Send updated settings to the main overlay window for real-time updates
  if (win && !win.isDestroyed()) {
    win.webContents.send('settings-updated', configManager.getAll());
  }
});

ipcMain.on('reset-settings', (event) => {
  configManager.reset();
  event.sender.send('settings-data', configManager.getAll());
  if (win && !win.isDestroyed()) {
    win.webContents.send('settings-updated', configManager.getAll());
  }
});

ipcMain.on('minimize-settings', () => {
  if (settingsWin) settingsWin.minimize();
});

ipcMain.on('close-settings', () => {
  if (settingsWin) settingsWin.close();
});

/**
 * Finds the current lyric line index for the given playback position.
 */
function findLineIndex(progressMs) {
  let idx = 0;
  for (let i = 0; i < currentLyrics.length; i++) {
    if (currentLyrics[i].time <= progressMs) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

/**
 * Main polling loop — runs every 1 second.
 */
async function pollSpotify() {
  const track = await poller.getCurrentTrack();

  if (!track || !track.isPlaying) {
    win.webContents.send('no-track');
    return;
  }

  // Track changed — fetch new lyrics
  if (track.trackId !== currentTrackId) {
    currentTrackId = track.trackId;
    win.webContents.send('track-change', {
      title: track.title,
      artist: track.artist,
      albumCover: track.albumCover,
      durationMs: track.durationMs,
    });

    const lrcString = await fetchLyrics(track.title, track.artist);
    if (lrcString) {
      currentLyrics = parseLRC(lrcString);
      hasLyrics = true;
    } else {
      currentLyrics = [];
      hasLyrics = false;
      win.webContents.send('no-lyrics');
      return;
    }
  }

  // Send progress update
  win.webContents.send('progress-update', {
    progressMs: track.progressMs,
    durationMs: track.durationMs,
  });

  if (!hasLyrics || currentLyrics.length === 0) return;

  const idx = findLineIndex(track.progressMs);
  const prev = idx > 0 ? currentLyrics[idx - 1].text : '';
  const current = currentLyrics[idx].text;
  const next = idx < currentLyrics.length - 1 ? currentLyrics[idx + 1].text : '';

  win.webContents.send('lyric-update', { prev, current, next });
}

app.whenReady().then(async () => {
  configManager = new ConfigManager();
  createWindow();

  // Send initial settings to overlay
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('clickthrough-changed', isClickThrough);
    win.webContents.send('always-on-top-changed', isPinned);
    win.webContents.send('settings-updated', configManager.getAll());
  });

  if (!globalShortcut.register('CommandOrControl+Shift+L', () => toggleClickThrough())) {
    console.warn('[Main] Unable to register Ctrl+Shift+L shortcut for the overlay lock.');
  }

  // Register Ctrl+Shift+S to open settings
  if (!globalShortcut.register('CommandOrControl+Shift+S', () => createSettingsWindow())) {
    console.warn('[Main] Unable to register Ctrl+Shift+S shortcut for settings.');
  }

  poller = new SpotifyPoller();

  try {
    // Only authenticate if no refresh token exists
    if (!poller.refreshToken) {
      await poller.authenticate();
      console.log('[Main] Spotify authenticated ✓');
    } else {
      console.log('[Main] Using saved Spotify tokens');
    }
    pollingInterval = setInterval(pollSpotify, 1000);
  } catch (err) {
    console.error('[Main] Auth failed:', err.message);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  clearInterval(pollingInterval);
  app.quit();
});
