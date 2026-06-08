import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SEGMENT_SECONDS,
  httpInputOptions,
  isFfmpegInvalidDataExit,
  isHttpStreamUrl,
  liveHlsFormatArgs,
  liveOutputArgs,
  recordOutputArgs,
  remuxTimestampArgs,
  rtspInputOptions,
  streamInputArgs,
} from './ffmpegArgs.js';

describe('ffmpegArgs', () => {
  it('defaults to five-minute DVR segments', () => {
    assert.equal(DEFAULT_SEGMENT_SECONDS, 300);
  });

  it('builds rtsp live output args without audio by default', () => {
    const args = liveOutputArgs('rtsp://camera.local/stream1');
    assert.ok(args.includes('-c:v:0'));
    assert.ok(args.includes('copy'));
    assert.ok(args.includes('-fps_mode:v:0'));
    assert.ok(!args.includes('-c:a:1'));
    assert.ok(!args.includes('-b:a:1'));
  });

  it('adds aac audio encode when rtsp probe reports audio', () => {
    const args = liveOutputArgs('rtsp://camera.local/stream1', { hasAudio: true });
    assert.ok(args.includes('-map'));
    assert.ok(args.includes('0:a:0?'));
    assert.ok(args.includes('-c:a:1'));
    assert.ok(args.includes('aac'));
    assert.ok(args.includes('-b:a:1'));
    assert.ok(args.includes('192k'));
  });

  it('builds record output args with optional aac audio only when requested', () => {
    const videoOnly = recordOutputArgs('rtsp://camera.local/stream1');
    assert.ok(videoOnly.includes('-c:v:0'));
    assert.ok(!videoOnly.includes('-c:a:1'));

    const withAudio = recordOutputArgs('rtsp://camera.local/stream1', { hasAudio: true });
    assert.ok(withAudio.includes('-c:a:1'));
    assert.ok(withAudio.includes('aac'));
  });

  it('uses tcp rtsp transport with timestamp flags', () => {
    const args = rtspInputOptions();
    assert.deepEqual(args, [
      '-rtsp_transport', 'tcp',
      '-fflags', '+genpts+igndts',
      '-flags', 'low_delay',
      '-thread_queue_size', '512',
      '-use_wallclock_as_timestamps', '1',
    ]);
  });

  it('adds remux timestamp args for copy mode outputs', () => {
    const args = remuxTimestampArgs();
    assert.ok(args.includes('-copytb'));
    assert.ok(args.includes('1'));
    assert.ok(args.includes('-avoid_negative_ts'));
    assert.ok(liveOutputArgs().includes('-copytb'));
    assert.ok(recordOutputArgs().includes('-avoid_negative_ts'));
    assert.ok(!remuxTimestampArgs({ transcode: true }).includes('-copytb'));
  });

  it('detects http stream urls and uses video-only transcode output args', () => {
    const httpUrl = 'http://203.181.0.118:6003/cgi-bin/camera?resolution=640&quality=1';
    assert.equal(isHttpStreamUrl(httpUrl), true);
    assert.equal(isHttpStreamUrl('rtsp://camera.local/stream1'), false);

    const live = liveOutputArgs(httpUrl);
    assert.ok(live.includes('libx264'));
    assert.ok(live.includes('-c:v:0'));
    assert.ok(!live.includes('-c:a'));
    assert.ok(!live.includes('-b:a'));
    assert.ok(!live.includes('-vsync'));
    assert.ok(recordOutputArgs(httpUrl).includes('libx264'));
    assert.ok(liveOutputArgs('rtsp://camera.local/stream1').includes('copy'));
  });

  it('builds protocol-specific ffmpeg input args', () => {
    const httpUrl = 'http://camera.local/cgi-bin/camera';
    const httpArgs = streamInputArgs(httpUrl);
    assert.ok(httpArgs.includes('-reconnect'));
    assert.ok(httpArgs.includes('-reconnect_at_eof'));
    assert.ok(httpArgs.includes('-f'));
    assert.ok(httpArgs.includes('mjpeg'));
    assert.equal(httpArgs.at(-1), httpUrl);
    assert.ok(streamInputArgs('rtsp://camera.local/stream1').includes('-rtsp_transport'));
    assert.ok(streamInputArgs(httpUrl, 'auto').includes('-analyzeduration'));
    assert.ok(!streamInputArgs(httpUrl, 'auto').includes('-f'));
    assert.equal(isFfmpegInvalidDataExit(3199971767), true);
    assert.deepEqual(httpInputOptions(), [
      '-user_agent', 'ONVIF-DVR/1.0',
      '-seekable', '0',
      '-err_detect', 'ignore_err',
      '-fflags', '+genpts+igndts+discardcorrupt',
      '-thread_queue_size', '512',
      '-use_wallclock_as_timestamps', '1',
      '-multiple_requests', '1',
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '5',
    ]);
  });

  it('adds omit_endlist hls flags for http live output', () => {
    const httpFlags = liveHlsFormatArgs('http://camera.local/cgi-bin/camera').join(' ');
    assert.ok(httpFlags.includes('omit_endlist'));
    assert.ok(!liveHlsFormatArgs('rtsp://camera.local/stream1').join(' ').includes('omit_endlist'));
  });
});
