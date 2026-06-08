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
  normalizeStreamUrl,
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

  it('validates rtsp and http stream urls', () => {
    assert.equal(validateRtspUrl('rtsp://camera.local/stream1'), 'rtsp://camera.local/stream1');
    assert.equal(
      validateRtspUrl('http://203.181.0.118:6003/cgi-bin/camera?resolution=640&quality=1'),
      'http://203.181.0.118:6003/cgi-bin/camera?resolution=640&quality=1',
    );
    assert.throws(() => validateRtspUrl('file:///etc/passwd'), /stream url/i);
    assert.throws(() => validateRtspUrl('ftp://camera.local/stream1'), /stream url/i);
  });

  it('normalizes html-encoded stream urls', () => {
    const encoded = 'http://203.181.0.118:6003/cgi-bin/camera?resolution=640&amp;amp;quality=1&amp;amp;Language=0';
    assert.equal(
      validateRtspUrl(encoded),
      'http://203.181.0.118:6003/cgi-bin/camera?resolution=640&quality=1&Language=0',
    );
    assert.equal(
      normalizeStreamUrl('rtsp://cam.local/a&amp;b'),
      'rtsp://cam.local/a&b',
    );
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
    assert.equal(
      maskRtspUrl('http://user:pass@10.0.0.5/cgi-bin/camera'),
      'http://****:****@10.0.0.5/cgi-bin/camera',
    );
  });

  it('parses and validates byte ranges', () => {
    assert.deepEqual(parseByteRange('bytes=0-99', 1000), { start: 0, end: 99 });
    assert.equal(parseByteRange('bytes=0-5000', 1000), null);
    assert.equal(parseByteRange('invalid', 1000), null);
  });
});
