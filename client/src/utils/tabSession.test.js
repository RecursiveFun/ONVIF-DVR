import { beforeEach, describe, expect, it } from 'vitest';
import { loadTabSession, restoreTabs, saveTabSession } from './tabSession.js';

const STORAGE_KEY = 'onvif-dvr-tabs';

beforeEach(() => {
  localStorage.clear();
});

describe('saveTabSession / loadTabSession', () => {
  it('round-trips tabs, active tab, history, and playback positions', () => {
    const tabs = [
      { id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' },
      {
        id: 't2',
        type: 'segment',
        cameraId: 'cam-1',
        label: 'C120 · 2:30 PM',
        segment: { id: 'seg-1', startLocalDisplay: '2:30 PM' },
      },
    ];

    saveTabSession({
      tabs,
      activeTabId: 't2',
      history: ['t2', 't1'],
      playbackPositions: { 'seg-1': 42.5 },
    });

    const loaded = loadTabSession();
    expect(loaded.activeTabId).toBe('t2');
    expect(loaded.history).toEqual(['t2', 't1']);
    expect(loaded.playbackPositions).toEqual({ 'seg-1': 42.5 });
    expect(loaded.tabs).toHaveLength(2);
    expect(loaded.tabs[1].segment.id).toBe('seg-1');
  });

  it('omits segment data from camera tabs', () => {
    saveTabSession({
      tabs: [{ id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' }],
      activeTabId: 't1',
      history: [],
      playbackPositions: {},
    });

    const loaded = loadTabSession();
    expect(loaded.tabs[0].segment).toBeUndefined();
  });

  it('returns null for missing or invalid storage', () => {
    expect(loadTabSession()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '{"tabs":"not-an-array"}');
    expect(loadTabSession()).toBeNull();
  });
});

describe('restoreTabs', () => {
  const cameras = [{ id: 'cam-1', name: 'C120' }];

  it('filters tabs for cameras that still exist', () => {
    const saved = {
      tabs: [
        { id: 't1', type: 'camera', cameraId: 'cam-1', label: 'C120' },
        { id: 't2', type: 'camera', cameraId: 'gone', label: 'Old' },
      ],
      activeTabId: 't2',
      history: ['t2', 't1'],
      playbackPositions: { 'seg-1': 10 },
    };

    const restored = restoreTabs(saved, cameras);
    expect(restored.tabs).toHaveLength(1);
    expect(restored.tabs[0].id).toBe('t1');
    expect(restored.activeTabId).toBe('t1');
    expect(restored.history).toEqual(['t1']);
    expect(restored.playbackPositions).toEqual({ 'seg-1': 10 });
  });

  it('restores segment tabs with segment metadata', () => {
    const segment = { id: 'seg-1', startLocalDisplay: '2:30 PM' };
    const saved = {
      tabs: [{ id: 't1', type: 'segment', cameraId: 'cam-1', label: 'C120 · 2:30 PM', segment }],
      activeTabId: 't1',
      history: ['t1'],
      playbackPositions: {},
    };

    const restored = restoreTabs(saved, cameras);
    expect(restored.tabs[0]).toMatchObject({ type: 'segment', segment });
  });

  it('returns empty state with playback positions when no tabs survive', () => {
    const saved = {
      tabs: [{ id: 't1', type: 'camera', cameraId: 'gone', label: 'Old' }],
      activeTabId: 't1',
      history: ['t1'],
      playbackPositions: { 'seg-1': 5 },
    };

    const restored = restoreTabs(saved, cameras);
    expect(restored).toEqual({
      tabs: [],
      activeTabId: null,
      history: [],
      playbackPositions: { 'seg-1': 5 },
    });
  });
});
