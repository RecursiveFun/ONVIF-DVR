/**
 * Security helpers for the ONVIF-DVR API.
 *
 * Path confinement, URL/hostname validation, response sanitization, HTTP
 * hardening headers, rate limiting, and byte-range parsing for recording playback.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_DIR, DEFAULT_RECORDINGS_DIR } from './settings.js';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Cloud metadata and link-local endpoints that must never be probed via ONVIF.
 * Blocks SSRF-style requests to instance metadata services.
 */
const BLOCKED_ONVIF_HOSTS = new Set([
  '169.254.169.254', // AWS / Azure / GCP link-local metadata
  'metadata.google.internal',
  'metadata.goog',
]);

// --- Path confinement ---

/**
 * Resolve `targetPath` relative to `rootDir` and reject traversal outside the root.
 * @param {string} rootDir Base directory recordings must stay under.
 * @param {string} targetPath Relative path or filename within that root.
 * @returns {string} Absolute resolved path inside `rootDir`.
 */
export function assertPathInsideRoot(rootDir, targetPath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, targetPath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Invalid recording path');
  }
  return resolved;
}

/**
 * Directories the filesystem browser may list (project root, data, recordings, home).
 * @returns {string[]} Absolute paths allowed as browse roots.
 */
export function getBrowseAllowRoots() {
  const roots = [
    path.resolve(PROJECT_ROOT),
    path.resolve(DEFAULT_RECORDINGS_DIR),
    path.resolve(DATA_DIR),
  ];
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) roots.push(path.resolve(home));
  return roots;
}

/**
 * Ensure a resolved path is contained within at least one browse allow root.
 * @param {string} resolvedPath Absolute path to validate.
 * @returns {string} The same normalized path when allowed.
 */
export function assertUnderBrowseRoots(resolvedPath) {
  const normalized = path.resolve(resolvedPath);
  const allowed = getBrowseAllowRoots().some((root) => {
    const rel = path.relative(root, normalized);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
  if (!allowed) {
    throw new Error('Path is outside allowed browse locations');
  }
  return normalized;
}

// --- URL and hostname validation ---

/**
 * Validate an RTSP or RTSPS stream URL from user input.
 * @param {string} rtspUrl
 * @returns {string} Trimmed URL when valid.
 */
export function validateRtspUrl(rtspUrl) {
  if (typeof rtspUrl !== 'string' || !rtspUrl.trim()) {
    throw new Error('rtspUrl is required');
  }
  const trimmed = rtspUrl.trim();
  if (trimmed.length > 2048 || /[\0\r\n]/.test(trimmed)) {
    throw new Error('Invalid RTSP URL');
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('RTSP URL must be a valid rtsp:// or rtsps:// URL');
  }
  if (parsed.protocol !== 'rtsp:' && parsed.protocol !== 'rtsps:') {
    throw new Error('RTSP URL must use rtsp:// or rtsps://');
  }
  if (!parsed.hostname) {
    throw new Error('RTSP URL must include a host');
  }
  return trimmed;
}

/**
 * Validate a hostname for ONVIF probe/connect requests.
 * Rejects blocked metadata hosts and malformed values.
 * @param {string} hostname
 * @returns {string} Trimmed hostname when allowed.
 */
export function validateOnvifHostname(hostname) {
  if (typeof hostname !== 'string' || !hostname.trim()) {
    throw new Error('hostname is required');
  }
  const trimmed = hostname.trim();
  if (trimmed.length > 253 || /[\0\r\n/\\]/.test(trimmed) || trimmed.includes('://')) {
    throw new Error('Invalid hostname');
  }
  const lower = trimmed.toLowerCase();
  if (BLOCKED_ONVIF_HOSTS.has(lower)) {
    throw new Error('Hostname is not allowed');
  }
  return trimmed;
}

// --- Response sanitization ---

/**
 * Redact credentials embedded in an RTSP URL before sending to the client.
 * @param {string} rtspUrl
 * @returns {string}
 */
export function maskRtspUrl(rtspUrl) {
  if (!rtspUrl || typeof rtspUrl !== 'string') return rtspUrl;
  return rtspUrl.replace(/^(rtsps?:\/\/)(?:[^@/]+)@/i, '$1****:****@');
}

/**
 * Return a camera object safe for API responses (masked RTSP credentials).
 * @param {object | null | undefined} camera
 * @returns {object | null | undefined}
 */
export function sanitizeCamera(camera) {
  if (!camera) return camera;
  return { ...camera, rtspUrl: maskRtspUrl(camera.rtspUrl) };
}

/**
 * Strip the on-disk `path` field from a recording before API export.
 * @param {object | null | undefined} recording
 * @returns {object | null | undefined}
 */
export function sanitizeRecording(recording) {
  if (!recording) return recording;
  const { path: _path, ...rest } = recording;
  return rest;
}

// --- HTTP middleware ---

/**
 * Express middleware that sets baseline security response headers.
 */
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

/**
 * Create a per-IP sliding-window rate limiter middleware.
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({ windowMs = 60_000, max = 300 } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = hits.get(key);
    if (!bucket || now >= bucket.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }
    return next();
  };
}

/**
 * Stricter rate limiter preset for sensitive endpoints (ONVIF, camera create).
 * @param {{ windowMs?: number, max?: number }} [options]
 * @returns {import('express').RequestHandler}
 */
export function createStrictRateLimiter(options) {
  return createRateLimiter(options);
}

// --- Byte-range parsing ---

/**
 * Parse an HTTP `Range: bytes=` header for MP4 recording playback.
 * @param {string | undefined} rangeHeader Raw Range header value.
 * @param {number} size File size in bytes.
 * @returns {{ start: number, end: number } | null} Inclusive byte range, or null if invalid.
 */
export function parseByteRange(rangeHeader, size) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start >= size || end >= size || start > end) return null;

  return { start, end };
}
