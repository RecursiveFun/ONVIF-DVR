import { describe, expect, it } from 'vitest';
import {
  DRAG_MIME,
  isDragPayload,
  parseDragPayload,
  setCameraDragData,
  setSegmentDragData,
  setTabDragData,
} from './dragPayload.js';

function createDragEvent() {
  const store = new Map();
  return {
    dataTransfer: {
      types: [],
      setData(type, value) {
        store.set(type, value);
        if (!this.types.includes(type)) this.types.push(type);
      },
      getData(type) {
        return store.get(type) ?? '';
      },
    },
  };
}

describe('drag payload helpers', () => {
  it('writes and parses camera payload', () => {
    const e = createDragEvent();
    setCameraDragData(e, 'cam-1');
    expect(parseDragPayload(e)).toEqual({ type: 'camera', cameraId: 'cam-1' });
    expect(isDragPayload(e)).toBe(true);
  });

  it('writes and parses segment payload', () => {
    const e = createDragEvent();
    const segment = { id: 'seg-1' };
    setSegmentDragData(e, { segment, cameraId: 'cam-1', cameraName: 'C120' });
    expect(parseDragPayload(e)).toEqual({
      type: 'segment',
      segment,
      cameraId: 'cam-1',
      cameraName: 'C120',
    });
  });

  it('writes and parses tab payload', () => {
    const e = createDragEvent();
    setTabDragData(e, 'tab-1');
    expect(parseDragPayload(e)).toEqual({ type: 'tab', tabId: 'tab-1' });
    expect(e.dataTransfer.effectAllowed).toBe('copyMove');
  });

  it('returns null for invalid json', () => {
    const e = createDragEvent();
    e.dataTransfer.setData(DRAG_MIME, '{bad json');
    expect(parseDragPayload(e)).toBeNull();
  });

  it('returns null for unknown payload type', () => {
    const e = createDragEvent();
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: 'unknown' }));
    expect(parseDragPayload(e)).toBeNull();
  });
});
