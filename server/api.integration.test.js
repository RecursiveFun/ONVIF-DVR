import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { checkFfmpeg } from './ffmpegUtil.js';
import { resetSettingsForTests } from './settings.js';
import { getRecordingsDir } from './settings.js';

const app = createApp();
const TEST_CAM_NAME = '__api_integration_camera__';
const TEST_RTSP = 'rtsp://integration.test.example/stream';
const TEST_RECORDING_DIR = '__api_integration_recordings__';
const TEST_RECORDING_FILE = '2026-06-08_14-30-00.mp4';

let testCameraId = null;

function findTestCamera(cameras) {
  return cameras.find((cam) => cam.name === TEST_CAM_NAME) || null;
}

before(async () => {
  const existing = findTestCamera((await request(app).get('/api/cameras')).body);
  if (existing) {
    await request(app).delete(`/api/cameras/${existing.id}`);
  }

  const res = await request(app)
    .post('/api/cameras')
    .send({ name: TEST_CAM_NAME, rtspUrl: TEST_RTSP })
    .expect(201);

  testCameraId = res.body.id;

  const recordingDir = path.join(getRecordingsDir(), testCameraId);
  fs.mkdirSync(recordingDir, { recursive: true });
  fs.writeFileSync(path.join(recordingDir, TEST_RECORDING_FILE), 'integration-test-bytes');
});

after(async () => {
  if (testCameraId) {
    await request(app).delete(`/api/cameras/${testCameraId}`).catch(() => {});
    testCameraId = null;
  }

  const staleDir = path.join(getRecordingsDir(), TEST_RECORDING_DIR);
  if (fs.existsSync(staleDir)) {
    fs.rmSync(staleDir, { recursive: true, force: true });
  }
});

describe('filesystem browser API', () => {
  it('lists browse roots', async () => {
    const res = await request(app).get('/api/fs/roots').expect(200);
    assert.ok(Array.isArray(res.body.roots));
    assert.ok(res.body.roots.length >= 2);
    assert.equal(typeof res.body.roots[0].path, 'string');
  });

  it('lists directories for a valid path', async () => {
    const roots = (await request(app).get('/api/fs/roots').expect(200)).body.roots;
    const res = await request(app)
      .get('/api/fs/directories')
      .query({ path: roots[0].path })
      .expect(200);
    assert.equal(typeof res.body.path, 'string');
    assert.ok(Array.isArray(res.body.entries));
  });
});

describe('GET /api/storage', () => {
  it('returns disk and DVR usage', async () => {
    const res = await request(app).get('/api/storage').expect(200);
    assert.equal(typeof res.body.freeBytes, 'number');
    assert.equal(typeof res.body.totalBytes, 'number');
    assert.equal(typeof res.body.recordingsBytes, 'number');
    assert.equal(typeof res.body.canRecord, 'boolean');
    assert.ok(['ok', 'low', 'critical'].includes(res.body.status));
  });
});

describe('settings API', () => {
  after(() => {
    resetSettingsForTests();
  });

  it('returns current settings', async () => {
    const res = await request(app).get('/api/settings').expect(200);
    assert.equal(typeof res.body.segmentDurationSec, 'number');
    assert.ok(res.body.segmentDurationSec >= 60);
    assert.equal(typeof res.body.recordingsDir, 'string');
    assert.ok(res.body.recordingsDir.length > 0);
    assert.equal(typeof res.body.retentionDays, 'number');
    assert.ok(res.body.retentionDays >= 0);
  });

  it('updates segment duration', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ segmentDurationSec: 120 })
      .expect(200);
    assert.equal(res.body.segmentDurationSec, 120);
  });

  it('rejects out-of-range segment duration', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ segmentDurationSec: 10 })
      .expect(400);
    assert.match(res.body.error, /between/i);
  });

  it('rejects empty settings updates', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({})
      .expect(400);
    assert.match(res.body.error, /no settings to update/i);
  });

  it('updates retention days', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ retentionDays: 30 })
      .expect(200);
    assert.equal(res.body.retentionDays, 30);
  });

  it('rejects out-of-range retention days', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ retentionDays: 500 })
      .expect(400);
    assert.match(res.body.error, /between/i);
  });

  it('updates the recordings folder path', async () => {
    const customDir = path.join(getRecordingsDir(), '..', '__settings_test_recordings__');
    const res = await request(app)
      .patch('/api/settings')
      .send({ recordingsDir: customDir })
      .expect(200);
    assert.equal(res.body.recordingsDir, path.resolve(customDir));
    assert.ok(fs.existsSync(res.body.recordingsDir));
    if (fs.existsSync(customDir)) {
      fs.rmSync(customDir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/health', () => {
  it('returns ok with ffmpeg status', async () => {
    const res = await request(app).get('/api/health').expect(200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.ffmpeg.available, 'boolean');
  });
});

describe('camera CRUD', () => {
  it('lists cameras including the test camera', async () => {
    const res = await request(app).get('/api/cameras').expect(200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((cam) => cam.id === testCameraId));
  });

  it('rejects camera creation without rtspUrl', async () => {
    const res = await request(app)
      .post('/api/cameras')
      .send({ name: 'Missing URL' })
      .expect(400);
    assert.match(res.body.error, /rtspUrl is required/i);
  });

  it('creates a camera with a default name', async () => {
    const res = await request(app)
      .post('/api/cameras')
      .send({ rtspUrl: 'rtsp://temp.example/stream' })
      .expect(201);

    assert.equal(res.body.name, 'Camera');
    if (checkFfmpeg().available) {
      assert.equal(res.body.status, 'live');
    } else {
      assert.equal(res.body.status, 'idle');
    }
    await request(app).delete(`/api/cameras/${res.body.id}`).expect(200);
  });

  it('creates a camera from an http mjpeg-style url', async () => {
    const encoded = 'http://203.181.0.118:6003/cgi-bin/camera?resolution=640&amp;amp;quality=1';
    const res = await request(app)
      .post('/api/cameras')
      .send({ name: 'HTTP Cam', rtspUrl: encoded })
      .expect(201);

    assert.equal(res.body.name, 'HTTP Cam');
    assert.match(res.body.rtspUrl, /^http:\/\/203\.181\.0\.118:6003\/cgi-bin\/camera\?/);
    assert.ok(res.body.rtspUrl.includes('quality=1'));
    await request(app).delete(`/api/cameras/${res.body.id}`).expect(200);
  });

  it('returns 404 for unknown camera routes', async () => {
    const unknown = '00000000-0000-0000-0000-000000000000';
    await request(app).get(`/api/cameras/${unknown}/timeline`).expect(404);
    await request(app).get(`/api/cameras/${unknown}/recordings`).expect(404);
    await request(app).delete(`/api/cameras/${unknown}`).expect(404);
  });
});

describe('recordings API', () => {
  it('returns timeline data for the test camera', async () => {
    const res = await request(app)
      .get(`/api/cameras/${testCameraId}/timeline`)
      .expect(200);

    assert.equal(res.body.segments.length, 1);
    assert.ok(res.body.rangeStart);
    assert.ok(res.body.rangeEnd);
    assert.equal(res.body.segments[0].filename, TEST_RECORDING_FILE);
  });

  it('lists recordings for the test camera', async () => {
    const res = await request(app)
      .get(`/api/cameras/${testCameraId}/recordings`)
      .expect(200);

    assert.equal(res.body.length, 1);
    assert.ok(res.body[0].id.endsWith(TEST_RECORDING_FILE));
  });

  it('serves an existing recording file', async () => {
    const listing = await request(app)
      .get(`/api/cameras/${testCameraId}/recordings`)
      .expect(200);

    const recordingId = listing.body[0].id;
    const res = await request(app)
      .get(`/api/recordings/${encodeURIComponent(recordingId)}`)
      .expect(200);

    assert.equal(res.headers['content-type'], 'video/mp4');
    assert.ok(Number(res.headers['content-length']) > 0);
  });

  it('returns 404 for missing recordings', async () => {
    const res = await request(app)
      .get(`/api/recordings/${testCameraId}/missing.mp4`)
      .expect(404);
    assert.match(res.body.error, /not found/i);
  });

  it('deletes an existing recording', async () => {
    const listing = await request(app)
      .get(`/api/cameras/${testCameraId}/recordings`)
      .expect(200);

    const recordingId = listing.body[0].id;
    const res = await request(app)
      .delete(`/api/recordings/${encodeURIComponent(recordingId)}`)
      .expect(200);

    assert.equal(res.body.ok, true);
    assert.equal(res.body.id, recordingId);
    await request(app)
      .get(`/api/recordings/${encodeURIComponent(recordingId)}`)
      .expect(404);

    fs.mkdirSync(path.join(getRecordingsDir(), testCameraId), { recursive: true });
    fs.writeFileSync(
      path.join(getRecordingsDir(), testCameraId, TEST_RECORDING_FILE),
      'integration-test-bytes',
    );
  });
});

describe('ONVIF validation', () => {
  it('requires hostname for probe-host', async () => {
    const res = await request(app)
      .post('/api/onvif/probe-host')
      .send({})
      .expect(400);
    assert.match(res.body.error, /hostname is required/i);
  });

  it('requires hostname for stream-uri', async () => {
    const res = await request(app)
      .post('/api/onvif/stream-uri')
      .send({})
      .expect(400);
    assert.match(res.body.error, /hostname is required/i);
  });

  it('returns network interfaces', async () => {
    const res = await request(app).get('/api/onvif/interfaces').expect(200);
    assert.ok(Array.isArray(res.body.interfaces));
  });
});
