import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  deleteRecording,
  getRecordingFile,
  getTimeline,
  listRecordings,
  parseSegmentTime,
} from './recordings.js';
import { getRecordingsDir } from './settings.js';

const TEST_CAM = '__vitest_recordings__';
const TEST_DIR = path.join(getRecordingsDir(), TEST_CAM);
const TEST_FILE = '2026-06-08_14-30-00.mp4';

before(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, TEST_FILE), 'fake-video-bytes');
});

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('parseSegmentTime', () => {
  it('parses segment filenames into local dates', () => {
    const date = parseSegmentTime('2026-06-08_14-30-00.mp4');
    assert.ok(date instanceof Date);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 5);
    assert.equal(date.getDate(), 8);
    assert.equal(date.getHours(), 14);
    assert.equal(date.getMinutes(), 30);
    assert.equal(date.getSeconds(), 0);
  });

  it('returns null for invalid filenames', () => {
    assert.equal(parseSegmentTime('not-a-segment.mp4'), null);
    assert.equal(parseSegmentTime('2026-06-08.mp4'), null);
  });
});

describe('listRecordings', () => {
  it('lists mp4 files for a camera', () => {
    const files = listRecordings(TEST_CAM);
    assert.equal(files.length, 1);
    assert.equal(files[0].id, `${TEST_CAM}/${TEST_FILE}`);
    assert.equal(files[0].filename, TEST_FILE);
    assert.ok(files[0].startLocal);
    assert.ok(files[0].durationSec > 0);
  });

  it('returns an empty list for unknown cameras', () => {
    assert.deepEqual(listRecordings('missing-camera-id'), []);
  });
});

describe('getTimeline', () => {
  it('returns enriched segments with a range', () => {
    const timeline = getTimeline(TEST_CAM);
    assert.equal(timeline.segments.length, 1);
    assert.ok(timeline.rangeStart);
    assert.ok(timeline.rangeEnd);
    assert.ok(timeline.segments[0].endLocal);
  });

  it('returns empty timeline when no recordings exist', () => {
    assert.deepEqual(getTimeline('missing-camera-id'), {
      segments: [],
      rangeStart: null,
      rangeEnd: null,
    });
  });
});

describe('deleteRecording', () => {
  it('deletes an existing recording file', () => {
    const recordingId = `${TEST_CAM}/${TEST_FILE}`;
    const result = deleteRecording(recordingId);
    assert.deepEqual(result, { ok: true, id: recordingId });
    assert.throws(() => getRecordingFile(recordingId), /Recording not found/);

    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, TEST_FILE), 'fake-video-bytes');
  });

  it('rejects deleting invalid paths', () => {
    assert.throws(
      () => deleteRecording('../../outside.mp4'),
      /Invalid recording path/,
    );
  });
});

describe('getRecordingFile', () => {
  it('resolves a recording inside the recordings directory', () => {
    const filePath = getRecordingFile(`${TEST_CAM}/${TEST_FILE}`);
    assert.equal(path.normalize(filePath), path.normalize(path.join(TEST_DIR, TEST_FILE)));
  });

  it('rejects path traversal', () => {
    assert.throws(
      () => getRecordingFile('../../outside.mp4'),
      /Invalid recording path/,
    );
  });

  it('throws when the recording does not exist', () => {
    assert.throws(
      () => getRecordingFile(`${TEST_CAM}/missing.mp4`),
      /Recording not found/,
    );
  });
});
