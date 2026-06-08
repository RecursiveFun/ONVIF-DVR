/**
 * Shared FFmpeg argument builders for live HLS and DVR segment recording.
 *
 * Centralizes RTSP input tuning, timestamp remux options, and audio transcode
 * settings so live and record pipelines stay consistent.
 */
export const DEFAULT_SEGMENT_SECONDS = 300;
/** @deprecated use settings.getSegmentSeconds() at runtime */
export const SEGMENT_SECONDS = DEFAULT_SEGMENT_SECONDS;

// --- Internal stream map and audio encode presets ---

function streamMaps() {
  return ['-map', '0:v:0', '-map', '0:a:0?'];
}

function audioEncodeArgs() {
  return [
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-af', 'aresample=async=1:first_pts=0',
  ];
}

// --- Exported argument groups ---

/** Keep copied RTSP timestamps stable for HLS/MP4 muxers. @returns {string[]} */
export function remuxTimestampArgs() {
  return [
    '-copytb', '1',
    '-fps_mode', 'passthrough',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '1024',
  ];
}

/** Browser-friendly HLS: copy video, transcode audio to AAC when present. @returns {string[]} */
export function liveOutputArgs() {
  return [
    ...streamMaps(),
    ...remuxTimestampArgs(),
    '-c:v', 'copy',
    ...audioEncodeArgs(),
  ];
}

/** DVR segments: copy video; transcode audio to AAC for MP4 compatibility (e.g. pcm_alaw). @returns {string[]} */
export function recordOutputArgs() {
  return [
    ...streamMaps(),
    ...remuxTimestampArgs(),
    '-c:v', 'copy',
    ...audioEncodeArgs(),
  ];
}

/** RTSP demuxer options tuned for low-latency TCP ingest. @returns {string[]} */
export function rtspInputOptions() {
  return [
    '-rtsp_transport', 'tcp',
    '-fflags', '+genpts',
    '-start_at_zero',
    '-flags', 'low_delay',
    '-thread_queue_size', '512',
    '-use_wallclock_as_timestamps', '1',
  ];
}
