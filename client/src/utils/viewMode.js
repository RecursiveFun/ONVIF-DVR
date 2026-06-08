export const VIEW_MODE_TABS = 'tabs';
export const VIEW_MODE_MULTIVIEW = 'multiview';
export const DEFAULT_VIEW_MODE = VIEW_MODE_TABS;
export const STORAGE_KEY = 'onvif-dvr-view-mode';

export function normalizeViewMode(value) {
  return value === VIEW_MODE_MULTIVIEW ? VIEW_MODE_MULTIVIEW : VIEW_MODE_TABS;
}

export function loadViewMode() {
  try {
    return normalizeViewMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function saveViewMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeViewMode(mode));
  } catch {
    // ignore quota / private mode errors
  }
}
