/**
 * Tab naming and factory helpers.
 *
 * Multiple tabs for the same camera get numbered suffixes: "Front Door (2)".
 * Segment tabs append the recording time: "Front Door · Jun 8, 2:30 PM".
 */

function createRandomId() {
  // crypto.randomUUID requires a secure context (HTTPS); fall back for LAN HTTP.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    return (char === 'x' ? rand : (rand & 0x3) | 0x8).toString(16);
  });
}

function getNameSlot(label) {
  const namePart = String(label).split(' · ')[0];
  const numbered = namePart.match(/^(.+?) \((\d+)\)$/);
  if (numbered) {
    return { base: numbered[1], slot: Number(numbered[2]) };
  }
  return { base: namePart, slot: 1 };
}

/** Pick a unique display name among open tabs for this camera. */
export function labelCameraTab(camera, tabs, excludeTabId) {
  const base = camera.name;
  const others = tabs.filter((tab) => tab.id !== excludeTabId);
  const usedSlots = new Set();

  for (const tab of others) {
    const { base: tabBase, slot } = getNameSlot(tab.label);
    if (tabBase === base) usedSlots.add(slot);
  }

  if (!usedSlots.has(1)) return base;

  let number = 2;
  while (usedSlots.has(number)) number += 1;
  return `${base} (${number})`;
}

export function labelSegmentTab(cameraName, segment, tabs, excludeTabId) {
  const timeLabel = segment.startLocalDisplay || 'Segment';
  const displayName = labelCameraTab({ name: cameraName }, tabs, excludeTabId);
  return `${displayName} · ${timeLabel}`;
}

export function createCameraTab(camera, tabs) {
  const id = createRandomId();
  return {
    id,
    type: 'camera',
    cameraId: camera.id,
    label: labelCameraTab(camera, tabs, id),
  };
}

export function createSegmentTab(cameraId, cameraName, segment, tabs) {
  const id = createRandomId();
  return {
    id,
    type: 'segment',
    cameraId,
    segment,
    label: labelSegmentTab(cameraName, segment, tabs, id),
  };
}
