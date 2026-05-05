const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const SpotifyPoller = require('./spotify');
const { fetchLyrics, parseLRC } = require('./lyrics');
const { ConfigManager } = require('./config');

let win;
let settingsWin;
let poller;
let pollingInterval;
let configManager;
let tray = null;

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
  const winSettings = configManager.get('window');

  let defaultX = Math.round((width - 800) / 2);
  let defaultY = height - 300;

  win = new BrowserWindow({
    width: winSettings.width || 800,
    height: winSettings.height || 260,
    x: winSettings.x !== null ? winSettings.x : defaultX,
    y: winSettings.y !== null ? winSettings.y : defaultY,
    transparent: true,
    frame: false,
    alwaysOnTop: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.on('moved', () => {
    const bounds = win.getBounds();
    configManager.set('window.x', bounds.x);
    configManager.set('window.y', bounds.y);
  });

  win.on('resized', () => {
    const bounds = win.getBounds();
    configManager.set('window.width', bounds.width);
    configManager.set('window.height', bounds.height);
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
    icon: path.join(__dirname, 'icon.png'),
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
  
  // Handle start on boot
  if (settings.system && settings.system.startOnBoot !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: settings.system.startOnBoot,
      path: app.getPath('exe')
    });
  }

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
 * Truncates lyrics to a max number of words if maxWordsPerLine is configured > 0
 */
function truncateWords(text, maxWords) {
  if (!text || maxWords <= 0) return text;
  const words = text.split(/\s+/);
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return text;
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

  const latency = configManager.get('system.latency') ?? 300;
  const adjustedProgressMs = Math.max(0, track.progressMs + latency);

  const idx = findLineIndex(adjustedProgressMs);
  let prev = idx > 0 ? currentLyrics[idx - 1].text : '';
  let current = currentLyrics[idx].text;
  let next = idx < currentLyrics.length - 1 ? currentLyrics[idx + 1].text : '';
  
  const maxWords = configManager.get('display.maxWordsPerLine') || 0;
  if (maxWords > 0) {
    prev = truncateWords(prev, maxWords);
    current = truncateWords(current, maxWords);
    next = truncateWords(next, maxWords);
  }

  const startTime = currentLyrics[idx].time;
  const endTime = idx < currentLyrics.length - 1 ? currentLyrics[idx + 1].time : track.durationMs;

  win.webContents.send('lyric-update', {
    prev,
    current,
    next,
    currentIndex: idx,
    startTime,
    endTime,
    progressMs: track.progressMs,
    durationMs: track.durationMs,
  });
}

app.whenReady().then(async () => {
  configManager = new ConfigManager();
  createWindow();

  // Load the new icon from the file system
  const trayIconPath = path.join(__dirname, 'icon.png');
  const trayIcon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Lyrics On Top');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Settings', click: () => createSettingsWindow() },
    { label: 'Toggle Click-Through', click: () => toggleClickThrough() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  
  // Double-clicking tray icon opens settings
  tray.on('double-click', () => createSettingsWindow());

  // Sync login item settings with config
  const sysSettings = configManager.get('system');
  if (sysSettings && sysSettings.startOnBoot !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: sysSettings.startOnBoot,
      path: app.getPath('exe')
    });
  }

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
