import { describe, expect, it } from 'vitest';
import { statusColor, statusLabel } from './cameraStatus.js';

describe('statusLabel', () => {
  it('capitalizes known camera statuses', () => {
    expect(statusLabel('live')).toBe('Live');
    expect(statusLabel('recording')).toBe('Recording');
    expect(statusLabel('idle')).toBe('Idle');
  });

  it('returns an empty string for missing status', () => {
    expect(statusLabel(null)).toBe('');
    expect(statusLabel('')).toBe('');
  });
});

describe('statusColor', () => {
  it('maps statuses to chip colors', () => {
    expect(statusColor('live')).toBe('success');
    expect(statusColor('recording')).toBe('error');
    expect(statusColor('idle')).toBe('default');
  });
});
