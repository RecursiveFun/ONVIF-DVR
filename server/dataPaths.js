/**
 * Shared on-disk layout for camera live HLS cache and DVR recordings.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { assertPathInsideRoot } from './security.js';
import { getRecordingsDir } from './settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, '..', 'data');
export const LIVE_DIR = path.join(DATA_DIR, 'live');

/** @param {string} cameraId */
export function resolveCameraLiveDir(cameraId) {
  return assertPathInsideRoot(LIVE_DIR, cameraId);
}

/** @param {string} cameraId */
export function resolveCameraRecordingsDir(cameraId) {
  return assertPathInsideRoot(getRecordingsDir(), cameraId);
}
