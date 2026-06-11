import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { deleteCameraData, getCameraDataSummary } from './cameraData.js';
import { getRecordingsDir } from './settings.js';

const cameraId = '__camera_data_test__';

after(() => {
  deleteCameraData(cameraId);
});

describe('cameraData', () => {
  it('summarizes and deletes per-camera storage', () => {
    const recordingsDir = path.join(getRecordingsDir(), cameraId);
    fs.mkdirSync(recordingsDir, { recursive: true });
    fs.writeFileSync(path.join(recordingsDir, '2026-06-08_12-00-00.mp4'), 'test-bytes');

    const summary = getCameraDataSummary(cameraId);
    assert.ok(summary.recordingsBytes >= 10);
    assert.equal(summary.hasData, true);

    const result = deleteCameraData(cameraId);
    assert.equal(result.recordingsDeleted, true);
    assert.ok(!fs.existsSync(recordingsDir));

    const afterSummary = getCameraDataSummary(cameraId);
    assert.equal(afterSummary.hasData, false);
  });
});
