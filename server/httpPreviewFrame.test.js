import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFirstJpeg } from './httpPreviewFrame.js';

describe('httpPreviewFrame', () => {
  it('extracts the first complete jpeg from a buffer', () => {
    const prefix = Buffer.from('multipart junk ');
    const jpeg = Buffer.from([0xff, 0xd8, 0x00, 0x11, 0xff, 0xd9]);
    const suffix = Buffer.from('more data');
    const frame = extractFirstJpeg(Buffer.concat([prefix, jpeg, suffix]));
    assert.deepEqual(frame, jpeg);
  });

  it('returns null when no jpeg markers exist', () => {
    assert.equal(extractFirstJpeg(Buffer.from('not an image')), null);
  });
});
