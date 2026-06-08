import { labelCameraTab } from './tabLabels.js';

export function resolveGoLiveFromSegment(tabs, tabId, cameras) {
  const segmentTab = tabs.find((tab) => tab.id === tabId && tab.type === 'segment');
  if (!segmentTab) {
    return { tabs, activeTabId: null };
  }

  const existingCameraTab = tabs.find(
    (tab) => tab.type === 'camera' && tab.cameraId === segmentTab.cameraId,
  );
  if (existingCameraTab) {
    return { tabs, activeTabId: existingCameraTab.id };
  }

  const cam = cameras.find((c) => c.id === segmentTab.cameraId);
  const nextTabs = tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    if (!cam) {
      return { ...tab, type: 'camera', segment: undefined };
    }
    return {
      ...tab,
      type: 'camera',
      segment: undefined,
      label: labelCameraTab(cam, tabs, tabId),
    };
  });

  return { tabs: nextTabs, activeTabId: tabId };
}
