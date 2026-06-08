import { checkFfmpeg } from './ffmpegUtil.js';
import { purgeExpiredRecordings } from './recordings.js';
import { getRetentionDays } from './settings.js';
import { createApp } from './app.js';
import { getStorageStatus } from './storage.js';
import {
  listCameras,
  restoreSessions,
  stopAll,
  stopAllRecordingsDueToLowDisk,
} from './streamManager.js';

const app = createApp();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const STORAGE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LISTEN_RETRY_MS = 250;
const LISTEN_RETRY_MAX = 20;
const SHUTDOWN_TIMEOUT_MS = 5_000;

let shuttingDown = false;
/** @type {import('http').Server | null} */
let server = null;

function runRetentionCleanup() {
  try {
    purgeExpiredRecordings();
  } catch (err) {
    console.error('[retention] cleanup failed:', err.message);
  }
}

runRetentionCleanup();
const retentionTimer = setInterval(runRetentionCleanup, RETENTION_INTERVAL_MS);

function runStorageGuard() {
  try {
    const storage = getStorageStatus();
    if (storage.status !== 'critical') return;

    console.warn(
      `[storage] critically low disk space (${storage.freeBytes} bytes free) — stopping recordings`,
    );
    stopAllRecordingsDueToLowDisk();
    purgeExpiredRecordings();
  } catch (err) {
    console.error('[storage] guard failed:', err.message);
  }
}

runStorageGuard();
const storageTimer = setInterval(runStorageGuard, STORAGE_CHECK_INTERVAL_MS);

function stopStreams() {
  for (const cam of listCameras()) {
    stopAll(cam.id);
  }
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[server] ${signal} received — shutting down`);
  clearInterval(retentionTimer);
  clearInterval(storageTimer);

  if (!server) {
    stopStreams();
    process.exit(0);
    return;
  }

  server.closeAllConnections?.();
  server.close((err) => {
    if (err) console.error('[server] shutdown error:', err.message);
    stopStreams();
    process.exit(err ? 1 : 0);
  });

  setTimeout(() => {
    console.error('[server] forced exit after shutdown timeout');
    stopStreams();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

function onListen() {
  console.log(`ONVIF-DVR server listening on http://${HOST}:${PORT}`);
  const retentionDays = getRetentionDays();
  console.log(
    retentionDays === 0
      ? 'Recording retention: disabled (manual cleanup only)'
      : `Recording retention: ${retentionDays} days`,
  );
  const ffmpeg = checkFfmpeg();
  if (ffmpeg.available) {
    restoreSessions();
  } else {
    console.warn('[sessions] FFmpeg unavailable — skipped session restore');
  }
}

function startServer(attempt = 0) {
  if (shuttingDown) return;

  const nextServer = app.listen(PORT, HOST, onListen);
  server = nextServer;

  nextServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < LISTEN_RETRY_MAX) {
      const delay = LISTEN_RETRY_MS + attempt * 100;
      console.warn(`[server] Port ${PORT} busy — retrying in ${delay}ms (${attempt + 1}/${LISTEN_RETRY_MAX})`);
      nextServer.close(() => {
        setTimeout(() => startServer(attempt + 1), delay);
      });
      return;
    }

    if (err.code === 'EADDRINUSE') {
      console.error(
        `[server] Port ${PORT} is still in use after ${LISTEN_RETRY_MAX} retries. Stop the other ONVIF-DVR process or set PORT to a different value.`,
      );
      process.exit(1);
    }

    throw err;
  });
}

startServer();

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
