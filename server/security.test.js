import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { getRecordingsDir } from './settings.js';
import {
  assertPathInsideRoot,
  maskRtspUrl,
  parseByteRange,
  validateOnvifHostname,
  validateRtspUrl,
} from './security.js';

describe('security helpers', () => {
  it('rejects path-prefix bypasses', () => {
    const root = path.join(os.tmpdir(), 'onvif-sec-root');
    const sibling = `${root}_backup`;
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    try {
      assert.throws(
        () => assertPathInsideRoot(root, path.join('..', path.basename(sibling), 'secret.mp4')),
        /Invalid recording path/,
      );
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true });
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows valid recording paths', () => {
    const root = getRecordingsDir();
    const resolved = assertPathInsideRoot(root, 'camera-id/clip.mp4');
    assert.equal(resolved, path.resolve(root, 'camera-id/clip.mp4'));
  });

  it('validates rtsp urls', () => {
    assert.equal(validateRtspUrl('rtsp://camera.local/stream1'), 'rtsp://camera.local/stream1');
    assert.throws(() => validateRtspUrl('http://camera.local/stream1'), /rtsp/i);
    assert.throws(() => validateRtspUrl('file:///etc/passwd'), /rtsp/i);
  });

  it('blocks metadata hostnames for onvif', () => {
    assert.throws(() => validateOnvifHostname('169.254.169.254'), /not allowed/i);
    assert.equal(validateOnvifHostname('10.0.0.100'), '10.0.0.100');
  });

  it('masks rtsp credentials', () => {
    assert.equal(
      maskRtspUrl('rtsp://user:pass@10.0.0.5/stream1'),
      'rtsp://****:****@10.0.0.5/stream1',
    );
  });

  it('parses and validates byte ranges', () => {
    assert.deepEqual(parseByteRange('bytes=0-99', 1000), { start: 0, end: 99 });
    assert.equal(parseByteRange('bytes=0-5000', 1000), null);
    assert.equal(parseByteRange('invalid', 1000), null);
  });
});
