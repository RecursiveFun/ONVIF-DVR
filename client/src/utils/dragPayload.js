/**
 * HTML5 drag-and-drop payloads for opening cameras, segments, or reordering tabs.
 * Uses a custom MIME type so we can distinguish our drags from plain text.
 */

export const DRAG_MIME = 'application/x-onvif-dvr';

function writePayload(event, payload) {
  const json = JSON.stringify(payload);
  event.dataTransfer.setData(DRAG_MIME, json);
  event.dataTransfer.setData('text/plain', json);
  event.dataTransfer.effectAllowed = 'copy';
}

export function setCameraDragData(event, cameraId) {
  writePayload(event, { type: 'camera', cameraId });
}

export function setSegmentDragData(event, { segment, cameraId, cameraName }) {
  writePayload(event, { type: 'segment', segment, cameraId, cameraName });
}

/** Tab reorder uses copyMove so the source tab can be removed after a successful drop. */
export function setTabDragData(event, tabId) {
  const json = JSON.stringify({ type: 'tab', tabId });
  event.dataTransfer.setData(DRAG_MIME, json);
  event.dataTransfer.setData('text/plain', json);
  event.dataTransfer.effectAllowed = 'copyMove';
}

export function parseDragPayload(event) {
  const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain');
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

export function isDragPayload(event) {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes(DRAG_MIME) || types.includes('text/plain');
}
