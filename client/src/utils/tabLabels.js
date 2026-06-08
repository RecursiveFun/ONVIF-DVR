function getNameSlot(label) {
  const namePart = String(label).split(' · ')[0];
  const numbered = namePart.match(/^(.+?) \((\d+)\)$/);
  if (numbered) {
    return { base: numbered[1], slot: Number(numbered[2]) };
  }
  return { base: namePart, slot: 1 };
}

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
  const id = crypto.randomUUID();
  return {
    id,
    type: 'camera',
    cameraId: camera.id,
    label: labelCameraTab(camera, tabs, id),
  };
}

export function createSegmentTab(cameraId, cameraName, segment, tabs) {
  const id = crypto.randomUUID();
  return {
    id,
    type: 'segment',
    cameraId,
    segment,
    label: labelSegmentTab(cameraName, segment, tabs, id),
  };
}
