/** Wall-clock start of a recording segment, in milliseconds. */
export function segmentTime(seg) {
  return new Date(seg.startLocal || seg.mtime).getTime();
}

/** Wall-clock end of a segment — from metadata or start + known duration. */
export function segmentEndTime(seg) {
  if (seg.endLocal) return new Date(seg.endLocal).getTime();
  return segmentTime(seg) + (seg.durationSec || 0) * 1000;
}

/** Newest completed segment; skips the in-progress file while recording. */
export function getMostRecentlyFinishedSegment(segments, recording = false) {
  if (!segments?.length) return null;

  const sorted = [...segments].sort((a, b) => segmentTime(b) - segmentTime(a));
  if (recording) {
    return sorted.length > 1 ? sorted[1] : null;
  }
  return sorted[0];
}
