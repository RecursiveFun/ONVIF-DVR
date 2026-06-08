import fs from 'fs';
import path from 'path';
import { assertPathInsideRoot } from './security.js';
import { getRecordingsDir, getRetentionDays, getSegmentSeconds } from './settings.js';

export { DEFAULT_RETENTION_DAYS as RETENTION_DAYS } from './settings.js';

/**
 * Parse segment filename like 2026-06-08_14-30-00.mp4 into local Date.
 */
export function parseSegmentTime(filename) {
  const base = path.basename(filename, '.mp4');
  const match = base.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, date, h, m, s] = match;
  return new Date(`${date}T${h}:${m}:${s}`);
}

function getFileDurationEstimate(filePath) {
  const fallback = getSegmentSeconds();
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 0 ? fallback : 0;
  } catch {
    return fallback;
  }
}

function segmentAgeMs(filePath, filename) {
  const startLocal = parseSegmentTime(filename);
  if (startLocal) return startLocal.getTime();
  try {
    return fs.statSync(filePath).mtime.getTime();
  } catch {
    return Date.now();
  }
}

function purgeDir(dir, cutoffMs) {
  let deleted = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleted += purgeDir(full, cutoffMs);
      try {
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } catch {
        // ignore races with ffmpeg writing new segments
      }
      continue;
    }

    if (!entry.name.endsWith('.mp4')) continue;
    if (segmentAgeMs(full, entry.name) < cutoffMs) {
      try {
        fs.unlinkSync(full);
        deleted += 1;
      } catch (err) {
        console.warn(`[retention] failed to delete ${full}:`, err.message);
      }
    }
  }

  return deleted;
}

/** Delete recording segments older than the configured retention period. */
export function purgeExpiredRecordings(cameraId = null) {
  const retentionDays = getRetentionDays();
  if (retentionDays === 0) return 0;

  const recordingsDir = getRecordingsDir();
  if (!fs.existsSync(recordingsDir)) return 0;

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  const dirs = cameraId
    ? [path.join(recordingsDir, cameraId)]
    : fs.readdirSync(recordingsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(recordingsDir, e.name));

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    deleted += purgeDir(dir, cutoffMs);
  }

  if (deleted > 0) {
    console.log(`[retention] removed ${deleted} segment(s) older than ${retentionDays} days`);
  }

  return deleted;
}

export function listRecordings(cameraId) {
  const recordingsDir = getRecordingsDir();
  const dir = path.join(recordingsDir, cameraId);
  if (!fs.existsSync(dir)) return [];

  const files = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.mp4')) {
        const startLocal = parseSegmentTime(entry.name);
        const stat = fs.statSync(full);
        const rel = path.relative(recordingsDir, full).replace(/\\/g, '/');
        files.push({
          id: rel,
          filename: entry.name,
          startLocal: startLocal ? startLocal.toISOString() : null,
          startLocalDisplay: startLocal
            ? startLocal.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
            : entry.name,
          sizeBytes: stat.size,
          durationSec: getFileDurationEstimate(full),
          mtime: stat.mtime.toISOString(),
        });
      }
    }
  }

  walk(dir);
  files.sort((a, b) => {
    const ta = a.startLocal || a.mtime;
    const tb = b.startLocal || b.mtime;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });
  return files;
}

export function getRecordingFile(recordingId) {
  if (typeof recordingId !== 'string' || !recordingId || recordingId.includes('\0')) {
    throw new Error('Invalid recording path');
  }
  const recordingsDir = getRecordingsDir();
  const normalized = assertPathInsideRoot(recordingsDir, recordingId);
  if (!fs.existsSync(normalized)) throw new Error('Recording not found');
  return normalized;
}

export function deleteRecording(recordingId) {
  const filePath = getRecordingFile(recordingId);
  fs.unlinkSync(filePath);

  let dir = path.dirname(filePath);
  const root = path.resolve(getRecordingsDir());
  while (dir !== root) {
    const rel = path.relative(root, dir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) break;
    try {
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return { ok: true, id: recordingId };
}

export function getTimeline(cameraId) {
  const segments = listRecordings(cameraId);
  if (segments.length === 0) {
    return { segments: [], rangeStart: null, rangeEnd: null };
  }

  const enriched = segments.map((seg) => {
    const start = seg.startLocal ? new Date(seg.startLocal) : new Date(seg.mtime);
    const end = new Date(start.getTime() + seg.durationSec * 1000);
    return { ...seg, endLocal: end.toISOString() };
  });

  return {
    segments: enriched,
    rangeStart: enriched[0].startLocal || enriched[0].mtime,
    rangeEnd: enriched[enriched.length - 1].endLocal,
  };
}
