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
- ✅ Transparent overlay — no background, lyrics float over anything on screen
- ✅ Draggable + click-through toggle — lock it so clicks pass straight to the desktop
- ✅ Track info footer — artist and title always visible

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
lyrics-overlay/
├── main.js          → Electron main process. Window creation, polling loop, IPC events
├── spotify.js       → SpotifyPoller class. OAuth flow, token refresh, getCurrentTrack()
├── lyrics.js        → fetchLyrics() from LRCLIB, parseLRC() timestamp parser
├── renderer.html    → The overlay UI. Lyric display, animations, visualizer fallback
└── package.json
```

---

## Setup

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in any name and description
4. Add `http://localhost:8888/callback` as a **Redirect URI**
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

On first launch, a browser tab opens for Spotify login. Approve it, close the tab, and the overlay appears on your desktop.

---

## Usage

| Action | How |
|---|---|
| Move overlay | Click and drag anywhere |
| Toggle click-through | Click the 🔓 button (top right) |
| Lock to desktop | Click 🔓 → becomes 🔒, clicks pass through |
| Stop the app | Close the window or Ctrl+C in terminal |

---

## How It Works

```
Every 1 second:
  → Poll Spotify API → get track name, artist, progress_ms
  → If track changed → fetch lyrics from LRCLIB → parse LRC timestamps
  → Match progress_ms to lyrics array (with -150ms pre-roll)
  → Send { prev, current, next } to renderer via IPC
  → Renderer animates the line transition
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

All visual variables are at the top of `renderer.html`:

```css
:root {
  --current: rgba(255, 255, 255, 0.95);   /* current line color */
  --prev-next: rgba(255, 255, 255, 0.35); /* faded lines color */
  --accent: rgba(255, 200, 120, 0.85);    /* warm accent */
}
```

**Window size and position** — edit `createOverlay()` in `main.js`:
```js
width: 600,
height: 200,
x: ...,   // horizontal position
y: ...,   // vertical position
```

**Fonts** — swap the Google Fonts link in `renderer.html` and update the CSS font-family properties.

---

## IPC Events Reference

### main → renderer
| Event | Payload | Description |
|---|---|---|
| `lyric-update` | `{ prev, current, next }` | Fires every second while playing |
| `track-change` | `{ title, artist }` | New song detected |
| `no-track` | — | Nothing playing on Spotify |
| `no-lyrics` | — | LRCLIB returned no synced lyrics |

### renderer → main
| Event | Payload | Description |
|---|---|---|
| `toggle-clickthrough` | `boolean` | Toggles setIgnoreMouseEvents() |

---

## Planned Features

- [ ] Album art blur background
- [ ] Dynamic color theming from album art (node-vibrant)
- [ ] Playback progress bar
- [ ] Global hotkeys (play/pause, skip)
- [ ] Auto-hide on pause
- [ ] Lyrics cache (local JSON by track ID)
- [ ] Local music file support (music-metadata)
- [ ] Settings panel (font, color, opacity, position)
- [ ] System tray icon

---

## Known Limitations

- Lyrics availability depends on LRCLIB — works great for popular tracks, may miss remixes or obscure songs
- Spotify free tier works fine for read-only currently-playing data
- Token refresh is in-memory only — re-authenticates if the app is restarted

---

## License

MIT — build whatever you want with it.
