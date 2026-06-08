import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFfprobeHasAudio } from './rtspStreamProbe.js';

describe('rtspStreamProbe', () => {
  it('detects audio from ffprobe stdout', () => {
    assert.equal(parseFfprobeHasAudio('audio\n'), true);
    assert.equal(parseFfprobeHasAudio('video\n'), false);
    assert.equal(parseFfprobeHasAudio(''), false);
  });
});
