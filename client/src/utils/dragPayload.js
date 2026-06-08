export const DRAG_MIME = 'application/x-onvif-dvr';

function writePayload(e, payload) {
  const json = JSON.stringify(payload);
  e.dataTransfer.setData(DRAG_MIME, json);
  e.dataTransfer.setData('text/plain', json);
  e.dataTransfer.effectAllowed = 'copy';
}

export function setCameraDragData(e, cameraId) {
  writePayload(e, { type: 'camera', cameraId });
}

export function setSegmentDragData(e, { segment, cameraId, cameraName }) {
  writePayload(e, { type: 'segment', segment, cameraId, cameraName });
}

export function setTabDragData(e, tabId) {
  const json = JSON.stringify({ type: 'tab', tabId });
  e.dataTransfer.setData(DRAG_MIME, json);
  e.dataTransfer.setData('text/plain', json);
  e.dataTransfer.effectAllowed = 'copyMove';
}

export function parseDragPayload(e) {
  const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload?.type === 'camera' || payload?.type === 'segment' || payload?.type === 'tab') {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

export function isDragPayload(e) {
  const types = Array.from(e.dataTransfer?.types || []);
  return types.includes(DRAG_MIME) || types.includes('text/plain');
}
