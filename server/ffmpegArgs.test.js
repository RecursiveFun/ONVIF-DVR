import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SEGMENT_SECONDS,
  liveOutputArgs,
  recordOutputArgs,
  remuxTimestampArgs,
  rtspInputOptions,
} from './ffmpegArgs.js';

describe('ffmpegArgs', () => {
  it('defaults to five-minute DVR segments', () => {
    assert.equal(DEFAULT_SEGMENT_SECONDS, 300);
  });

  it('builds live output args with copied video and AAC audio', () => {
    const args = liveOutputArgs();
    assert.ok(args.includes('-c:v'));
    assert.ok(args.includes('copy'));
    assert.ok(args.includes('-c:a'));
    assert.ok(args.includes('aac'));
  });

  it('builds record output args with copied video and AAC audio', () => {
    const args = recordOutputArgs();
    assert.ok(args.includes('-c:v'));
    assert.ok(args.includes('copy'));
    assert.ok(args.includes('-c:a'));
    assert.ok(args.includes('aac'));
  });

  it('uses tcp rtsp transport with timestamp flags', () => {
    const args = rtspInputOptions();
    assert.deepEqual(args, [
      '-rtsp_transport', 'tcp',
      '-fflags', '+genpts',
      '-start_at_zero',
      '-flags', 'low_delay',
      '-thread_queue_size', '512',
      '-use_wallclock_as_timestamps', '1',
    ]);
  });

  it('adds remux timestamp args for copy mode outputs', () => {
    const args = remuxTimestampArgs();
    assert.ok(args.includes('-copytb'));
    assert.ok(args.includes('1'));
    assert.ok(args.includes('-fps_mode'));
    assert.ok(args.includes('passthrough'));
    assert.ok(liveOutputArgs().includes('-copytb'));
    assert.ok(recordOutputArgs().includes('-avoid_negative_ts'));
  });
});
