/**
 * Small Express route helpers to keep handlers consistent and DRY.
 */
import { checkFfmpeg } from './ffmpegUtil.js';
import { validateOnvifHostname } from './security.js';
import { getCamera } from './streamManager.js';

export const FFMPEG_UNAVAILABLE_MESSAGE =
  'FFmpeg is not installed. Install FFmpeg and restart the server.';

/** @param {import('express').Response} res */
export function requireFfmpeg(res) {
  if (!checkFfmpeg().available) {
    res.status(503).json({ error: FFMPEG_UNAVAILABLE_MESSAGE });
    return false;
  }
  return true;
}

/**
 * @param {string} id
 * @param {import('express').Response} res
 */
export function requireCamera(id, res) {
  const cam = getCamera(id);
  if (!cam) {
    res.status(404).json({ error: 'Camera not found' });
    return null;
  }
  return cam;
}

/**
 * @param {unknown} hostname
 * @param {import('express').Response} res
 * @returns {string | null}
 */
export function parseOnvifHostname(hostname, res) {
  try {
    return validateOnvifHostname(hostname);
  } catch (e) {
    res.status(400).json({ error: e.message });
    return null;
  }
}

/** Treat common truthy query-string values (`true`, `1`) as enabled flags. */
export function isTruthyQueryFlag(value) {
  return value === 'true' || value === '1';
}
