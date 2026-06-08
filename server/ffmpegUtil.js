import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let cachedPath = null;

function existsExecutable(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function probeFfmpeg(candidate) {
  if (!candidate || !existsExecutable(candidate)) return false;
  const result = spawnSync(candidate, ['-version'], { stdio: 'ignore', timeout: 5000 });
  return result.status === 0;
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

export function checkFfmpeg() {
  const ffmpegPath = resolveFfmpegPath();
  return {
    available: Boolean(ffmpegPath),
    path: ffmpegPath,
  };
}

/**
 * Spawn ffmpeg with immediate error handling so ENOENT does not crash the server.
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
    console.error(`[${label}]`, d.toString().trim());
  });

  child.on('close', (code) => onClose?.(code));

  return child;
}
