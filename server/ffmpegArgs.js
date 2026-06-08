export const DEFAULT_SEGMENT_SECONDS = 300;
/** @deprecated use settings.getSegmentSeconds() at runtime */
export const SEGMENT_SECONDS = DEFAULT_SEGMENT_SECONDS;

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

/** Browser-friendly HLS: copy video, transcode audio to AAC when present. */
export function liveOutputArgs() {
  return [
    ...streamMaps(),
    '-c:v', 'copy',
    ...audioEncodeArgs(),
  ];
}

/** DVR segments: copy video; transcode audio to AAC for MP4 compatibility (e.g. pcm_alaw). */
export function recordOutputArgs() {
  return [
    ...streamMaps(),
    '-c:v', 'copy',
    ...audioEncodeArgs(),
  ];
}

export function rtspInputOptions() {
  return [
    '-rtsp_transport', 'tcp',
    '-fflags', '+genpts',
    '-use_wallclock_as_timestamps', '1',
  ];
}
