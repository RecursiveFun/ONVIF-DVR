import { describe, expect, it } from 'vitest';
import {
  clampSegmentDurationSec,
  formatSegmentDurationLabel,
  segmentDurationMinutes,
} from './segmentDuration.js';

describe('segmentDuration utils', () => {
  it('clamps segment duration to allowed bounds', () => {
    expect(clampSegmentDurationSec(30)).toBe(60);
    expect(clampSegmentDurationSec(300)).toBe(300);
    expect(clampSegmentDurationSec(9999)).toBe(3600);
    expect(clampSegmentDurationSec('bad')).toBe(300);
  });

  it('converts seconds to minutes', () => {
    expect(segmentDurationMinutes(300)).toBe(5);
    expect(segmentDurationMinutes(90)).toBe(1.5);
  });

  it('formats human-readable labels', () => {
    expect(formatSegmentDurationLabel(60)).toBe('1 minute');
    expect(formatSegmentDurationLabel(300)).toBe('5 minutes');
    expect(formatSegmentDurationLabel(90)).toBe('1.5 minutes');
  });
});
