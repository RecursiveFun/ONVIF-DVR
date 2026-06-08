/**
 * Timeline bar math — converts between pixels, wall-clock time, and playback offset.
 *
 * Two time bases are used throughout scrubbing:
 *   1. Timeline time (ms) — absolute clock time from rangeStart to rangeEnd.
 *      Used to position segment bars and the red playhead on the full-day track.
 *   2. Segment offset (seconds) — position within the currently playing file (0 … duration).
 *      Used by the video player when seeking.
 *
 * Scrub flow: pointer X on the track → timeline ms → segment offset sec → DVRPlayer.seek.
 */

import { segmentEndTime, segmentTime } from './segments.js';

/** Keep a number inside [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The full time window shown by the timeline bar (usually first segment → last segment).
 * Returns milliseconds so all layout math stays in one unit until we need seconds for the player.
 */
export function timelineRange(rangeStart, rangeEnd) {
  const startMs = rangeStart ? new Date(rangeStart).getTime() : 0;
  const endMs = rangeEnd ? new Date(rangeEnd).getTime() : startMs + 1;
  // Avoid division by zero when the range is empty or a single instant.
  const span = Math.max(endMs - startMs, 1);
  return { startMs, endMs, span };
}

/**
 * Which slice of the timeline is visible inside the scrollable viewport.
 * When zoomed in, the track is wider than the viewport; scroll position picks the window.
 */
export function getVisibleTimeMs(scrollLeft, viewportWidth, zoomLevel, startMs, span) {
  const trackWidth = viewportWidth * zoomLevel;
  if (!viewportWidth || trackWidth <= 0) {
    return { startMs, endMs: startMs + span };
  }

  const scrollFraction = scrollLeft / trackWidth;
  const viewportFraction = (scrollLeft + viewportWidth) / trackWidth;

  return {
    startMs: startMs + scrollFraction * span,
    endMs: startMs + viewportFraction * span,
  };
}

/**
 * Where a segment bar should sit on the track, as CSS percentages.
 * Minimum width keeps very short clips visible as a sliver.
 */
export function segmentBarLayout(seg, timelineStartMs, timelineSpan) {
  const segStart = segmentTime(seg);
  const segEnd = segmentEndTime(seg);
  const durationMs = segEnd - segStart;

  return {
    segStart,
    segEnd,
    left: ((segStart - timelineStartMs) / timelineSpan) * 100,
    width: Math.max((durationMs / timelineSpan) * 100, 0.5),
  };
}

/**
 * Turn a pointer position on the timeline track into seconds inside the given segment.
 *
 * Steps:
 *   1. Map clientX to a fraction across the track width.
 *   2. Convert that fraction to an absolute timestamp on the timeline.
 *   3. Subtract the segment start to get offset seconds, clamped to the segment duration.
 */
export function segmentOffsetSecFromClientX(clientX, trackEl, seg, timelineStartMs, timelineSpan) {
  if (!trackEl || !seg || !Number.isFinite(clientX)) return null;

  const trackRect = trackEl.getBoundingClientRect();
  if (!trackRect.width) return null;

  const pointerXOnTrack = clamp(clientX - trackRect.left, 0, trackRect.width);
  const pointerFraction = pointerXOnTrack / trackRect.width;
  const absoluteMs = timelineStartMs + pointerFraction * timelineSpan;

  const segStartMs = segmentTime(seg);
  const segEndMs = segmentEndTime(seg);
  const segmentDurationSec = Math.max((segEndMs - segStartMs) / 1000, 0);
  const offsetSec = (absoluteMs - segStartMs) / 1000;

  return clamp(offsetSec, 0, segmentDurationSec);
}

function formatWallClockTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Position and label for the red playhead while a segment is playing or being scrubbed.
 * timeSec is the current offset inside the segment file (from the player or drag preview).
 */
export function playbackScrubMarker(seg, timeSec, timelineStartMs, timelineSpan) {
  const segStartMs = segmentTime(seg);
  const segEndMs = segmentEndTime(seg);
  const segmentDurationSec = Math.max((segEndMs - segStartMs) / 1000, 0);
  const clampedOffsetSec = clamp(timeSec ?? 0, 0, segmentDurationSec);
  const absoluteMs = segStartMs + clampedOffsetSec * 1000;

  return {
    leftPercent: clamp(((absoluteMs - timelineStartMs) / timelineSpan) * 100, 0, 100),
    label: formatWallClockTime(absoluteMs),
    timeSec: clampedOffsetSec,
  };
}
