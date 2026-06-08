import { describe, expect, it } from 'vitest';
import { pickRecentTab, pruneTabHistory } from './tabHistory.js';

describe('pickRecentTab', () => {
  const remaining = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];

  it('returns most recent tab from history that still exists', () => {
    expect(pickRecentTab(['b', 'a', 'c'], remaining)).toBe('b');
  });

  it('skips excluded ids', () => {
    expect(pickRecentTab(['b', 'a'], remaining, ['b'])).toBe('a');
  });

  it('falls back to first remaining tab when history is empty', () => {
    expect(pickRecentTab([], remaining)).toBe('a');
  });

  it('returns null when no tabs remain', () => {
    expect(pickRecentTab(['a'], [], ['a'])).toBeNull();
  });
});

describe('pruneTabHistory', () => {
  it('removes closed tab ids from history', () => {
    expect(pruneTabHistory(['c', 'b', 'a'], ['b'])).toEqual(['c', 'a']);
  });

  it('handles empty removal list', () => {
    expect(pruneTabHistory(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});
