/**
 * Per-camera on-disk storage under data/live and the configured recordings folder.
 */
import fs from 'fs';
import { resolveCameraLiveDir, resolveCameraRecordingsDir } from './dataPaths.js';
import { getDirectorySizeBytes } from './fsUtil.js';

/**
 * @param {string} cameraId
 * @returns {{ liveBytes: number, recordingsBytes: number, totalBytes: number, hasData: boolean }}
 */
export function getCameraDataSummary(cameraId) {
  const liveDir = resolveCameraLiveDir(cameraId);
  const recordingsDir = resolveCameraRecordingsDir(cameraId);
  const liveBytes = getDirectorySizeBytes(liveDir);
  const recordingsBytes = getDirectorySizeBytes(recordingsDir);
  return {
    liveBytes,
    recordingsBytes,
    totalBytes: liveBytes + recordingsBytes,
    hasData: liveBytes > 0 || recordingsBytes > 0,
  };
}

/**
 * Delete HLS cache and DVR recordings for a camera. Idempotent when folders are missing.
 * @param {string} cameraId
 * @returns {{ liveDeleted: boolean, recordingsDeleted: boolean }}
 */
export function deleteCameraData(cameraId) {
  const liveDir = resolveCameraLiveDir(cameraId);
  const recordingsDir = resolveCameraRecordingsDir(cameraId);
  let liveDeleted = false;
  let recordingsDeleted = false;

  if (fs.existsSync(liveDir)) {
    fs.rmSync(liveDir, { recursive: true, force: true });
    liveDeleted = true;
  }
  if (fs.existsSync(recordingsDir)) {
    fs.rmSync(recordingsDir, { recursive: true, force: true });
    recordingsDeleted = true;
  }

  return { liveDeleted, recordingsDeleted };
}
