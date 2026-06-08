import { describe, expect, it } from 'vitest';
import { createAppTheme } from './muiTheme.js';

describe('createAppTheme', () => {
  it('creates light and dark themes', () => {
    expect(createAppTheme('dark').palette.mode).toBe('dark');
    expect(createAppTheme('light').palette.mode).toBe('light');
    expect(createAppTheme('dark').palette.primary.main).toBe('#3b82f6');
    expect(createAppTheme('light').palette.primary.main).toBe('#2563eb');
  });
});
