/**
 * "Go Live" from a segment tab — switch back to the camera's live view.
 *
 * If a live camera tab already exists, focus it. Otherwise convert the segment
 * tab in place so the user does not accumulate duplicate tabs.
 */

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

  const camera = cameras.find((c) => c.id === segmentTab.cameraId);
  const nextTabs = tabs.map((tab) => {
    if (tab.id !== tabId) return tab;
    if (!camera) {
      return { ...tab, type: 'camera', segment: undefined };
    }
    return {
      ...tab,
      type: 'camera',
      segment: undefined,
      label: labelCameraTab(camera, tabs, tabId),
    };
  });

  return { tabs: nextTabs, activeTabId: tabId };
}
