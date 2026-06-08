import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  clampRetentionDays,
  clampSegmentSeconds,
  DATA_DIR,
  DEFAULT_RECORDINGS_DIR,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_SEGMENT_SECONDS,
  getRecordingsDir,
  getRetentionDays,
  getSegmentSeconds,
  getSettings,
  resetSettingsForTests,
  resolveRecordingsDir,
  updateSettings,
  validateRecordingsDir,
} from './settings.js';

after(() => {
  resetSettingsForTests();
});

describe('settings', () => {
  it('defaults to five-minute segments', () => {
    resetSettingsForTests();
    assert.equal(getSegmentSeconds(), DEFAULT_SEGMENT_SECONDS);
    assert.equal(getSettings().segmentDurationSec, DEFAULT_SEGMENT_SECONDS);
  });

  it('clamps segment duration to allowed bounds', () => {
    assert.equal(clampSegmentSeconds(30), 60);
    assert.equal(clampSegmentSeconds(300), 300);
    assert.equal(clampSegmentSeconds(9999), 3600);
    assert.equal(clampSegmentSeconds('bad'), DEFAULT_SEGMENT_SECONDS);
  });

  it('persists updated segment duration', () => {
    resetSettingsForTests();
    const updated = updateSettings({ segmentDurationSec: 600 });
    assert.equal(updated.segmentDurationSec, 600);
    assert.equal(getSegmentSeconds(), 600);
  });

  it('defaults to seven-day retention', () => {
    resetSettingsForTests();
    assert.equal(getRetentionDays(), DEFAULT_RETENTION_DAYS);
    assert.equal(getSettings().retentionDays, DEFAULT_RETENTION_DAYS);
  });

  it('clamps retention days to allowed bounds', () => {
    assert.equal(clampRetentionDays(-1), 0);
    assert.equal(clampRetentionDays(7), 7);
    assert.equal(clampRetentionDays(999), 365);
    assert.equal(clampRetentionDays('bad'), DEFAULT_RETENTION_DAYS);
  });

  it('persists updated retention days', () => {
    resetSettingsForTests();
    const updated = updateSettings({ retentionDays: 14 });
    assert.equal(updated.retentionDays, 14);
    assert.equal(getRetentionDays(), 14);
    const disabled = updateSettings({ retentionDays: 0 });
    assert.equal(disabled.retentionDays, 0);
    assert.equal(getRetentionDays(), 0);
  });

  it('resolves relative and absolute recordings paths', () => {
    const relative = resolveRecordingsDir('data/recordings');
    assert.equal(relative, DEFAULT_RECORDINGS_DIR);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onvif-settings-'));
    assert.equal(resolveRecordingsDir(tempDir), path.resolve(tempDir));
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists a custom recordings folder', () => {
    resetSettingsForTests();
    const tempDir = fs.mkdtempSync(path.join(DATA_DIR, 'settings-test-'));
    const updated = updateSettings({ recordingsDir: tempDir });
    assert.equal(updated.recordingsDir, path.resolve(tempDir));
    assert.equal(getRecordingsDir(), path.resolve(tempDir));
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetSettingsForTests();
  });

  it('rejects unwritable recordings folders', () => {
    if (process.platform === 'win32') return;
    const blocked = fs.mkdtempSync(path.join(os.tmpdir(), 'onvif-blocked-'));
    try {
      fs.chmodSync(blocked, 0o000);
      assert.throws(() => validateRecordingsDir(blocked), /not writable/i);
    } finally {
      fs.chmodSync(blocked, 0o700);
      fs.rmSync(blocked, { recursive: true, force: true });
    }
  });
});
