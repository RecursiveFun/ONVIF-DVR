export function segmentTime(seg) {
  return new Date(seg.startLocal || seg.mtime).getTime();
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
