import { describe, expect, it } from 'vitest';
import { api, formatBytes, formatDuration, formatLocalTime } from './api.js';

describe('api url helpers', () => {
  it('builds recording and live urls', () => {
    expect(api.recordingUrl('cam-1/2026-06-08_14-30-00.mp4'))
      .toBe('/api/recordings/cam-1/2026-06-08_14-30-00.mp4');
    expect(api.liveUrl('cam-1')).toBe('/live/cam-1/index.m3u8');
  });
});

describe('formatLocalTime', () => {
  it('returns em dash for empty input', () => {
    expect(formatLocalTime(null)).toBe('—');
    expect(formatLocalTime('')).toBe('—');
  });

  it('formats a valid iso timestamp', () => {
    const formatted = formatLocalTime('2026-06-08T14:30:00.000Z');
    expect(formatted).toBeTruthy();
    expect(formatted).not.toBe('—');
  });
});

describe('formatBytes', () => {
  it('formats storage sizes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats hour-long durations', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});
