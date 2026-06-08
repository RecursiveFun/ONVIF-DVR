/**
 * Camera registry and FFmpeg process orchestration.
 *
 * Persists camera definitions, spawns separate FFmpeg children for HLS live
 * preview and segmented MP4 recording, tracks session state for restart recovery,
 * and reacts to low-disk conditions from `storage.js`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnFfmpeg } from './ffmpegUtil.js';
import { liveOutputArgs, recordOutputArgs, rtspInputOptions } from './ffmpegArgs.js';
import { ensureRecordingsDir, getRecordingsDir, getSegmentSeconds } from './settings.js';
import { assertCanRecord } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live');
const CAMERAS_FILE = path.join(DATA_DIR, 'cameras.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// --- Data directories and startup ---

for (const dir of [DATA_DIR, LIVE_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureRecordingsDir();

/** @typedef {{ id: string, name: string, rtspUrl: string, status: string, recording: boolean, startedAt: string | null, error: string | null }} CameraState */

/** @type {Map<string, { live: import('child_process').ChildProcess | null, record: import('child_process').ChildProcess | null }>} */
const MAX_CAMERAS = 32;

const processes = new Map();
/** @type {Map<string, { live: boolean, record: boolean }>} */
const stopping = new Map();

/** @type {Map<string, CameraState>} */
const cameras = new Map();

// --- Camera persistence (cameras.json) ---

function saveCameras() {
  const list = Array.from(cameras.values()).map(({ id, name, rtspUrl }) => ({ id, name, rtspUrl }));
  fs.writeFileSync(CAMERAS_FILE, JSON.stringify(list, null, 2));
}

function loadCameras() {
  if (!fs.existsSync(CAMERAS_FILE)) return;
  try {
    const list = JSON.parse(fs.readFileSync(CAMERAS_FILE, 'utf8'));
    for (const { id, name, rtspUrl } of list) {
      addCamera({ id, name, rtspUrl }, { persist: false });
    }
  } catch (e) {
    console.error('Failed to load cameras.json:', e.message);
  }
}

loadCameras();

// --- Session persistence (sessions.json) ---

function readSessionsFile() {
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to load sessions.json:', e.message);
    return {};
  }
}

function writeSessionsFile(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function persistSession(id) {
  const cam = cameras.get(id);
  const procs = processes.get(id);
  if (!cam) return;

  const sessions = readSessionsFile();
  const live = Boolean(procs?.live);
  const recording = Boolean(procs?.record);

  if (live || recording) {
    sessions[id] = {
      live,
      recording,
      startedAt: cam.startedAt,
    };
  } else {
    delete sessions[id];
  }

  writeSessionsFile(sessions);
}

function cameraLiveDir(id) {
  return path.join(LIVE_DIR, id);
}

function cameraRecordDir(id) {
  return path.join(getRecordingsDir(), id);
}

function setCameraError(id, message) {
  const cam = cameras.get(id);
  if (cam) cam.error = message;
}

function clearCameraError(id) {
  const cam = cameras.get(id);
  if (cam) cam.error = null;
}

// --- Camera CRUD ---

/** @returns {CameraState[]} */
export function listCameras() {
  return Array.from(cameras.values());
}

/** @param {string} id @returns {CameraState | null} */
export function getCamera(id) {
  return cameras.get(id) || null;
}

/**
 * Register a camera and create its live/recording output directories.
 * @param {{ id: string, name: string, rtspUrl: string }} camera
 * @param {{ persist?: boolean }} [options]
 * @returns {CameraState}
 */
export function addCamera({ id, name, rtspUrl }, { persist = true } = {}) {
  if (!cameras.has(id) && cameras.size >= MAX_CAMERAS) {
    throw new Error(`Maximum of ${MAX_CAMERAS} cameras allowed`);
  }
  const camDir = cameraLiveDir(id);
  const recDir = cameraRecordDir(id);
  fs.mkdirSync(camDir, { recursive: true });
  fs.mkdirSync(recDir, { recursive: true });

  const state = {
    id,
    name,
    rtspUrl,
    status: 'idle',
    recording: false,
    startedAt: null,
    error: null,
  };
  cameras.set(id, state);
  processes.set(id, { live: null, record: null });
  stopping.set(id, { live: false, record: false });
  if (persist) saveCameras();
  return state;
}

/** Stop streams, remove persisted camera and session entries. */
export function removeCamera(id) {
  stopLive(id);
  stopRecording(id);
  cameras.delete(id);
  processes.delete(id);
  stopping.delete(id);
  const sessions = readSessionsFile();
  delete sessions[id];
  writeSessionsFile(sessions);
  saveCameras();
}

// --- FFmpeg helpers ---

function rtspInputArgs(rtspUrl) {
  return [...rtspInputOptions(), '-i', rtspUrl];
}

function ffmpegExitMessage(code) {
  if (code == null) return null;
  const normalized = code > 0x80000000 ? code - 0x100000000 : code;
  if (normalized === 0) return null;
  const hints = {
    [-2]: 'Stream source unavailable (camera offline, RTSP path invalid, or network dropped)',
    [-22]: 'Invalid stream settings (often unsupported audio in the output format)',
    [1]: 'FFmpeg error',
  };
  const hint = hints[normalized] || `exit code ${normalized}`;
  return hint;
}

function attachSpawnFailure(id, kind, procs, key) {
  return (err) => {
    const p = procs[key];
    if (p) procs[key] = null;
    setCameraError(id, err.message);
    const cam = cameras.get(id);
    if (!cam) return;
    if (kind === 'live' && !cam.recording) cam.status = 'idle';
    if (kind === 'record' && !procs.live) cam.status = 'idle';
    else if (kind === 'record' && procs.live) cam.status = 'live';
  };
}

// --- Live HLS streaming ---

/** Start FFmpeg HLS output for browser live preview. */
export function startLive(id) {
  const cam = cameras.get(id);
  if (!cam) throw new Error('Camera not found');

  const procs = processes.get(id);
  if (procs?.live) return cam;

  const outDir = cameraLiveDir(id);
  fs.mkdirSync(outDir, { recursive: true });

  const playlist = path.join(outDir, 'index.m3u8');
  const segmentPattern = path.join(outDir, 'seg_%03d.ts');

  const args = [
    '-hide_banner', '-loglevel', 'warning',
    ...rtspInputArgs(cam.rtspUrl),
    ...liveOutputArgs(),
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments+append_list+split_by_time',
    '-hls_segment_filename', segmentPattern,
    playlist,
  ];

  let ffmpeg;
  try {
    ffmpeg = spawnFfmpeg(args, {
      label: `live:${id}`,
      onSpawnError: attachSpawnFailure(id, 'live', procs, 'live'),
      onClose: (code) => {
        console.log(`[live:${id}] exited with code ${code}`);
        procs.live = null;
        const c = cameras.get(id);
        const stopState = stopping.get(id);
        const intentionalStop = Boolean(stopState?.live);
        if (stopState) stopState.live = false;
        if (c) {
          if (!intentionalStop && code && code !== 0 && !c.error) {
            const msg = ffmpegExitMessage(code);
            if (msg) c.error = `Live stream stopped (${msg})`;
          }
          if (!c.recording) c.status = 'idle';
          else c.status = 'recording';
          persistSession(id);
        }
      },
    });
  } catch (err) {
    throw err;
  }

  procs.live = ffmpeg;
  cam.status = 'live';
  cam.startedAt = cam.startedAt || new Date().toISOString();
  clearCameraError(id);
  persistSession(id);
  return cam;
}

/** Stop the live FFmpeg process for a camera. */
export function stopLive(id) {
  const procs = processes.get(id);
  const stopState = stopping.get(id);
  if (procs?.live) {
    if (stopState) stopState.live = true;
    procs.live.kill('SIGTERM');
    procs.live = null;
  }
  const cam = cameras.get(id);
  if (cam && !cam.recording) {
    cam.status = 'idle';
    cam.startedAt = null;
  } else if (cam) {
    cam.status = cam.recording ? 'recording' : 'idle';
  }
  persistSession(id);
}

// --- Segmented MP4 recording ---

/** Start FFmpeg segment recording into the camera's recordings folder. */
export function startRecording(id) {
  const cam = cameras.get(id);
  if (!cam) throw new Error('Camera not found');

  const procs = processes.get(id);
  if (procs?.record) return cam;

  assertCanRecord();

  const recDir = cameraRecordDir(id);
  fs.mkdirSync(recDir, { recursive: true });

  const segmentPattern = path.join(recDir, '%Y-%m-%d_%H-%M-%S.mp4');

  const args = [
    '-hide_banner', '-loglevel', 'warning',
    ...rtspInputArgs(cam.rtspUrl),
    ...recordOutputArgs(),
    '-f', 'segment',
    '-segment_time', String(getSegmentSeconds()),
    '-segment_format', 'mp4',
    '-segment_format_options', 'movflags=+frag_keyframe',
    '-reset_timestamps', '1',
    '-strftime', '1',
    '-strftime_mkdir', '1',
    segmentPattern,
  ];

  let ffmpeg;
  try {
    ffmpeg = spawnFfmpeg(args, {
      label: `record:${id}`,
      onSpawnError: attachSpawnFailure(id, 'record', procs, 'record'),
      onClose: (code) => {
        console.log(`[record:${id}] exited with code ${code}`);
        procs.record = null;
        const c = cameras.get(id);
        const stopState = stopping.get(id);
        const intentionalStop = Boolean(stopState?.record);
        if (stopState) stopState.record = false;
        if (c) {
          c.recording = false;
          if (!intentionalStop && code && code !== 0 && !c.error) {
            const msg = ffmpegExitMessage(code);
            if (msg) c.error = `Recording stopped (${msg})`;
          }
          if (procs.live) c.status = 'live';
          else c.status = 'idle';
          persistSession(id);
        }
      },
    });
  } catch (err) {
    throw err;
  }

  procs.record = ffmpeg;
  cam.recording = true;
  cam.status = procs.live ? 'live' : 'recording';
  cam.startedAt = cam.startedAt || new Date().toISOString();
  clearCameraError(id);
  persistSession(id);
  return cam;
}

/** Stop the recording FFmpeg process for a camera. */
export function stopRecording(id) {
  const procs = processes.get(id);
  const stopState = stopping.get(id);
  if (procs?.record) {
    if (stopState) stopState.record = true;
    procs.record.kill('SIGTERM');
    procs.record = null;
  }
  const cam = cameras.get(id);
  if (cam) {
    cam.recording = false;
    cam.status = procs?.live ? 'live' : 'idle';
    if (!procs?.live) cam.startedAt = null;
  }
  persistSession(id);
}

// --- Session restore and combined controls ---

/** Resume live/recording FFmpeg processes from sessions.json after server restart. */
export function restoreSessions() {
  const sessions = readSessionsFile();
  const ids = Object.keys(sessions);
  if (ids.length === 0) return;

  console.log(`[sessions] restoring ${ids.length} active session(s)`);

  for (const id of ids) {
    const session = sessions[id];
    if (!cameras.has(id)) continue;

    const cam = cameras.get(id);
    if (session.startedAt) cam.startedAt = session.startedAt;

    try {
      if (session.live && session.recording) {
        startAll(id);
        console.log(`[sessions] resumed live + recording for ${cam.name}`);
      } else if (session.live) {
        startLive(id);
        console.log(`[sessions] resumed live for ${cam.name}`);
      } else if (session.recording) {
        startRecording(id);
        console.log(`[sessions] resumed recording for ${cam.name}`);
      }
    } catch (err) {
      console.error(`[sessions] failed to resume ${cam.name}:`, err.message);
      delete sessions[id];
      writeSessionsFile(sessions);
    }
  }
}

/** Start both live preview and recording; rolls back live if recording fails. */
export function startAll(id) {
  try {
    startLive(id);
  } catch (err) {
    throw err;
  }
  try {
    startRecording(id);
  } catch (err) {
    stopLive(id);
    throw err;
  }
  return cameras.get(id);
}

/** Stop live and recording for a camera. */
export function stopAll(id) {
  stopLive(id);
  stopRecording(id);
}

// --- Low-disk handling ---

const LOW_DISK_ERROR = 'Recording stopped — disk space critically low';

/** Stop one camera's recorder and surface a low-disk error on its state. */
export function stopRecordingDueToLowDisk(id) {
  const procs = processes.get(id);
  if (!procs?.record) return;
  stopRecording(id);
  const cam = cameras.get(id);
  if (cam) cam.error = LOW_DISK_ERROR;
}

/** Stop every active recording when free disk space is critical. */
export function stopAllRecordingsDueToLowDisk() {
  for (const [id, procs] of processes) {
    if (procs?.record) stopRecordingDueToLowDisk(id);
  }
}

/**
 * Restart active FFmpeg recorders so a new segment duration or path takes effect.
 * Live streams are left running.
 */
export function restartActiveRecordings() {
  for (const [id, procs] of processes) {
    if (!procs?.record) continue;
    const cam = cameras.get(id);
    stopRecording(id);
    try {
      startRecording(id);
      if (cam) console.log(`[settings] restarted recording for ${cam.name}`);
    } catch (err) {
      console.error(`[settings] failed to restart recording for ${id}:`, err.message);
    }
  }
}

export { LIVE_DIR, DATA_DIR, getRecordingsDir };
