import { describe, expect, it } from 'vitest';
import { seekableEnd, usableDuration } from './playback.js';

describe('usableDuration', () => {
  it('returns positive finite values', () => {
    expect(usableDuration(120)).toBe(120);
    expect(usableDuration(0.5)).toBe(0.5);
  });

  it('returns 0 for invalid values', () => {
    expect(usableDuration(0)).toBe(0);
    expect(usableDuration(-1)).toBe(0);
    expect(usableDuration(NaN)).toBe(0);
    expect(usableDuration(Infinity)).toBe(0);
    expect(usableDuration(undefined)).toBe(0);
  });
});

describe('seekableEnd', () => {
  it('returns end of last seekable range', () => {
    const video = {
      seekable: {
        length: 2,
        end(index) {
          return index === 0 ? 50 : 120;
        },
      },
    };
    expect(seekableEnd(video)).toBe(120);
  });

  it('returns 0 when seekable range is missing', () => {
    expect(seekableEnd(null)).toBe(0);
    expect(seekableEnd({})).toBe(0);
    expect(seekableEnd({ seekable: { length: 0 } })).toBe(0);
  });

  it('returns 0 when seekable.end throws', () => {
    const video = {
      seekable: {
        length: 1,
        end() {
          throw new Error('seek failed');
        },
      },
    };
    expect(seekableEnd(video)).toBe(0);
  });
});
