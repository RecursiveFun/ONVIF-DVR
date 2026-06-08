import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldLogFfmpegStderr } from './ffmpegUtil.js';

describe('ffmpegUtil', () => {
  it('suppresses benign HTTP reconnect eof logs', () => {
    assert.equal(
      shouldLogFfmpegStderr('[http @ 000001be40e02800] Will reconnect at 29998 in 0 second(s), error=End of file.'),
      false,
    );
    assert.equal(shouldLogFfmpegStderr('Error opening input file rtsp://x'), true);
    assert.equal(shouldLogFfmpegStderr(''), false);
    assert.equal(
      shouldLogFfmpegStderr('Codec AVOption b:a:1 (set bitrate (in bits/s)) has not been used for any stream.'),
      false,
    );
    assert.equal(shouldLogFfmpegStderr('[hls @ 0] Timestamps are unset in a packet for stream 0.'), false);
    assert.equal(
      shouldLogFfmpegStderr('[hls muxer @ 0] failed to delete old segment seg_11909.ts: No such file or directory'),
      false,
    );
  });
});
