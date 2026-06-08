import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadThemeModule() {
  vi.resetModules();
  return import('./useTheme.js');
}

describe('getInitialTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('returns saved theme from localStorage', async () => {
    localStorage.setItem('onvif-dvr-theme', 'light');
    const { getInitialTheme } = await loadThemeModule();
    expect(getInitialTheme()).toBe('light');
  });

  it('ignores invalid saved values', async () => {
    localStorage.setItem('onvif-dvr-theme', 'sepia');
    window.matchMedia = vi.fn(() => ({ matches: false }));
    const { getInitialTheme } = await loadThemeModule();
    expect(getInitialTheme()).toBe('dark');
  });

  it('follows system preference when nothing is saved', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const { getInitialTheme } = await loadThemeModule();
    expect(getInitialTheme()).toBe('light');
  });
});
