import { describe, expect, it } from 'vitest';
import { clampRetentionDays, formatRetentionLabel } from './retention.js';

describe('retention utils', () => {
  it('clamps retention days', () => {
    expect(clampRetentionDays(-1)).toBe(0);
    expect(clampRetentionDays(7)).toBe(7);
    expect(clampRetentionDays(999)).toBe(365);
    expect(clampRetentionDays('bad')).toBe(7);
  });

  it('formats retention labels', () => {
    expect(formatRetentionLabel(0)).toBe('never (manual cleanup only)');
    expect(formatRetentionLabel(1)).toBe('1 day');
    expect(formatRetentionLabel(14)).toBe('14 days');
  });
});
