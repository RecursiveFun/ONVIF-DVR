import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW_MODE,
  normalizeViewMode,
  VIEW_MODE_MULTIVIEW,
  VIEW_MODE_TABS,
} from './viewMode.js';

describe('viewMode', () => {
  it('normalizes unknown values to tabs', () => {
    expect(normalizeViewMode(VIEW_MODE_TABS)).toBe(VIEW_MODE_TABS);
    expect(normalizeViewMode(VIEW_MODE_MULTIVIEW)).toBe(VIEW_MODE_MULTIVIEW);
    expect(normalizeViewMode('invalid')).toBe(DEFAULT_VIEW_MODE);
  });
});
