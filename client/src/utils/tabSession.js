/**
 * Persist open tabs, active tab, history, and per-segment playback positions.
 * Restored on load so a browser refresh returns to the same workspace.
 */

const STORAGE_KEY = 'onvif-dvr-tabs';

export function loadTabSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.tabs)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveTabSession({ tabs, activeTabId, history, playbackPositions }) {
  try {
    const payload = {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        type: tab.type,
        cameraId: tab.cameraId,
        label: tab.label,
        segment: tab.type === 'segment' ? tab.segment : undefined,
      })),
      activeTabId: activeTabId ?? null,
      history: Array.isArray(history) ? history : [],
      playbackPositions: playbackPositions && typeof playbackPositions === 'object'
        ? playbackPositions
        : {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode errors
  }
}

/**
 * Reconcile saved tabs with cameras that still exist on the server.
 * Drops tabs for removed cameras; keeps segment metadata for playback resume.
 */
export function restoreTabs(saved, cameras) {
  if (!saved?.tabs) return null;

  const cameraIds = new Set(cameras.map((cam) => cam.id));
  const restored = saved.tabs
    .filter((tab) => cameraIds.has(tab.cameraId))
    .map((tab) => {
      if (tab.type === 'segment' && tab.segment?.id) {
        return {
          id: tab.id,
          type: 'segment',
          cameraId: tab.cameraId,
          label: tab.label,
          segment: tab.segment,
        };
      }
      return {
        id: tab.id,
        type: 'camera',
        cameraId: tab.cameraId,
        label: tab.label,
      };
    });

  if (restored.length === 0) {
    const playbackPositions = saved.playbackPositions && typeof saved.playbackPositions === 'object'
      ? saved.playbackPositions
      : {};
    return { tabs: [], activeTabId: null, history: [], playbackPositions };
  }

  const restoredIds = new Set(restored.map((tab) => tab.id));
  const activeTabId = restoredIds.has(saved.activeTabId)
    ? saved.activeTabId
    : restored[restored.length - 1].id;
  const history = (saved.history || []).filter((id) => restoredIds.has(id));
  const playbackPositions = saved.playbackPositions && typeof saved.playbackPositions === 'object'
    ? saved.playbackPositions
    : {};

  return { tabs: restored, activeTabId, history, playbackPositions };
}
