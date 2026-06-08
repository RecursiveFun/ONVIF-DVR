import { describe, expect, it } from 'vitest';
import { getMostRecentlyFinishedSegment } from './segments.js';

const segments = [
  {
    id: 'seg-1',
    startLocal: '2026-06-08T14:30:00.000Z',
    mtime: '2026-06-08T14:30:00.000Z',
  },
  {
    id: 'seg-2',
    startLocal: '2026-06-08T14:35:00.000Z',
    mtime: '2026-06-08T14:35:00.000Z',
  },
  {
    id: 'seg-3',
    startLocal: '2026-06-08T14:40:00.000Z',
    mtime: '2026-06-08T14:40:00.000Z',
  },
];

describe('getMostRecentlyFinishedSegment', () => {
  it('returns the newest segment when not recording', () => {
    expect(getMostRecentlyFinishedSegment(segments, false)?.id).toBe('seg-3');
  });

  it('returns the newest finished segment while recording', () => {
    expect(getMostRecentlyFinishedSegment(segments, true)?.id).toBe('seg-2');
  });

  it('returns null while recording with only an in-progress segment', () => {
    expect(getMostRecentlyFinishedSegment([segments[2]], true)).toBeNull();
  });

  it('returns null when there are no segments', () => {
    expect(getMostRecentlyFinishedSegment([], false)).toBeNull();
  });
});
