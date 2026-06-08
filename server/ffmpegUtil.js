/**
 * FFmpeg discovery and child-process spawning.
 *
 * Locates an `ffmpeg` binary on PATH or common Windows install locations,
 * caches the resolved path, and spawns processes with safe error handling.
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let cachedPath = null;

// --- Binary discovery ---

function existsExecutable(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function probeBinary(candidate) {
  if (!candidate || !existsExecutable(candidate)) return false;
  const result = spawnSync(candidate, ['-version'], { stdio: 'ignore', timeout: 5000 });
  return result.status === 0;
}

function probeFfmpeg(candidate) {
  return probeBinary(candidate);
}

function wingetFfmpegCandidates() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return [];
  const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (!fs.existsSync(packagesDir)) return [];

  const candidates = [];
  for (const pkg of fs.readdirSync(packagesDir)) {
    if (!pkg.toLowerCase().includes('ffmpeg')) continue;
    const pkgDir = path.join(packagesDir, pkg);
    for (const sub of fs.readdirSync(pkgDir)) {
      const bin = path.join(pkgDir, sub, 'bin', 'ffmpeg.exe');
      candidates.push(bin);
    }
  }
  return candidates;
}

/**
 * Find a working `ffmpeg` executable and cache the result for the process lifetime.
 * @returns {string | null}
 */
export function resolveFfmpegPath() {
  if (cachedPath) return cachedPath;

  const candidates = [
    process.env.FFMPEG_PATH,
    'ffmpeg',
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    ...wingetFfmpegCandidates(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (probeFfmpeg(candidate)) {
      cachedPath = candidate;
      return cachedPath;
    }
  }

  return null;
}

/**
 * Find `ffprobe` next to the resolved `ffmpeg` binary, or fall back to PATH.
 * @returns {string | null}
 */
export function resolveFfprobePath() {
  const ffmpegPath = resolveFfmpegPath();
  const ext = process.platform === 'win32' ? '.exe' : '';

  if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
    const sibling = path.join(path.dirname(ffmpegPath), `ffprobe${ext}`);
    if (probeBinary(sibling)) return sibling;
  }

  return probeBinary('ffprobe') ? 'ffprobe' : null;
}

/** @returns {{ available: boolean, path: string | null }} */
export function checkFfmpeg() {
  const ffmpegPath = resolveFfmpegPath();
  return {
    available: Boolean(ffmpegPath),
    path: ffmpegPath,
  };
}

// --- Process spawn ---

/** @param {string} line */
export function shouldLogFfmpegStderr(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // HTTP MJPEG cameras often close the connection briefly; FFmpeg reconnects in-process.
  if (/Will reconnect at \d+ in \d+ second\(s\), error=End of file/.test(trimmed)) {
    return false;
  }
  // Cosmetic warnings from cameras with missing/broken timestamps or sparse audio.
  if (/Codec AVOption b:a:\d+ .* has not been used/.test(trimmed)) return false;
  if (/Timestamps are unset in a packet/.test(trimmed)) return false;
  if (/Non-monotonic DTS/.test(trimmed)) return false;
  if (/DTS discontinuity/.test(trimmed)) return false;
  if (/Too many bits .* clamping to max/.test(trimmed)) return false;
  if (/failed to delete old segment .* No such file or directory/.test(trimmed)) return false;
  return true;
}

/**
 * Spawn ffmpeg with immediate error handling so ENOENT does not crash the server.
 * @param {string[]} args FFmpeg CLI arguments (excluding the binary path).
 * @param {{ label: string, onClose?: (code: number | null) => void, onSpawnError?: (err: Error) => void }} handlers
 * @returns {import('child_process').ChildProcess}
 */
export function spawnFfmpeg(args, { label, onClose, onSpawnError }) {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    const err = new Error(
      'FFmpeg not found. Install FFmpeg and add it to PATH, or set FFMPEG_PATH.'
    );
    onSpawnError?.(err);
    throw err;
  }

  const child = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.on('error', (err) => {
    console.error(`[${label}] spawn error:`, err.message);
    onSpawnError?.(err);
  });

  child.stderr?.on('data', (d) => {
    for (const line of d.toString().split(/\r?\n/)) {
      if (!shouldLogFfmpegStderr(line)) continue;
      console.error(`[${label}]`, line.trim());
    }
  });

  child.on('close', (code) => onClose?.(code));

  return child;
}
