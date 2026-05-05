# 🎵 Lyrics On Top

A transparent, always-on-top desktop lyrics overlay for Windows. Displays live synced lyrics from Spotify with a clean karaoke-style animation. Built with Electron, powered by the Spotify Web API and LRCLIB.

> Your own customizable alternative to Sunamu.

---

## Preview

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    │   And I just can't let you go       │  ← prev (faded)
                    │                                     │
                    │   Day after day, time pass away     │  ← current (bright)
                    │                                     │
                    │   Nobody knows, I hide it inside    │  ← next (faded)
                    │                                     │
                    │                    Westlife — ...   │
                    └─────────────────────────────────────┘
```

Floats over your desktop. Draggable. Click-through when locked.

---

## Features

- ✅ Live synced lyrics — pulled from LRCLIB, matched to Spotify playback progress in real time
- ✅ Karaoke 3-line display — prev / current / next with slot-machine shift animation
- ✅ Pre-roll timing — line swaps 150ms early so it never feels late
- ✅ Instrumental gap handling — dims and pulses during sections with no lyrics
- ✅ Repeated line detection — scale ping so you know it's a new instance
- ✅ Ambient visualizer fallback — plays an abstract animation when no lyrics are found
- ✅ Auto token refresh — Spotify token silently refreshes, never expires mid-session
- ✅ Persistent login — Spotify credentials saved locally, no re-auth on restart
- ✅ Transparent overlay — no background, lyrics float over anything on screen
- ✅ Draggable + click-through toggle — lock it so clicks pass straight to the desktop
- ✅ Always-on-top toggle — pin the overlay above all windows or let it stay on desktop
- ✅ Track info footer — artist and title always visible
- ✅ **Settings app** — full customization panel with real-time preview

### Settings App Features

- 🎨 **5 Theme Presets** — Warm Amber, Cool Blue, Neon Purple, Minimal Dark, Spotify Green
- ✨ **5 Animation Styles** — Fade & Slide, Simple Fade, Slide Up, Zoom In, Typewriter
- 🖼️ **Album Cover Display** — Show album art (left, right, or blurred background)
- ⏱️ **Song Progress** — Elapsed time, remaining time, or both
- 🎭 **Typography Controls** — Custom fonts, sizes, and weights
- 📐 **Layout Options** — Single line, 2-line, or 3-line display
- 🌊 **Visualizer with Lyrics** — Show ambient animation behind lyrics
- 💾 **Auto-save** — All settings persist automatically

---

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop window | Electron 28 |
| UI | Vanilla HTML / CSS / JS |
| Music source | Spotify Web API |
| Lyrics source | LRCLIB (free, no API key) |
| Auth server | Express (local, only during OAuth) |
| HTTP | Axios |

---

## Project Structure

```
lyrics-on-top/
├── main.js          → Electron main process. Window creation, polling loop, IPC events
├── spotify.js       → SpotifyPoller class. OAuth flow, token refresh, getCurrentTrack()
├── lyrics.js        → fetchLyrics() from LRCLIB, parseLRC() timestamp parser
├── config.js        → ConfigManager class. Settings persistence, theme/animation presets
├── renderer.html    → The overlay UI. Lyric display, animations, visualizer fallback
├── settings.html    → Settings panel UI. Theme picker, toggles, sliders
└── package.json
```

---

## Setup

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in any name and description
4. Add `http://127.0.0.1:8888/callback` as a **Redirect URI**
5. Save, then go to **Settings**
6. Copy your **Client ID** and **Client Secret**

### 2. Add Credentials

Open `spotify.js` and paste your credentials at the top:

```js
const CLIENT_ID = 'your_client_id_here';
const CLIENT_SECRET = 'your_client_secret_here';
```

### 3. Install & Run

```bash
npm install
npm start
```

On first launch, a browser tab opens for Spotify login. Approve it, close the tab, and the overlay appears on your desktop. **Subsequent launches skip the login** — your tokens are saved locally.

---

## Usage

| Action | How |
|---|---|
| Move overlay | Click and drag anywhere |
| Toggle click-through | Click 🔓 button or `Ctrl+Shift+L` |
| Toggle always-on-top | Click 📌 button |
| Open settings | Click ⚙️ button or `Ctrl+Shift+S` |
| Stop the app | Close the window or `Ctrl+C` in terminal |

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+L` | Toggle click-through (lock/unlock) |
| `Ctrl+Shift+S` | Open settings window |

---

## How It Works

```
Every 1 second:
  → Poll Spotify API → get track name, artist, progress_ms, album art
  → If track changed → fetch lyrics from LRCLIB → parse LRC timestamps
  → Match progress_ms to lyrics array (with -150ms pre-roll)
  → Send { prev, current, next } to renderer via IPC
  → Renderer animates the line transition with current theme/animation
```

### Lyric Sync
LRCLIB returns lyrics in `.lrc` format with timestamps like:
```
[00:14.50] Day after day, time pass away
[00:18.20] And I just can't let you go
```
These are parsed into `{ time: 14.5, text: "Day after day..." }` objects and matched against Spotify's `progress_ms` every second.

### No-Lyrics Fallback
If LRCLIB has no synced lyrics for a track, the lyric display fades out and an abstract ambient animation (waves/particles) plays instead with the track name shown below it.

---

## Customization

### Using the Settings App

Press `Ctrl+Shift+S` or click the ⚙️ button to open the settings panel. Changes apply in real-time to the overlay.

**Appearance Tab**
- Choose from 5 color themes

**Animations Tab**
- Select animation style (fade, slide, zoom, typewriter)
- Adjust animation duration (100ms - 1000ms)

**Display Tab**
- Toggle album cover (with position and size options)
- Toggle song progress (elapsed, remaining, or both)
- Enable visualizer behind lyrics
- Choose layout mode (1, 2, or 3 lines)

**Typography Tab**
- Customize fonts for current and context lines
- Adjust font sizes and weights

**Advanced Tab**
- Window opacity
- Reset all settings to defaults

### Manual CSS Customization

For deeper customization, edit CSS variables in `renderer.html`:

```css
:root {
  --color-current: #fffaf0;              /* current line color */
  --color-faded: rgba(255, 250, 240, 0.35); /* context lines */
  --color-accent: #d4a24e;               /* accent color */
}
```

---

## IPC Events Reference

### main → renderer
| Event | Payload | Description |
|---|---|---|
| `lyric-update` | `{ prev, current, next }` | Fires every second while playing |
| `track-change` | `{ title, artist, albumCover, durationMs }` | New song detected |
| `progress-update` | `{ progressMs, durationMs }` | Current playback position |
| `no-track` | — | Nothing playing on Spotify |
| `no-lyrics` | — | LRCLIB returned no synced lyrics |
| `settings-updated` | `{ ...settings }` | Settings changed |
| `clickthrough-changed` | `boolean` | Click-through state changed |
| `always-on-top-changed` | `boolean` | Always-on-top state changed |

### renderer → main
| Event | Payload | Description |
|---|---|---|
| `toggle-clickthrough` | — | Toggle click-through mode |
| `toggle-always-on-top` | — | Toggle always-on-top mode |
| `open-settings` | — | Open settings window |

---

## Data Storage

All user data is stored in your system's app data folder:

| File | Purpose |
|---|---|
| `spotify-tokens.json` | Spotify OAuth tokens (auto-refreshed) |
| `settings.json` | All customization preferences |

**Location:**
- Windows: `%APPDATA%/lyrics-on-top/`
- macOS: `~/Library/Application Support/lyrics-on-top/`
- Linux: `~/.config/lyrics-on-top/`

---

## Known Limitations

- Lyrics availability depends on LRCLIB — works great for popular tracks, may miss remixes or obscure songs
- Spotify free tier works fine for read-only currently-playing data
- Album cover requires active Spotify playback

---

## License

MIT — build whatever you want with it.
