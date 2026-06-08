import { describe, expect, it } from 'vitest';
import {
  playbackScrubMarker,
  segmentBarLayout,
  segmentOffsetSecFromClientX,
  timelineRange,
} from './timeline.js';

const segment = {
  id: 'seg-1',
  startLocal: '2026-06-08T14:30:00.000Z',
  endLocal: '2026-06-08T14:35:00.000Z',
  mtime: '2026-06-08T14:30:00.000Z',
  durationSec: 300,
};

describe('timelineRange', () => {
  it('returns span from range start and end', () => {
    const range = timelineRange('2026-06-08T14:30:00.000Z', '2026-06-08T14:35:00.000Z');
    expect(range.span).toBe(5 * 60 * 1000);
  });
});

describe('segmentBarLayout', () => {
  it('positions a segment across the full timeline range', () => {
    const { startMs, span } = timelineRange('2026-06-08T14:30:00.000Z', '2026-06-08T14:35:00.000Z');
    const layout = segmentBarLayout(segment, startMs, span);
    expect(layout.left).toBe(0);
    expect(layout.width).toBe(100);
  });
});

describe('segmentOffsetSecFromClientX', () => {
  it('maps pointer position to seconds within the segment', () => {
    const { startMs, span } = timelineRange('2026-06-08T14:30:00.000Z', '2026-06-08T14:35:00.000Z');
    const track = {
      getBoundingClientRect: () => ({
        left: 0,
        width: 400,
      }),
    };

    expect(segmentOffsetSecFromClientX(200, track, segment, startMs, span)).toBe(150);
  });
});

describe('playbackScrubMarker', () => {
  it('builds marker position and label from playback offset', () => {
    const { startMs, span } = timelineRange('2026-06-08T14:30:00.000Z', '2026-06-08T14:35:00.000Z');
    const marker = playbackScrubMarker(segment, 90, startMs, span);

    expect(marker.leftPercent).toBe(30);
    expect(marker.timeSec).toBe(90);
    expect(marker.label).toBeTruthy();
  });
});
