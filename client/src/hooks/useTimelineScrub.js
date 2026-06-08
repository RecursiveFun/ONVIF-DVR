import { useCallback, useRef, useState } from 'react';
import { segmentOffsetSecFromClientX } from '../utils/timeline.js';

/**
 * Pointer-driven scrubbing on the timeline bar.
 *
 * While the user drags, we keep a local `dragTimeSec` so the playhead moves immediately
 * without waiting for the video element to catch up. The parent is notified on every move
 * so it can seek the player; on release (`final: true`) the parent persists the position.
 *
 * Pointer capture on the track ensures move/up events keep firing even if the cursor
 * leaves the segment bar or playhead.
 */
export function useTimelineScrub({
  enabled,
  trackRef,
  segment,
  rangeStartMs,
  rangeSpan,
  onScrubChange,
}) {
  // Tracks which pointer started the drag so we ignore stray multi-touch events.
  const activePointerRef = useRef({ isDragging: false, pointerId: null });

  // Local playhead position during drag; null when idle (fall back to playbackScrub prop).
  const [dragTimeSec, setDragTimeSec] = useState(null);

  const timeAtClientX = useCallback((clientX) => {
    return segmentOffsetSecFromClientX(
      clientX,
      trackRef.current,
      segment,
      rangeStartMs,
      rangeSpan,
    );
  }, [segment, rangeStartMs, rangeSpan, trackRef]);

  const notifyScrubChange = useCallback((timeSec, isFinal) => {
    if (!segment || !Number.isFinite(timeSec)) return;

    // Clear local preview on release; during drag the timeline reads dragTimeSec instead.
    setDragTimeSec(isFinal ? null : timeSec);
    onScrubChange?.(segment.id, timeSec, { final: isFinal });
  }, [segment, onScrubChange]);

  const beginScrub = useCallback((event) => {
    if (!enabled) return;

    event.preventDefault();
    event.stopPropagation();

    trackRef.current?.setPointerCapture?.(event.pointerId);
    activePointerRef.current = { isDragging: true, pointerId: event.pointerId };

    notifyScrubChange(timeAtClientX(event.clientX), false);
  }, [enabled, notifyScrubChange, timeAtClientX, trackRef]);

  const moveScrub = useCallback((event) => {
    const { isDragging, pointerId } = activePointerRef.current;
    if (!isDragging || pointerId !== event.pointerId) return;

    event.preventDefault();
    notifyScrubChange(timeAtClientX(event.clientX), false);
  }, [notifyScrubChange, timeAtClientX]);

  const endScrub = useCallback((event) => {
    const { isDragging, pointerId } = activePointerRef.current;
    if (!isDragging || pointerId !== event.pointerId) return;

    activePointerRef.current = { isDragging: false, pointerId: null };
    trackRef.current?.releasePointerCapture?.(event.pointerId);

    notifyScrubChange(timeAtClientX(event.clientX), true);
  }, [notifyScrubChange, timeAtClientX, trackRef]);

  const isDragging = useCallback(() => activePointerRef.current.isDragging, []);

  return {
    beginScrub,
    moveScrub,
    endScrub,
    dragTimeSec,
    isDragging,
  };
}
