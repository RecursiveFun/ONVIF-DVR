/**
 * Disk space monitoring for the recordings volume.
 *
 * Reports free/total bytes, classifies status for the UI, and blocks new
 * recordings when free space drops below a critical threshold.
 */
import { statfsSync } from 'fs';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './dataPaths.js';
import { getDirectorySizeBytes } from './fsUtil.js';
import { getRecordingsDir } from './settings.js';

/** Stop new recordings below this free space (1 GB). */
export const CRITICAL_FREE_BYTES = 1 * 1024 ** 3;
/** Show a warning in the UI below this free space (5 GB). */
export const WARN_FREE_BYTES = 5 * 1024 ** 3;

// --- Formatting and classification ---

/** Human-readable byte size for error messages and UI labels. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

/** Map free bytes to `ok`, `low`, or `critical` using configured thresholds. */
export function classifyStorage(freeBytes) {
  if (freeBytes < CRITICAL_FREE_BYTES) return 'critical';
  if (freeBytes < WARN_FREE_BYTES) return 'low';
  return 'ok';
}

// --- Volume and recordings size ---

/**
 * Filesystem stats for the volume containing `targetPath`.
 * @param {string} [targetPath] Path on the volume to query; callers should pass the recordings dir.
 */
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

/** Sum on-disk size of all files under the recordings tree. */
export function getRecordingsBytes(root = getRecordingsDir()) {
  return getDirectorySizeBytes(root);
}

// --- API-facing status and record guard ---

/** Combined volume and recordings usage for `/api/storage` and internal checks. */
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

/** Throw when free disk space is below the critical recording threshold. */
export function assertCanRecord() {
  const { freeBytes, status } = getStorageStatus();
  if (status === 'critical') {
    throw new Error(
      `Not enough free disk space to record (${formatBytes(freeBytes)} free; need at least ${formatBytes(CRITICAL_FREE_BYTES)})`,
    );
  }
}
