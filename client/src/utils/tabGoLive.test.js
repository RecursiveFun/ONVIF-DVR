import { describe, expect, it } from 'vitest';
import { resolveGoLiveFromSegment } from './tabGoLive.js';

const cameras = [{ id: 'cam-1', name: 'C120' }];

describe('resolveGoLiveFromSegment', () => {
  it('focuses an existing camera tab for the same camera', () => {
    const tabs = [
      { id: 'cam-tab', type: 'camera', cameraId: 'cam-1', label: 'C120' },
      {
        id: 'seg-tab',
        type: 'segment',
        cameraId: 'cam-1',
        label: 'C120 · 2:30 PM',
        segment: { id: 'seg-1' },
      },
    ];

    const result = resolveGoLiveFromSegment(tabs, 'seg-tab', cameras);
    expect(result.activeTabId).toBe('cam-tab');
    expect(result.tabs).toBe(tabs);
  });

  it('converts a segment-only tab when no camera tab exists', () => {
    const tabs = [
      {
        id: 'seg-tab',
        type: 'segment',
        cameraId: 'cam-1',
        label: 'C120 · 2:30 PM',
        segment: { id: 'seg-1' },
      },
    ];

    const result = resolveGoLiveFromSegment(tabs, 'seg-tab', cameras);
    expect(result.activeTabId).toBe('seg-tab');
    expect(result.tabs[0].type).toBe('camera');
    expect(result.tabs[0].segment).toBeUndefined();
    expect(result.tabs[0].label).toBe('C120');
  });
});
