import { describe, expect, it } from 'vitest';
import { createCameraTab, labelCameraTab, labelSegmentTab } from './tabLabels.js';

describe('createCameraTab', () => {
  it('creates an id when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto?.randomUUID;
    if (globalThis.crypto) {
      globalThis.crypto.randomUUID = undefined;
    }
    try {
      const tab = createCameraTab({ id: 'cam-1', name: 'C120' }, []);
      expect(tab.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    } finally {
      if (globalThis.crypto && original) {
        globalThis.crypto.randomUUID = original;
      }
    }
  });
});

describe('labelCameraTab', () => {
  it('returns base name when no duplicate exists', () => {
    const label = labelCameraTab({ name: 'C120' }, [], 'new-id');
    expect(label).toBe('C120');
  });

  it('returns numbered name when base is taken', () => {
    const tabs = [{ id: 'a', label: 'C120' }];
    expect(labelCameraTab({ name: 'C120' }, tabs, 'b')).toBe('C120 (2)');
  });

  it('fills gaps in numbered slots', () => {
    const tabs = [
      { id: 'a', label: 'C120' },
      { id: 'b', label: 'C120 (3)' },
    ];
    expect(labelCameraTab({ name: 'C120' }, tabs, 'c')).toBe('C120 (2)');
  });

  it('ignores segment tab labels when counting slots', () => {
    const tabs = [
      { id: 'a', label: 'C120' },
      { id: 'b', label: 'C120 · Jun 8, 2026, 2:30:00 PM' },
    ];
    expect(labelCameraTab({ name: 'C120' }, tabs, 'c')).toBe('C120 (2)');
  });

  it('excludes the tab being labeled from slot counting', () => {
    const tabs = [{ id: 'self', label: 'C120 (2)' }];
    expect(labelCameraTab({ name: 'C120' }, tabs, 'self')).toBe('C120');
  });
});

describe('labelSegmentTab', () => {
  it('combines camera label with segment timestamp', () => {
    const segment = { id: 'seg-1', startLocalDisplay: 'Jun 8, 2026, 2:30:00 PM' };
    const label = labelSegmentTab('C120', segment, [], 'new-id');
    expect(label).toBe('C120 · Jun 8, 2026, 2:30:00 PM');
  });

  it('uses numbered camera label when duplicates exist', () => {
    const tabs = [{ id: 'a', label: 'C120' }];
    const segment = { id: 'seg-1', startLocalDisplay: '2:30 PM' };
    expect(labelSegmentTab('C120', segment, tabs, 'b')).toBe('C120 (2) · 2:30 PM');
  });

  it('falls back to Segment when display time is missing', () => {
    const label = labelSegmentTab('C120', { id: 'seg-1' }, [], 'new-id');
    expect(label).toBe('C120 · Segment');
  });
});
