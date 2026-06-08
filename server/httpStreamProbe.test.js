import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectHttpInputFormat,
  nextHttpInputFormat,
} from './httpStreamProbe.js';

describe('httpStreamProbe', () => {
  it('detects multipart and raw jpeg streams', () => {
    assert.equal(
      detectHttpInputFormat('multipart/x-mixed-replace; boundary=frame', null),
      'mpjpeg',
    );
    assert.equal(
      detectHttpInputFormat('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff])),
      'mjpeg',
    );
    assert.equal(
      detectHttpInputFormat('text/html', Uint8Array.from([0x3c, 0x68])),
      'auto',
    );
  });

  it('walks demuxer fallbacks', () => {
    assert.equal(nextHttpInputFormat('mjpeg'), 'mpjpeg');
    assert.equal(nextHttpInputFormat('mpjpeg'), 'auto');
    assert.equal(nextHttpInputFormat('auto'), null);
    assert.equal(nextHttpInputFormat(null), 'mpjpeg');
  });
});
