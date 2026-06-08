/**
 * Shared FFmpeg argument builders for live HLS and DVR segment recording.
 *
 * Centralizes RTSP/HTTP input tuning, timestamp remux options, and audio transcode
 * settings so live and record pipelines stay consistent.
 */
export const DEFAULT_SEGMENT_SECONDS = 300;
/** @deprecated use settings.getSegmentSeconds() at runtime */
export const SEGMENT_SECONDS = DEFAULT_SEGMENT_SECONDS;

// --- Internal stream map and encode presets ---

function videoOnlyMaps() {
  return ['-map', '0:v:0'];
}

function videoAndOptionalAudioMaps() {
  return ['-map', '0:v:0', '-map', '0:a:0?'];
}

/** Stream-specific audio encode — only when an audio stream is mapped to output :1. */
function optionalAudioEncodeArgs() {
  return [
    '-c:a:1', 'aac',
    '-b:a:1', '192k',
    '-ar:a:1', '44100',
    '-ac:a:1', '2',
    '-af:a:1', 'aresample=async=1:first_pts=0',
  ];
}

function rtspVideoEncodeArgs() {
  return ['-c:v:0', 'copy', '-fps_mode:v:0', 'passthrough'];
}

function httpVideoEncodeArgs() {
  return [
    '-c:v:0', 'libx264',
    '-preset:v:0', 'veryfast',
    '-tune:v:0', 'zerolatency',
    '-crf:v:0', '23',
    '-g:v:0', '48',
    '-keyint_min:v:0', '48',
    '-sc_threshold:v:0', '0',
    '-fps_mode:v:0', 'auto',
  ];
}

// --- Exported argument groups ---

/**
 * Timestamp/muxer tuning for outputs.
 * @param {{ transcode?: boolean }} [options]
 * @returns {string[]}
 */
export function remuxTimestampArgs({ transcode = false } = {}) {
  const args = [
    '-max_muxing_queue_size', '1024',
    '-avoid_negative_ts', 'make_zero',
    '-muxpreload', '0',
    '-muxdelay', '0',
  ];
  if (!transcode) {
    args.push('-copytb', '1');
  }
  return args;
}

/** @param {string | null | undefined} streamUrl */
export function isHttpStreamUrl(streamUrl) {
  if (!streamUrl || typeof streamUrl !== 'string') return false;
  return /^https?:\/\//i.test(streamUrl.trim());
}

/**
 * Browser-friendly HLS: copy H.264 from RTSP; transcode MJPEG/HTTP sources to H.264.
 * HTTP/MJPEG cameras are treated as video-only (no audio encode flags).
 * @param {string} [streamUrl]
 * @returns {string[]}
 */
export function liveOutputArgs(streamUrl, { hasAudio = false } = {}) {
  const http = isHttpStreamUrl(streamUrl);
  const includeAudio = !http && hasAudio;
  return [
    ...(http || !includeAudio ? videoOnlyMaps() : videoAndOptionalAudioMaps()),
    ...remuxTimestampArgs({ transcode: http }),
    ...(http ? httpVideoEncodeArgs() : rtspVideoEncodeArgs()),
    ...(includeAudio ? optionalAudioEncodeArgs() : []),
  ];
}

/**
 * DVR segments: copy RTSP video; transcode HTTP/MJPEG for MP4 compatibility.
 * @param {string} [streamUrl]
 * @returns {string[]}
 */
export function recordOutputArgs(streamUrl, { hasAudio = false } = {}) {
  const http = isHttpStreamUrl(streamUrl);
  const includeAudio = !http && hasAudio;
  return [
    ...(http || !includeAudio ? videoOnlyMaps() : videoAndOptionalAudioMaps()),
    ...remuxTimestampArgs({ transcode: http }),
    ...(http ? httpVideoEncodeArgs() : rtspVideoEncodeArgs()),
    ...(includeAudio ? optionalAudioEncodeArgs() : []),
  ];
}

/** RTSP demuxer options tuned for low-latency TCP ingest. @returns {string[]} */
export function rtspInputOptions() {
  return [
    '-rtsp_transport', 'tcp',
    '-fflags', '+genpts+igndts',
    '-flags', 'low_delay',
    '-thread_queue_size', '512',
    '-use_wallclock_as_timestamps', '1',
  ];
}

/** HTTP/MJPEG ingest with reconnect for flaky camera endpoints. @returns {string[]} */
export function httpInputOptions() {
  return [
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
  ];
}

/** HLS packaging tuned for continuous live output. @param {string} [streamUrl] @returns {string[]} */
export function liveHlsFormatArgs(streamUrl) {
  // Fresh playlist each process start (stale files cleared in streamManager).
  const flags = ['delete_segments', 'split_by_time'];
  if (isHttpStreamUrl(streamUrl)) {
    flags.push('omit_endlist');
  }
  return [
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '6',
    '-hls_flags', flags.join('+'),
  ];
}

/**
 * Input demuxer flags for a camera stream URL.
 * @param {string} streamUrl
 * @returns {string[]}
 */
export function streamInputOptions(streamUrl) {
  return isHttpStreamUrl(streamUrl) ? httpInputOptions() : rtspInputOptions();
}

/**
 * FFmpeg `-i` preamble for a camera stream URL.
 * @param {string} streamUrl
 * @param {'mjpeg' | 'mpjpeg' | 'auto' | null | undefined} [httpInputFormat]
 * @returns {string[]}
 */
export function streamInputArgs(streamUrl, httpInputFormat = 'mjpeg') {
  if (isHttpStreamUrl(streamUrl)) {
    const args = [...httpInputOptions()];
    if (httpInputFormat && httpInputFormat !== 'auto') {
      args.push('-f', httpInputFormat);
    } else if (httpInputFormat === 'auto') {
      args.push('-probesize', '5000000', '-analyzeduration', '5000000');
    }
    args.push('-i', streamUrl);
    return args;
  }
  return [...streamInputOptions(streamUrl), '-i', streamUrl];
}

/** @param {number | null} code */
export function isFfmpegInvalidDataExit(code) {
  if (code == null) return false;
  const normalized = code > 0x80000000 ? code - 0x100000000 : code;
  return normalized === -1094995529;
}
