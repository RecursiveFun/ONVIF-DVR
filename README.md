# ONVIF DVR

A self-hosted DVR and live-view application for IP cameras. Connect RTSP streams (manually or via ONVIF discovery), watch live HLS in the browser, record rolling 5-minute MP4 segments, and play back footage with a multi-tab interface that remembers your place.

Built with **Node.js + Express** on the backend and **React + Vite + Material UI** on the frontend. FFmpeg handles all stream ingest, transcoding, and segment writing.

---

## Screenshots

### Live view

HLS live preview with camera tabs, recording controls, and a zoomable timeline. Wheel over the bar to zoom in; the header shows the visible time range. The red dot beside **Live** in the sidebar indicates active recording.

![Live view with camera tabs and timeline](docs/screenshots/live-view.png)

### Playback

Open any segment in its own tab. Scrub with the progress bar, change playback speed, or jump back to live. **Playback** on a live camera tab opens the most recently finished segment in a new tab. Tab thumbnails update from the current scrub position.

![Playback mode with segment tab and DVR controls](docs/screenshots/playback.png)

### Multiview

Watch multiple cameras at once in a grid. Select cameras from the sidebar, open any tile for the full camera page, or remove a tile with the **×** in the upper-right corner (does not delete the camera).

![Multiview grid with live camera tiles](docs/screenshots/multiview.png)

### ONVIF discovery

Add cameras by pasting an RTSP URL or using ONVIF — scan the network, connect by IP, and auto-fill the stream URI.

![ONVIF discovery panel in the sidebar](docs/screenshots/onvif-discovery.png)

### Settings

Configure segment duration, retention, recordings folder, theme, and view disk usage from the sidebar.

![Settings panel with DVR options](docs/screenshots/settings.png)

---

## Features

### Live viewing
- Low-latency **HLS** live preview in the browser (via [hls.js](https://github.com/video-dev/hls.js))
- Separate controls for **live only**, **record only**, or **watch & record**
- Live preview thumbnails in the sidebar and tab bar

### DVR recording
- Continuous recording in **configurable MP4 segments** (default 5 minutes; fragmented MP4 for browser seeking)
- Segment filenames use **local wall-clock time** (`YYYY-MM-DD_HH-MM-SS.mp4`)
- **Configurable automatic retention** — older segments are purged hourly (default 7 days; set to 0 to disable)
- **Configurable recordings folder** with a built-in directory picker
- **Disk space monitoring** — warns when storage is low and stops recording if critically full
- Video is stream-copied; audio is transcoded to **AAC** for browser compatibility (e.g. cameras using G.711 / PCM)

### Playback
- **Zoomable timeline bar** — mouse wheel to zoom, shift+wheel or arrow keys to pan; visible start/end times update while zoomed
- Day-grouped segment list with newest/oldest sort
- **Segment tabs** — open any recording in its own tab with a thumbnail from the current scrub position
- **Playback** on a live tab opens the latest finished segment in a new tab (skips the in-progress file while recording)
- Playback position is **remembered per segment** across tab switches and page reloads
- Speed controls (0.5×–4×), skip ±10s, volume, and fullscreen

### Multi-tab workspace
- **Tabs** or **Multiview** layout — multiview shows a grid of live tiles with per-tile remove controls; camera selections persist
- Browser-style **camera tabs** with drag-to-reorder and drag-to-duplicate
- **Segment tabs** pinned to a specific recording (`Camera · timestamp`)
- Tab layout, active tab, multiview selection, and scrub positions persist in **localStorage**
- Going **Live** from a segment tab renames it back to a camera tab (with duplicate numbering like `C120 (2)`)

### Camera management
- Add cameras with a name and RTSP URL
- **ONVIF discovery** — scan the network, probe by IP, fetch stream URIs
- Remove cameras (stops streams and deletes from the list)
- Delete individual recording segments from playback (with confirmation)

### UI
- Collapsible sidebar with camera list, setup panel, and settings
- **Dark / light theme** (saved in localStorage, respects system preference)
- **Live** / **Recording** / **Idle** status chips in the sidebar and multiview tiles
- Recording indicator (red dot) beside **Live** cameras that are also recording
- Timeline wheel input does not scroll the page behind the bar

---

## Architecture

```mermaid
flowchart TB
  subgraph client [React Client :5173]
    UI[Camera tabs / Timeline / Players]
    LS[(localStorage<br/>tabs + scrub positions)]
    UI --> LS
  end

  subgraph server [Express API :3001]
    API[REST API]
    SM[streamManager]
    REC[recordings]
    ONVIF[onvifService]
    API --> SM
    API --> REC
    API --> ONVIF
  end

  subgraph ffmpeg [FFmpeg processes]
    HLS[HLS live output]
    MP4[MP4 segment writer]
  end

  subgraph storage [data/]
    CAM[cameras.json]
    SES[sessions.json]
    LIVE[live/]
    DVR[recordings/]
  end

  Camera[(RTSP camera)] -->|TCP| SM
  SM --> HLS --> LIVE
  SM --> MP4 --> DVR
  UI -->|/api /live| API
  LIVE -->|proxy| UI
  SM --> CAM
  SM --> SES
  REC --> DVR
```

| Layer | Role |
|-------|------|
| **client/** | React SPA — players, timeline, tabs, settings |
| **server/app.js** | Express routes (exportable for tests) |
| **server/streamManager.js** | Camera state, FFmpeg child processes, session restore |
| **server/recordings.js** | Segment listing, timeline, retention, file serving |
| **server/onvifService.js** | WS-Discovery, host probe, stream URI lookup |
| **server/ffmpegArgs.js** | Shared FFmpeg argument builders |
| **server/security.js** | Path validation, RTSP/ONVIF input checks, response sanitization, rate limits |
| **data/** | Runtime storage (gitignored in production use) |

---

## Requirements

| Dependency | Notes |
|------------|-------|
| **Node.js** 18+ | ES modules throughout |
| **npm** | Used for all package management |
| **FFmpeg** | Must be on `PATH`. The server checks availability at `/api/health` and refuses to start streams without it. |

### Installing FFmpeg

**Windows (winget):**
```bash
winget install Gyan.FFmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg    # Debian/Ubuntu
sudo dnf install ffmpeg    # Fedora
```

After installing on Windows, restart your terminal so `PATH` updates.

---

## Quick start

```bash
# Clone and install all dependencies (root + server + client)
npm run install:all

# Start API server (port 3001) and dev UI (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | React UI (dev) |
| http://localhost:3001/api/health | API health + FFmpeg status |

The Vite dev server proxies `/api` and `/live` to the backend automatically.

### Production build

```bash
npm run build          # outputs client/dist
cd server && npm start # serve API; static client hosting is left to your reverse proxy
```

For production, configure your reverse proxy (nginx, Caddy, etc.) to:
- Serve `client/dist` for `/`
- Proxy `/api` and `/live` to the Node server on port 3001

---

## Usage

### Adding a camera

1. Expand **Add Camera** in the sidebar.
2. Either:
   - **Scan / probe via ONVIF** — enter credentials, discover devices, pick a stream URI, or
   - **Paste an RTSP URL** directly (`rtsp://user:pass@192.168.1.100:554/...`)
3. Click **Add Camera**. A new tab opens for that camera.

### Watching live

| Action | When to use |
|--------|-------------|
| **Watch Live** | Preview only, no recording |
| **Watch & Record** | Live view + start DVR |
| **Start Recording** | Record without live preview (saves bandwidth) |
| **Stop / Stop All** | End live and/or recording |

Switch between **Live** and **Playback** with the mode toggle in the toolbar. On a **live camera tab**, **Playback** opens the most recently finished segment in a **new tab** and leaves the live tab streaming.

### Multiview

1. Switch the toolbar to **Multiview**.
2. Click cameras in the sidebar to show or hide them in the grid.
3. Click a tile to open that camera in full **Tabs** view.
4. Click **×** on a tile to remove it from the grid without deleting the camera.

### Playing back recordings

- Click a segment in the **timeline bar** or the day list → opens (or focuses) a **segment tab**
- Or click **Playback** on a live camera tab → opens the latest finished segment in a new tab
- **Wheel** over the timeline bar to zoom; **shift+wheel** to pan when zoomed
- Scrub with the progress bar; position is saved automatically
- **Go Live** on a segment tab converts it back to a camera tab and switches to live view
- **Delete Segment** (playback mode) permanently removes that MP4 after confirmation

### Tabs

| Gesture | Result |
|---------|--------|
| Click tab | Switch view |
| Drag tab handle | Reorder tabs |
| Drag camera/segment to tab bar | Open duplicate tab |
| Close tab (×) | Close tab only — does not delete the camera |
| **Remove** (live mode) | Delete camera (with confirmation) |

### Settings

Open **Settings** in the sidebar to configure:

| Setting | Description |
|---------|-------------|
| **Theme** | Dark or light |
| **Segment duration** | How long each MP4 file is (restarts active recorders when changed) |
| **Auto-delete after** | Retention in days (`0` = manual cleanup only) |
| **Recordings folder** | Where DVR files are stored (browse picker) |
| **Storage** | Free disk space and DVR usage on the data volume |

---

## Data storage

All runtime data lives under `data/` (created automatically):

```
data/
├── cameras.json          # Persisted camera list (id, name, rtspUrl)
├── sessions.json         # Which cameras were live/recording on last shutdown
├── settings.json         # Segment duration, retention, recordings folder path
├── live/
│   └── <camera-id>/
│       ├── index.m3u8    # HLS playlist
│       └── seg_*.ts      # Rolling live segments
└── recordings/
    └── <camera-id>/
        └── 2026-06-08_14-30-00.mp4
```

- **Retention:** segments older than the configured age (default **7 days**, **0** = disabled) are deleted automatically every hour. Change this in **Settings → Auto-delete after**.
- **Session restore:** on server start, cameras that were live/recording are restarted if FFmpeg is available.

---

## API reference

Base URL: `http://localhost:3001`

### Health & storage

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | `{ ok, ffmpeg: { available } }` |
| `GET` | `/api/storage` | Disk free space, DVR usage, and status |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Current segment duration, retention, recordings path |
| `PATCH` | `/api/settings` | Update `{ segmentDurationSec?, retentionDays?, recordingsDir? }` |

### Filesystem browser

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/fs/roots` | Browse roots for the recordings folder picker |
| `GET` | `/api/fs/directories?path=` | List child directories |

### Cameras

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cameras` | List all cameras with status (RTSP credentials masked) |
| `POST` | `/api/cameras` | Add camera `{ name?, rtspUrl }` (returns masked RTSP URL) |
| `DELETE` | `/api/cameras/:id` | Remove camera, stop streams |
| `POST` | `/api/cameras/:id/start` | Start live + recording |
| `POST` | `/api/cameras/:id/stop` | Stop live + recording |
| `POST` | `/api/cameras/:id/live/start` | Start live only |
| `POST` | `/api/cameras/:id/live/stop` | Stop live only |
| `POST` | `/api/cameras/:id/record/start` | Start recording only |
| `POST` | `/api/cameras/:id/record/stop` | Stop recording only |

### Recordings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cameras/:id/recordings` | List segments for a camera |
| `GET` | `/api/cameras/:id/timeline` | Segments with range metadata |
| `GET` | `/api/recordings/:id` | Stream/download MP4 (supports `Range`) |
| `DELETE` | `/api/recordings/:id` | Delete a segment file |

Recording IDs are relative paths like `camera-uuid/2026-06-08_14-30-00.mp4`.

### ONVIF

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/onvif/discover` | WS-Discovery scan |
| `GET` | `/api/onvif/interfaces` | List network interfaces |
| `POST` | `/api/onvif/probe-host` | Probe `{ hostname }` |
| `POST` | `/api/onvif/connect` | Connect by IP `{ hostname, port?, username?, password? }` |
| `POST` | `/api/onvif/stream-uri` | Get RTSP URI for a device |

### Live HLS

| Path | Description |
|------|-------------|
| `/live/:cameraId/index.m3u8` | HLS playlist |
| `/live/:cameraId/seg_*.ts` | HLS segments |

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to listen on all interfaces) |
| `CORS_ORIGINS` | *(localhost only)* | Comma-separated allowed browser origins (e.g. `http://localhost:5173,http://192.168.1.10:5173`) |
| `FFMPEG_PATH` | *(auto-detect)* | Full path to `ffmpeg` if not on `PATH` |

### DVR settings (in the UI)

| Setting | Default |
|---------|---------|
| Segment duration | 5 minutes |
| Retention | 7 days (`0` = disabled) |
| Recordings folder | `data/recordings` |

---

## Security

ONVIF DVR is designed as a **local-first** app. By default the API binds to **localhost only**, CORS allows localhost dev origins, and sensitive values are not exposed in API responses.

| Measure | Details |
|---------|---------|
| **Localhost bind** | Server listens on `127.0.0.1` unless `HOST` is set |
| **CORS** | Restricted to localhost by default; set `CORS_ORIGINS` for LAN access |
| **Path traversal** | Recording paths and folder browser are validated against allowlisted roots |
| **Input validation** | RTSP URLs and ONVIF hostnames are validated before use |
| **SSRF mitigation** | Cloud metadata hostnames are blocked for ONVIF probe/connect |
| **Credential masking** | Camera API responses mask RTSP usernames/passwords |
| **Rate limiting** | API and ONVIF endpoints are rate-limited |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc. |

There is **no built-in authentication**. If you expose the server beyond localhost, put it behind a reverse proxy with auth (nginx, Caddy, Tailscale, etc.).

### Client localStorage keys

| Key | Contents |
|-----|----------|
| `onvif-dvr-tabs` | Open tabs, order, active tab, scrub positions |
| `onvif-dvr-theme` | `light` or `dark` |
| `onvif-dvr-view-mode` | `tabs` or `multiview` |
| `onvif-dvr-multiview-cameras` | Camera IDs shown in multiview |
| `onvif-dvr-volume` | Last player volume |

---

## Development

### Project scripts

```bash
npm run dev              # server + client concurrently
npm run dev:server       # API only (with --watch)
npm run dev:client       # Vite dev server only
npm run build            # production client build
npm test                 # all tests (server + client)
npm run test:server      # Node test runner
npm run test:client      # Vitest
```

### Client structure

```
client/src/
├── App.jsx                 # Tab state, session persistence, routing between views
├── api.js                  # Fetch wrapper + format helpers
├── components/
│   ├── CameraPageView.jsx  # Per-tab camera/segment page
│   ├── CameraTabs.jsx      # Tab bar
│   ├── DVRPlayer.jsx       # Playback player
│   ├── LivePlayer.jsx      # HLS live player
│   ├── Timeline.jsx        # Zoomable recording timeline
│   ├── MultiviewGrid.jsx   # Multiview camera grid
│   ├── AppSettings.jsx     # Settings panel
│   └── ...
├── hooks/                  # useTheme, useMediaControls
└── utils/                  # tabSession, segments, multiviewSelection, playback, dragPayload
```

### Server structure

```
server/
├── index.js           # Entry point — listen, retention cron, session restore
├── app.js             # Express app factory (used by tests)
├── streamManager.js   # Cameras, FFmpeg processes, persistence
├── recordings.js      # Segment files, timeline, retention
├── onvifService.js    # ONVIF discovery and stream URIs
├── ffmpegArgs.js      # FFmpeg argument builders
├── ffmpegUtil.js      # FFmpeg path resolution (incl. winget on Windows)
└── security.js        # Path checks, validation, sanitization, rate limits
```

---

## Testing

The project has **149 automated tests** (61 server, 88 client) covering utilities, API integration, security helpers, and React components.

```bash
npm test
```

| Suite | Runner | What's covered |
|-------|--------|----------------|
| **Server unit** | `node --test` | FFmpeg args, segment parsing, file paths, retention, security helpers |
| **Server integration** | Supertest | Health, camera CRUD, recordings, ONVIF validation |
| **Client unit** | Vitest | Tab labels, session storage, drag payloads, playback helpers |
| **Client components** | Vitest + Testing Library | CameraList, CameraTabs, Timeline, MultiviewGrid, CameraPageView |

```bash
# Watch mode (client)
cd client && npm run test:watch

# Integration only (server)
cd server && npm run test:integration
```

---

## Troubleshooting

### FFmpeg not found
- Visit `/api/health` and check `ffmpeg.available`
- Ensure `ffmpeg` runs in your terminal: `ffmpeg -version`
- On Windows after winget install, restart the terminal or IDE

### Live stream won't play
- Confirm the RTSP URL works in VLC or ffplay
- Check the server console for FFmpeg errors
- Some cameras need TCP transport (already configured) or a sub-stream path

### Recording segments won't seek
- New recordings use fragmented MP4 (`movflags=+frag_keyframe`) for browser compatibility
- Very new segments may not be seekable until FFmpeg finalizes the fragment

### No audio in browser
- Audio is transcoded to AAC automatically; cameras with no audio track are fine
- Click the volume control — live player starts muted

### ONVIF discovery finds nothing
- Cameras must be on the same subnet; check firewall rules for UDP 3702
- Use **Connect by IP** if discovery fails
- Enter ONVIF credentials before fetching the stream URI

### Segments disappeared
- Automatic cleanup may have removed them — check **Settings → Auto-delete after** (default 7 days; 0 = disabled)
- Check `data/recordings/<camera-id>/` on disk

### Port 3001 already in use
- Another ONVIF-DVR server may still be running — stop it or set `PORT` to another value
- The server shuts down FFmpeg streams gracefully on restart so `node --watch` can reclaim the port

---

## Tech stack

| Area | Technology |
|------|------------|
| Frontend | React 19, Vite 6, Material UI, hls.js |
| Backend | Express 4, Node ES modules |
| Streaming | FFmpeg (HLS live + MP4 DVR) |
| Discovery | ONVIF (WS-Discovery + device API) |
| Testing | Vitest, Testing Library, Supertest, Node test runner |

---

## License

Private project. All rights reserved.
