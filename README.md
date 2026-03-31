# myspotify 🎵

A beautiful, fully customizable personal Spotify client built with Flask + vanilla JS.

![myspotify](https://img.shields.io/badge/myspotify-v4.1-1db954?style=for-the-badge)

## ✨ Features

- **Dynamic Island** — Apple-style nav pill that expands with full controls + navigation
- **Living Background** — Ambient background that follows album art colors
- **Real Visualizer** — FFT frequency-reactive bars (bass/mid/treble each react differently)
- **Lyrics** — Synced lyrics from LRCLib + fullscreen lyrics mode
- **EQ** — 7-band equalizer with presets (Bass Boost, Pop, Rock, Jazz, Classical…)
- **Full customization** — Accent colors, home layout, player bar style, all toggleable
- **Persistent login** — Stay logged in between restarts, no re-login needed
- **Sleep timer** — Auto-pause after X minutes or end of track
- **Track & Artist Radio** — Instant recommendations
- **All Spotify features** — Playlists, albums, artists, queue, devices, search, follow…

---

## 🚀 First-Time Setup (Windows)

### 1. Install Python
Download from [python.org](https://python.org) — make sure to check **"Add Python to PATH"** during install.

### 2. Create a Spotify App
1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in any name/description
5. Set **Redirect URI** to exactly: `http://127.0.0.1:5001/callback`
6. Copy your **Client ID** and **Client Secret**

### 3. Start myspotify
Double-click **`start.bat`** — it will:
- Automatically install dependencies (first time only)
- Start the server
- Open your browser at `http://127.0.0.1:5001`

### 4. Connect Spotify
On first run, paste your Client ID and Client Secret. After that, click **Continue with Spotify** and log in once. **You will never need to do this again** — your login is saved.

---

## 🎹 Keyboard Shortcuts

| Action | Shortcut |
|--------|---------|
| Play / Pause | `Space` |
| Next track | `⌘/Ctrl + →` |
| Previous track | `⌘/Ctrl + ←` |
| Volume up/down | `⌘/Ctrl + ↑/↓` |
| Search | `⌘/Ctrl + F` |
| Now Playing | `N` |
| Queue | `⌘/Ctrl + Q` |
| Visualizer | `V` |
| Customize | `C` |
| Fullscreen lyrics | `⌘/Ctrl + L` |
| Shuffle | `S` |
| Repeat | `R` |
| Like track | `L` |
| Track radio | `T` |
| Sleep timer | `⌘/Ctrl + T` |
| Settings | `⌘/Ctrl + ,` |
| All shortcuts | `?` |

---

## 🛠️ Troubleshooting

**"Could not connect to server"** → Make sure start.bat is running

**"Token exchange failed"** → Double-check your Client Secret is correct

**"Spotify Premium required"** → The Web Playback SDK requires Spotify Premium. You can still browse and control playback on other devices without Premium.

**Login always asks again** → This is fixed in v4.1 — credentials and tokens are now saved to `settings.json`

**Visualizer doesn't move to the music** → The visualizer uses the Web Audio API to intercept the Spotify SDK's audio. This requires Chrome/Edge. If it doesn't connect, it falls back to a BPM-synced simulation.

---

## 🌐 Running Online (for everyone)

> ⚠️ **Important note about running this publicly:**

This app works locally because Spotify only allows `127.0.0.1` as a Redirect URI for personal apps. To run it for multiple users:

1. **You'd need a Spotify app in "Extended Quota" mode** (requires Spotify approval)
2. **Add your public domain** to the Redirect URIs in the Spotify Dashboard
3. **Each user would need to authorize your app** the first time

For a hosted version like Spicetify, you'd need to:
- Apply for Spotify's [extended quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- Host the Flask backend on a server (Railway, Render, etc.)
- Use HTTPS

**Can it replace the Spotify app?** Not fully — the Web Playback SDK (that plays music in the browser) requires Spotify Premium and only works in browsers. A proper desktop app would need to use [librespot](https://github.com/librespot-org/librespot) or Spotify Connect.

---

## 📁 Project Structure

```
myspotify/
├── app.py              # Flask backend, auth, token persistence
├── settings.json       # Auto-created: credentials + tokens (DO NOT COMMIT)
├── start.bat           # Windows launcher
├── requirements.txt    # Python dependencies
├── static/
│   ├── css/ms.css      # Complete design system
│   ├── icon.svg        # App icon
│   └── js/
│       ├── api.js      # All Spotify API calls
│       ├── audio.js    # Web Audio EQ + analyser
│       ├── visualizer.js # Frequency-reactive visualizer
│       ├── customize.js  # Theme/layout customization
│       ├── player.js     # SDK + all playback controls
│       ├── app.js        # Router, auth, modals
│       └── views/        # Home, Library, Playlist, Artist, Search
└── templates/
    └── index.html      # SPA shell
```

---

## ⚠️ .gitignore

**Important**: add this to your `.gitignore` before pushing to GitHub:

```
settings.json
venv/
__pycache__/
*.pyc
```

`settings.json` contains your Spotify credentials and access tokens — never commit it!

---

## 📝 License

Personal use. Built with ❤️ using the Spotify Web API.
