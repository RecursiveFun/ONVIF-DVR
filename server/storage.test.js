import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  classifyStorage,
  CRITICAL_FREE_BYTES,
  formatBytes,
  getRecordingsBytes,
  getStorageStatus,
  WARN_FREE_BYTES,
} from './storage.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onvif-storage-test-'));
const tempRecordings = path.join(tempRoot, 'recordings');

before(() => {
  fs.mkdirSync(path.join(tempRecordings, 'cam-a'), { recursive: true });
  fs.writeFileSync(path.join(tempRecordings, 'cam-a', 'clip.mp4'), '12345');
});

after(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('storage helpers', () => {
  it('formats byte sizes', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(5 * 1024 ** 2), '5.0 MB');
    assert.equal(formatBytes(2.5 * 1024 ** 3), '2.5 GB');
  });

  it('classifies disk space thresholds', () => {
    assert.equal(classifyStorage(CRITICAL_FREE_BYTES - 1), 'critical');
    assert.equal(classifyStorage(CRITICAL_FREE_BYTES), 'low');
    assert.equal(classifyStorage(WARN_FREE_BYTES - 1), 'low');
    assert.equal(classifyStorage(WARN_FREE_BYTES), 'ok');
  });

  it('sums recording file sizes', () => {
    assert.equal(getRecordingsBytes(tempRecordings), 5);
    assert.equal(getRecordingsBytes(path.join(tempRoot, 'missing')), 0);
  });

  it('returns storage status for the data volume', () => {
    const status = getStorageStatus();
    assert.equal(typeof status.freeBytes, 'number');
    assert.equal(typeof status.totalBytes, 'number');
    assert.equal(typeof status.recordingsBytes, 'number');
    assert.ok(['ok', 'low', 'critical'].includes(status.status));
    assert.equal(typeof status.canRecord, 'boolean');
    assert.equal(status.criticalFreeBytes, CRITICAL_FREE_BYTES);
    assert.equal(status.warnFreeBytes, WARN_FREE_BYTES);
  });
});
