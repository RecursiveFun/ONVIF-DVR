import { statfsSync } from 'fs';
import fs from 'fs';
import path from 'path';
import { getRecordingsDir } from './settings.js';

/** Stop new recordings below this free space (1 GB). */
export const CRITICAL_FREE_BYTES = 1 * 1024 ** 3;
/** Show a warning in the UI below this free space (5 GB). */
export const WARN_FREE_BYTES = 5 * 1024 ** 3;

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

export function classifyStorage(freeBytes) {
  if (freeBytes < CRITICAL_FREE_BYTES) return 'critical';
  if (freeBytes < WARN_FREE_BYTES) return 'low';
  return 'ok';
}

export function getVolumeStats(targetPath = DATA_DIR) {
  const root = path.resolve(targetPath);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  const stats = statfsSync(root);
  const blockSize = stats.bsize;
  const totalBytes = stats.blocks * blockSize;
  const freeBlocks = stats.bavail ?? stats.bfree;
  const freeBytes = freeBlocks * blockSize;
  return {
    totalBytes,
    freeBytes,
    usedBytes: Math.max(0, totalBytes - freeBytes),
  };
}

export function getRecordingsBytes(root = getRecordingsDir()) {
  if (!fs.existsSync(root)) return 0;

  let total = 0;

  function walk(current) {
    let dirEntries;
    try {
      dirEntries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of dirEntries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // ignore races with ffmpeg writing segments
        }
      }
    }
  }

  walk(root);
  return total;
}

export function getStorageStatus() {
  const recordingsDir = getRecordingsDir();
  const volume = getVolumeStats(recordingsDir);
  const recordingsBytes = getRecordingsBytes(recordingsDir);
  const status = classifyStorage(volume.freeBytes);

  return {
    ...volume,
    recordingsBytes,
    recordingsDir,
    status,
    canRecord: status !== 'critical',
    criticalFreeBytes: CRITICAL_FREE_BYTES,
    warnFreeBytes: WARN_FREE_BYTES,
    path: recordingsDir,
  };
}

export function assertCanRecord() {
  const { freeBytes, status } = getStorageStatus();
  if (status === 'critical') {
    throw new Error(
      `Not enough free disk space to record (${formatBytes(freeBytes)} free; need at least ${formatBytes(CRITICAL_FREE_BYTES)})`,
    );
  }
}
