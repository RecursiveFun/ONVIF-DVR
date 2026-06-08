/**
 * Express application factory for the ONVIF-DVR API and optional static UI.
 *
 * Wires middleware, HLS live segments, REST routes (health, storage, settings,
 * cameras, recordings, ONVIF discovery), and SPA fallback when SERVE_CLIENT is set.
 */
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { isHttpStreamUrl } from './ffmpegArgs.js';
import { fetchHttpPreviewJpeg } from './httpPreviewFrame.js';
import { checkFfmpeg } from './ffmpegUtil.js';
import {
  createRateLimiter,
  createStrictRateLimiter,
  parseByteRange,
  sanitizeCamera,
  sanitizeRecording,
  securityHeaders,
  validateOnvifHostname,
  validateRtspUrl,
} from './security.js';
import {
  connectByHost,
  discoverDevices,
  getStreamUri,
  listNetworkInterfaces,
  probeHost,
} from './onvifService.js';
import { deleteRecording, getRecordingFile, getTimeline, listRecordings, purgeExpiredRecordings } from './recordings.js';
import {
  clampRetentionDays,
  clampSegmentSeconds,
  getSettings,
  MAX_RETENTION_DAYS,
  MAX_SEGMENT_SECONDS,
  MIN_RETENTION_DAYS,
  MIN_SEGMENT_SECONDS,
  updateSettings,
} from './settings.js';
import { listDirectory, listRoots } from './fsBrowser.js';
import { getStorageStatus } from './storage.js';
import {
  addCamera,
  getCamera,
  listCameras,
  LIVE_DIR,
  removeCamera,
  restartActiveRecordings,
  startAll,
  startLive,
  startRecording,
  stopAll,
  stopLive,
  stopRecording,
} from './streamManager.js';

function getCorsOptions() {
  const configured = process.env.CORS_ORIGINS;
  if (configured) {
    const allowed = new Set(
      configured.split(',').map((origin) => origin.trim()).filter(Boolean),
    );
    return {
      origin(origin, callback) {
        if (!origin || allowed.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    };
  }
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        /^https?:\/\/((localhost|127\.0\.0\.1)|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(
          origin,
        )
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}

const apiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 600 });
const strictRateLimiter = createStrictRateLimiter({ windowMs: 60_000, max: 60 });

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(SERVER_DIR, '..', 'client', 'dist');

/** Build and configure the Express app (no listen). */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // --- Global middleware ---
  app.use(cors(getCorsOptions()));
  app.use(securityHeaders);
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiRateLimiter);

  // --- HLS live stream static files ---
  app.use('/live', express.static(LIVE_DIR, {
    setHeaders(res, filePath) {
      res.removeHeader('Cross-Origin-Resource-Policy');
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
      }
    },
  }));

  // --- Health and storage ---
  app.get('/api/health', (_req, res) => {
    const ffmpeg = checkFfmpeg();
    res.json({ ok: true, ffmpeg: { available: ffmpeg.available } });
  });

  app.get('/api/storage', (_req, res) => {
    res.json(getStorageStatus());
  });

  // --- Filesystem browser (recordings folder picker) ---
  app.get('/api/fs/roots', (_req, res) => {
    res.json({ roots: listRoots() });
  });

  app.get('/api/fs/directories', (req, res) => {
    const dirPath = typeof req.query.path === 'string' ? req.query.path : '';
    try {
      res.json(listDirectory(dirPath));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Settings ---
  app.get('/api/settings', (_req, res) => {
    res.json(getSettings());
  });

  app.patch('/api/settings', (req, res) => {
    const { segmentDurationSec, recordingsDir, retentionDays } = req.body ?? {};
    if (
      segmentDurationSec === undefined
      && recordingsDir === undefined
      && retentionDays === undefined
    ) {
      return res.status(400).json({ error: 'No settings to update' });
    }

    const previous = getSettings();
    const patch = {};

    if (segmentDurationSec !== undefined) {
      const parsed = Number(segmentDurationSec);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: 'segmentDurationSec must be a number' });
      }
      const rounded = Math.round(parsed);
      if (rounded < MIN_SEGMENT_SECONDS || rounded > MAX_SEGMENT_SECONDS) {
        return res.status(400).json({
          error: `segmentDurationSec must be between ${MIN_SEGMENT_SECONDS} and ${MAX_SEGMENT_SECONDS} seconds`,
        });
      }
      patch.segmentDurationSec = clampSegmentSeconds(rounded);
    }

    if (recordingsDir !== undefined) {
      if (typeof recordingsDir !== 'string' || !recordingsDir.trim()) {
        return res.status(400).json({ error: 'recordingsDir must be a non-empty path' });
      }
      patch.recordingsDir = recordingsDir;
    }

    if (retentionDays !== undefined) {
      const parsed = Number(retentionDays);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({ error: 'retentionDays must be a number' });
      }
      const rounded = Math.round(parsed);
      if (rounded < MIN_RETENTION_DAYS || rounded > MAX_RETENTION_DAYS) {
        return res.status(400).json({
          error: `retentionDays must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`,
        });
      }
      patch.retentionDays = clampRetentionDays(rounded);
    }

    try {
      const updated = updateSettings(patch);
      const segmentChanged = updated.segmentDurationSec !== previous.segmentDurationSec;
      const recordingsChanged = updated.recordingsDir !== previous.recordingsDir;
      const retentionChanged = updated.retentionDays !== previous.retentionDays;
      if (segmentChanged || recordingsChanged) {
        restartActiveRecordings().catch((err) => {
          console.error('[settings] failed to restart recordings:', err.message);
        });
      }
      if (retentionChanged) {
        purgeExpiredRecordings();
      }
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Cameras: CRUD and stream control ---
  app.get('/api/cameras', (_req, res) => {
    res.json(listCameras().map(sanitizeCamera));
  });

  app.post('/api/cameras', strictRateLimiter, async (req, res) => {
    const { name, rtspUrl } = req.body ?? {};
    let validatedUrl;
    try {
      validatedUrl = validateRtspUrl(rtspUrl);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const id = uuidv4();
    try {
      addCamera({
        id,
        name: name?.trim() || 'Camera',
        rtspUrl: validatedUrl,
      });

      const ffmpeg = checkFfmpeg();
      if (ffmpeg.available) {
        try {
          await startLive(id);
        } catch (startErr) {
          const cam = getCamera(id);
          if (cam) cam.error = startErr.message;
        }
      }

      res.status(201).json(sanitizeCamera(getCamera(id)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete('/api/cameras/:id', (req, res) => {
    const cam = getCamera(req.params.id);
    if (!cam) return res.status(404).json({ error: 'Camera not found' });
    stopAll(req.params.id);
    removeCamera(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/cameras/:id/start', async (req, res) => {
    try {
      const ffmpeg = checkFfmpeg();
      if (!ffmpeg.available) {
        return res.status(503).json({
          error: 'FFmpeg is not installed. Install FFmpeg and restart the server.',
        });
      }
      const cam = await startAll(req.params.id);
      res.json(sanitizeCamera(cam));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/cameras/:id/stop', (req, res) => {
    try {
      stopAll(req.params.id);
      res.json(sanitizeCamera(getCamera(req.params.id)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/cameras/:id/live/start', async (req, res) => {
    try {
      const ffmpeg = checkFfmpeg();
      if (!ffmpeg.available) {
        return res.status(503).json({
          error: 'FFmpeg is not installed. Install FFmpeg and restart the server.',
        });
      }
      res.json(sanitizeCamera(await startLive(req.params.id)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/cameras/:id/live/stop', (req, res) => {
    stopLive(req.params.id);
    res.json(sanitizeCamera(getCamera(req.params.id)));
  });

  app.post('/api/cameras/:id/record/start', async (req, res) => {
    try {
      const ffmpeg = checkFfmpeg();
      if (!ffmpeg.available) {
        return res.status(503).json({
          error: 'FFmpeg is not installed. Install FFmpeg and restart the server.',
        });
      }
      res.json(sanitizeCamera(await startRecording(req.params.id)));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/cameras/:id/record/stop', (req, res) => {
    stopRecording(req.params.id);
    res.json(sanitizeCamera(getCamera(req.params.id)));
  });

  app.get('/api/cameras/:id/preview.jpg', apiRateLimiter, async (req, res) => {
    const cam = getCamera(req.params.id);
    if (!cam) return res.status(404).json({ error: 'Camera not found' });
    if (!isHttpStreamUrl(cam.rtspUrl)) {
      return res.status(404).json({ error: 'Preview not available for this stream type' });
    }
    try {
      const jpeg = await fetchHttpPreviewJpeg(cam.rtspUrl);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(jpeg);
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  app.get('/api/cameras/:id/recordings', (req, res) => {
    const cam = getCamera(req.params.id);
    if (!cam) return res.status(404).json({ error: 'Camera not found' });
    res.json(listRecordings(req.params.id).map(sanitizeRecording));
  });

  app.get('/api/cameras/:id/timeline', (req, res) => {
    const cam = getCamera(req.params.id);
    if (!cam) return res.status(404).json({ error: 'Camera not found' });
    res.json(getTimeline(req.params.id));
  });

  // --- Recordings: playback, timeline, delete ---
  app.delete('/api/recordings/*', (req, res) => {
    const recordingId = decodeURIComponent(req.path.replace(/^\/api\/recordings\//, ''));
    try {
      res.json(deleteRecording(recordingId));
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  app.get('/api/recordings/*', (req, res) => {
    const recordingId = decodeURIComponent(req.path.replace(/^\/api\/recordings\//, ''));
    try {
      const filePath = getRecordingFile(recordingId);
      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      const byteRange = parseByteRange(range, stat.size);
      if (byteRange) {
        const { start, end } = byteRange;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', end - start + 1);
        res.setHeader('Content-Type', 'video/mp4');
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Accept-Ranges', 'bytes');
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  // --- ONVIF discovery and connection ---
  app.get('/api/onvif/discover', strictRateLimiter, async (_req, res) => {
    try {
      const result = await discoverDevices();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/onvif/interfaces', (_req, res) => {
    res.json({ interfaces: listNetworkInterfaces() });
  });

  app.post('/api/onvif/probe-host', strictRateLimiter, async (req, res) => {
    const { hostname } = req.body ?? {};
    let validatedHost;
    try {
      validatedHost = validateOnvifHostname(hostname);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    try {
      const devices = await probeHost(validatedHost);
      res.json({ devices });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/onvif/connect', strictRateLimiter, async (req, res) => {
    const { hostname, port, username, password } = req.body ?? {};
    let validatedHost;
    try {
      validatedHost = validateOnvifHostname(hostname);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    try {
      const result = await connectByHost({
        hostname: validatedHost,
        port: port ? parseInt(port, 10) : undefined,
        username,
        password,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/onvif/stream-uri', strictRateLimiter, async (req, res) => {
    const { hostname, port, username, password, path: onvifPath, secure } = req.body ?? {};
    let validatedHost;
    try {
      validatedHost = validateOnvifHostname(hostname);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    try {
      const result = await getStreamUri({
        hostname: validatedHost,
        port,
        username,
        password,
        path: onvifPath,
        secure,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Built client SPA (LAN mode) ---
  if (process.env.SERVE_CLIENT === 'true') {
    if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
      console.warn('[client] SERVE_CLIENT is set but client/dist is missing — run npm run build');
    } else {
      app.use(express.static(CLIENT_DIST, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }));
      app.get('*', (req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/live')) {
          next();
          return;
        }
        if (path.extname(req.path)) {
          next();
          return;
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(CLIENT_DIST, 'index.html'));
      });
    }
  }

  return app;
}
