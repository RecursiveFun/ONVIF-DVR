/**
 * Light/dark theme toggle synced to localStorage and the document root.
 * Initial theme is read before React mounts to avoid a flash of wrong colors.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'onvif-dvr-theme';

export function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const initialTheme = getInitialTheme();
document.documentElement.dataset.theme = initialTheme;

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setTheme];
}
