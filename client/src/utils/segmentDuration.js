/**
 * Segment roll length — how often FFmpeg starts a new recording file.
 * Configurable from 1 minute to 1 hour; default is 5 minutes.
 */

export const SEGMENT_DURATION_MIN_SEC = 60;
export const SEGMENT_DURATION_MAX_SEC = 3600;
export const DEFAULT_SEGMENT_DURATION_SEC = 300;

export function clampSegmentDurationSec(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_SEGMENT_DURATION_SEC;
  return Math.min(
    SEGMENT_DURATION_MAX_SEC,
    Math.max(SEGMENT_DURATION_MIN_SEC, rounded),
  );
}

export function segmentDurationMinutes(seconds) {
  return clampSegmentDurationSec(seconds) / 60;
}

export function formatSegmentDurationLabel(seconds) {
  const sec = clampSegmentDurationSec(seconds);
  if (sec < 60) return `${sec} seconds`;
  const mins = sec / 60;
  if (mins === 1) return '1 minute';
  if (Number.isInteger(mins)) return `${mins} minutes`;
  return `${mins.toFixed(1)} minutes`;
}
