/**
 * Helpers for fragmented MP4 playback in the browser.
 * Growing recordings often report duration 0 until fully buffered.
 */

/** Treat NaN/Infinity/zero as "unknown duration". */
export function usableDuration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Last seekable timestamp from the video element's buffered ranges. */
export function seekableEnd(video) {
  if (!video?.seekable?.length) return 0;
  try {
    return video.seekable.end(video.seekable.length - 1);
  } catch {
    return 0;
  }
}
