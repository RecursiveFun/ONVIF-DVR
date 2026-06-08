import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isLiveHlsArtifact } from './liveHls.js';

describe('liveHls', () => {
  it('recognizes HLS playlist and segment files', () => {
    assert.equal(isLiveHlsArtifact('index.m3u8'), true);
    assert.equal(isLiveHlsArtifact('seg_000.ts'), true);
    assert.equal(isLiveHlsArtifact('seg_11909.ts'), true);
    assert.equal(isLiveHlsArtifact('notes.txt'), false);
  });
});
