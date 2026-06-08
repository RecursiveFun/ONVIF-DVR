import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import CameraSetup from './components/CameraSetup.jsx';
import CameraList from './components/CameraList.jsx';
import CameraTabs from './components/CameraTabs.jsx';
import CameraPageView from './components/CameraPageView.jsx';
import MultiviewGrid from './components/MultiviewGrid.jsx';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AppThemeProvider from './components/AppThemeProvider.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ViewModeToggle from './components/ViewModeToggle.jsx';
import SidebarToggle from './components/SidebarToggle.jsx';
import AppSettings from './components/AppSettings.jsx';
import StorageBanner from './components/StorageBanner.jsx';
import { useTheme } from './hooks/useTheme.js';
import { createCameraTab, createSegmentTab, labelCameraTab } from './utils/tabLabels.js';
import { loadTabSession, restoreTabs, saveTabSession } from './utils/tabSession.js';
import { pickRecentTab, pruneTabHistory } from './utils/tabHistory.js';
import { resolveGoLiveFromSegment } from './utils/tabGoLive.js';
import {
  loadMultiviewIds,
  normalizeMultiviewIds,
  saveMultiviewIds,
  removeMultiviewId,
  toggleMultiviewId,
} from './utils/multiviewSelection.js';
import { DEFAULT_RETENTION_DAYS } from './utils/retention.js';
import { DEFAULT_SEGMENT_DURATION_SEC } from './utils/segmentDuration.js';
import {
  loadViewMode,
  saveViewMode,
  VIEW_MODE_MULTIVIEW,
  VIEW_MODE_TABS,
} from './utils/viewMode.js';
import './App.css';

export default function App() {
  const [cameras, setCameras] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [removeTargetId, setRemoveTargetId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useTheme();
  const [segmentDurationSec, setSegmentDurationSec] = useState(DEFAULT_SEGMENT_DURATION_SEC);
  const [recordingsDir, setRecordingsDir] = useState('');
  const [retentionDays, setRetentionDays] = useState(DEFAULT_RETENTION_DAYS);
  const [storage, setStorage] = useState(null);
  const tabHistoryRef = useRef([]);
  const tabsInitializedRef = useRef(false);
  const playbackPositionsRef = useRef({});
  const playbackThumbTimerRef = useRef({});
  const persistSessionTimerRef = useRef(null);
  const [playbackThumbTimes, setPlaybackThumbTimes] = useState({});
  const [viewMode, setViewMode] = useState(loadViewMode);
  const [multiviewIds, setMultiviewIds] = useState([]);

  const persistTabSession = useCallback(() => {
    if (!tabsInitializedRef.current) return;
    saveTabSession({
      tabs,
      activeTabId,
      history: tabHistoryRef.current,
      playbackPositions: playbackPositionsRef.current,
    });
  }, [tabs, activeTabId]);

  const schedulePersistTabSession = useCallback(() => {
    if (persistSessionTimerRef.current) clearTimeout(persistSessionTimerRef.current);
    persistSessionTimerRef.current = setTimeout(() => {
      persistSessionTimerRef.current = null;
      persistTabSession();
    }, 400);
  }, [persistTabSession]);

  const scheduleThumbTimeUpdate = useCallback((segmentId, time) => {
    const timers = playbackThumbTimerRef.current;
    if (timers[segmentId]) clearTimeout(timers[segmentId]);
    timers[segmentId] = setTimeout(() => {
      delete timers[segmentId];
      setPlaybackThumbTimes((prev) => {
        if (prev[segmentId] === time) return prev;
        return { ...prev, [segmentId]: time };
      });
    }, 500);
  }, []);

  const savePlaybackPosition = useCallback((segmentId, time) => {
    if (!segmentId || !Number.isFinite(time) || time < 0) return;
    playbackPositionsRef.current[segmentId] = time;
    schedulePersistTabSession();
    scheduleThumbTimeUpdate(segmentId, time);
  }, [schedulePersistTabSession, scheduleThumbTimeUpdate]);

  const getPlaybackPosition = useCallback((segmentId) => {
    if (!segmentId) return 0;
    return playbackPositionsRef.current[segmentId] ?? 0;
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  const activeCamera = activeTab
    ? cameras.find((c) => c.id === activeTab.cameraId) || null
    : null;
  const removeTarget = cameras.find((c) => c.id === removeTargetId) || null;

  const refreshCameras = useCallback(async () => {
    const list = await api.listCameras();
    setCameras(list);
    setTabs((prev) => prev.filter((tab) => list.some((c) => c.id === tab.cameraId)));
    setMultiviewIds((prev) => normalizeMultiviewIds(prev, list.map((cam) => cam.id)));
  }, []);

  useEffect(() => {
    refreshCameras().catch(() => {});
  }, [refreshCameras]);

  useEffect(() => {
    saveViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (multiviewIds.length > 0) {
      saveMultiviewIds(multiviewIds);
    }
  }, [multiviewIds]);

  useEffect(() => {
    if (cameras.length === 0) {
      setMultiviewIds([]);
      return;
    }
    setMultiviewIds((prev) => {
      const normalized = normalizeMultiviewIds(
        prev.length > 0 ? prev : loadMultiviewIds(cameras.map((cam) => cam.id)),
        cameras.map((cam) => cam.id),
      );
      return normalized.length > 0 ? normalized : cameras.map((cam) => cam.id);
    });
  }, [cameras]);

  useEffect(() => {
    api.getSettings()
      .then((settings) => {
        if (settings?.segmentDurationSec) {
          setSegmentDurationSec(settings.segmentDurationSec);
        }
        if (settings?.recordingsDir) {
          setRecordingsDir(settings.recordingsDir);
        }
        if (settings?.retentionDays !== undefined) {
          setRetentionDays(settings.retentionDays);
        }
      })
      .catch(() => {});
  }, []);

  const refreshStorage = useCallback(() => {
    api.getStorage()
      .then(setStorage)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshStorage();
    const timer = setInterval(refreshStorage, 60_000);
    return () => clearInterval(timer);
  }, [refreshStorage]);

  const handleSegmentDurationChange = useCallback(async (seconds) => {
    const updated = await api.updateSettings({ segmentDurationSec: seconds });
    setSegmentDurationSec(updated.segmentDurationSec);
    await refreshCameras();
  }, [refreshCameras]);

  const handleRecordingsDirChange = useCallback(async (dir) => {
    const updated = await api.updateSettings({ recordingsDir: dir });
    setRecordingsDir(updated.recordingsDir);
    refreshStorage();
    await refreshCameras();
  }, [refreshCameras, refreshStorage]);

  const handleRetentionDaysChange = useCallback(async (days) => {
    const updated = await api.updateSettings({ retentionDays: days });
    setRetentionDays(updated.retentionDays);
  }, []);

  useEffect(() => {
    const saved = loadTabSession();
    if (saved?.playbackPositions) {
      playbackPositionsRef.current = { ...saved.playbackPositions };
      setPlaybackThumbTimes({ ...saved.playbackPositions });
    }
  }, []);

  useEffect(() => {
    if (cameras.length === 0) {
      setTabs([]);
      setActiveTabId(null);
      tabHistoryRef.current = [];
      tabsInitializedRef.current = false;
      return;
    }

    if (tabsInitializedRef.current) return;

    const saved = loadTabSession();
    const restored = saved ? restoreTabs(saved, cameras) : null;

    if (restored) {
      tabsInitializedRef.current = true;
      tabHistoryRef.current = restored.history;
      playbackPositionsRef.current = { ...restored.playbackPositions };
      setPlaybackThumbTimes({ ...restored.playbackPositions });
      setTabs(restored.tabs);
      setActiveTabId(restored.activeTabId);
      return;
    }

    tabsInitializedRef.current = true;
    const initial = cameras.reduce((acc, cam) => {
      acc.push(createCameraTab(cam, acc));
      return acc;
    }, []);
    setTabs(initial);
    setActiveTabId(initial[0]?.id || null);
  }, [cameras]);

  useEffect(() => {
    persistTabSession();
  }, [persistTabSession]);

  useEffect(() => {
    if (!activeTabId) return;
    if (!tabs.some((tab) => tab.id === activeTabId)) return;
    tabHistoryRef.current = [
      activeTabId,
      ...tabHistoryRef.current.filter((id) => id !== activeTabId),
    ];
    persistTabSession();
  }, [activeTabId, tabs, persistTabSession]);

  useEffect(() => {
    if (activeTabId && tabs.some((t) => t.id === activeTabId)) return;
    const staleId = activeTabId;
    tabHistoryRef.current = pruneTabHistory(
      tabHistoryRef.current,
      staleId ? [staleId] : [],
    );
    setActiveTabId(pickRecentTab(tabHistoryRef.current, tabs, staleId ? [staleId] : []));
  }, [tabs, activeTabId]);

  const handleAdded = (cam) => {
    setCameras((prev) => [...prev, cam]);
    setMultiviewIds((prev) => (prev.includes(cam.id) ? prev : [...prev, cam.id]));
    setTabs((prev) => {
      const tab = createCameraTab(cam, prev);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  };

  const handleRemoved = (id) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    setTabs((prev) => {
      const removedIds = prev.filter((t) => t.cameraId === id).map((t) => t.id);
      const remaining = prev.filter((t) => t.cameraId !== id);
      tabHistoryRef.current = pruneTabHistory(tabHistoryRef.current, removedIds);
      setActiveTabId((current) => {
        if (current && remaining.some((t) => t.id === current)) return current;
        return pickRecentTab(tabHistoryRef.current, remaining, removedIds);
      });
      return remaining;
    });
  };

  const removeCamera = async (id) => {
    setRemoving(true);
    try {
      await api.deleteCamera(id);
      handleRemoved(id);
      setRemoveTargetId(null);
    } catch (err) {
      alert(err.message || 'Failed to remove camera');
    } finally {
      setRemoving(false);
    }
  };

  const requestRemoveCamera = (id) => setRemoveTargetId(id);
  const cancelRemoveCamera = () => {
    if (!removing) setRemoveTargetId(null);
  };
  const confirmRemoveCamera = async () => {
    if (!removeTargetId || removing) return;
    await removeCamera(removeTargetId);
  };

  const focusCameraTab = useCallback((cameraId) => {
    const existing = tabs.find((t) => t.type === 'camera' && t.cameraId === cameraId);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const cam = cameras.find((c) => c.id === cameraId);
    if (!cam) return;
    setTabs((prev) => {
      const tab = createCameraTab(cam, prev);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, [cameras, tabs]);

  const selectCamera = (cameraId) => {
    if (viewMode === VIEW_MODE_MULTIVIEW) {
      setMultiviewIds((prev) => toggleMultiviewId(prev, cameraId));
      return;
    }
    focusCameraTab(cameraId);
  };

  const removeFromMultiview = useCallback((cameraId) => {
    setMultiviewIds((prev) => removeMultiviewId(prev, cameraId));
  }, []);

  const openCameraFromMultiview = useCallback((cameraId) => {
    setViewMode(VIEW_MODE_TABS);
    focusCameraTab(cameraId);
  }, [focusCameraTab]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const closeTab = (tabId) => {
    tabHistoryRef.current = pruneTabHistory(tabHistoryRef.current, [tabId]);
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      setActiveTabId((current) => {
        if (current !== tabId) return current;
        return pickRecentTab(tabHistoryRef.current, remaining, [tabId]);
      });
      return remaining;
    });
  };

  const startDrag = () => setDragging(true);
  const endDrag = () => setDragging(false);

  const openSegmentInNewTab = useCallback((segment, cameraId, cameraName) => {
    let tabIdToFocus = null;

    setTabs((prev) => {
      const existing = prev.find(
        (tab) => tab.type === 'segment' && tab.segment?.id === segment.id,
      );
      if (existing) {
        tabIdToFocus = existing.id;
        return prev;
      }
      const tab = createSegmentTab(cameraId, cameraName || 'Recording', segment, prev);
      tabIdToFocus = tab.id;
      return [...prev, tab];
    });

    if (tabIdToFocus) {
      setActiveTabId(tabIdToFocus);
    }
  }, []);

  const handleSegmentDeleted = useCallback((segment) => {
    const segmentId = segment.id;
    delete playbackPositionsRef.current[segmentId];
    setPlaybackThumbTimes((prev) => {
      if (!(segmentId in prev)) return prev;
      const next = { ...prev };
      delete next[segmentId];
      return next;
    });

    setTabs((prev) => {
      const removedIds = prev
        .filter((tab) => tab.type === 'segment' && tab.segment?.id === segmentId)
        .map((tab) => tab.id);
      if (removedIds.length === 0) return prev;

      const remaining = prev.filter(
        (tab) => !(tab.type === 'segment' && tab.segment?.id === segmentId),
      );
      tabHistoryRef.current = pruneTabHistory(tabHistoryRef.current, removedIds);
      setActiveTabId((current) => {
        if (current && remaining.some((tab) => tab.id === current)) return current;
        return pickRecentTab(tabHistoryRef.current, remaining, removedIds);
      });
      return remaining;
    });
  }, []);

  const handleSegmentMetadataUpdate = useCallback((tabId, segment) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== tabId || tab.type !== 'segment') return tab;
      if (tab.segment?.id !== segment.id) return tab;
      return { ...tab, segment };
    }));
  }, []);

  const handleTabGoLive = useCallback((tabId) => {
    let focusTabId = null;

    setTabs((prev) => {
      const result = resolveGoLiveFromSegment(prev, tabId, cameras);
      if (result.activeTabId && result.tabs === prev) {
        focusTabId = result.activeTabId;
      }
      return result.tabs;
    });

    if (focusTabId) {
      setActiveTabId(focusTabId);
    }
  }, [cameras]);

  const handleTabBarDrop = useCallback((payload, toIndex) => {
    setDragging(false);

    if (payload.type === 'tab') {
      setTabs((prev) => {
        const from = prev.findIndex((tab) => tab.id === payload.tabId);
        if (from === -1) return prev;
        if (toIndex === from || toIndex === from + 1) return prev;
        const item = prev[from];
        const without = prev.filter((tab) => tab.id !== payload.tabId);
        let insertAt = toIndex;
        if (from < toIndex) insertAt = toIndex - 1;
        insertAt = Math.max(0, Math.min(insertAt, without.length));
        const next = [...without];
        next.splice(insertAt, 0, item);
        return next;
      });
      setActiveTabId(payload.tabId);
      return;
    }

    if (payload.type === 'camera') {
      const camera = cameras.find((c) => c.id === payload.cameraId);
      if (!camera) return;
      setTabs((prev) => {
        const tab = createCameraTab(camera, prev);
        const next = [...prev];
        next.splice(Math.min(toIndex, next.length), 0, tab);
        setActiveTabId(tab.id);
        return next;
      });
      return;
    }

    if (payload.type === 'segment') {
      const name = payload.cameraName || 'Recording';
      setTabs((prev) => {
        const existing = prev.find(
          (tab) => tab.type === 'segment' && tab.segment?.id === payload.segment.id,
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const tab = createSegmentTab(payload.cameraId, name, payload.segment, prev);
        const next = [...prev];
        next.splice(Math.min(toIndex, next.length), 0, tab);
        setActiveTabId(tab.id);
        return next;
      });
    }
  }, [cameras]);

  return (
    <AppThemeProvider mode={theme}>
    <div className="app">
      <Box component="header" className="header">
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>ONVIF DVR</Typography>
          <Typography variant="body2" color="text.secondary">Live RTSP streaming with local-time recording</Typography>
        </Box>
      </Box>

      <StorageBanner storage={storage} />

      <main className={`layout${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        <aside className={`sidebar${sidebarOpen ? '' : ' collapsed'}`}>
          <SidebarToggle open={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)} />
          {sidebarOpen && (
            <>
              <CameraList
                cameras={cameras}
                activeId={activeTab?.cameraId || null}
                selectedIds={multiviewIds}
                multiviewMode={viewMode === VIEW_MODE_MULTIVIEW}
                onSelect={selectCamera}
                onDragStart={startDrag}
                onDragEnd={endDrag}
              />
              <CameraSetup onAdded={handleAdded} />
              <AppSettings
                theme={theme}
                onThemeChange={setTheme}
                segmentDurationSec={segmentDurationSec}
                onSegmentDurationChange={handleSegmentDurationChange}
                retentionDays={retentionDays}
                onRetentionDaysChange={handleRetentionDaysChange}
                recordingsDir={recordingsDir}
                onRecordingsDirChange={handleRecordingsDirChange}
                storage={storage}
              />
            </>
          )}
        </aside>

        <section className="main-panel">
          <div className="main-panel-toolbar">
            <ViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
            {viewMode === VIEW_MODE_TABS && (
              <CameraTabs
                tabs={tabs}
                cameras={cameras}
                activeTabId={activeTabId}
                playbackThumbTimes={playbackThumbTimes}
                dragging={dragging}
                onSelectTab={setActiveTabId}
                onCloseTab={closeTab}
                onTabBarDrop={handleTabBarDrop}
                onDragStart={startDrag}
                onDragEnd={endDrag}
              />
            )}
            {viewMode === VIEW_MODE_MULTIVIEW && (
              <Typography className="main-panel-toolbar-hint" variant="body2" color="text.secondary">
                Click cameras in the sidebar to show or hide them. Open a tile for the full camera page.
              </Typography>
            )}
          </div>

          {viewMode === VIEW_MODE_MULTIVIEW ? (
            <MultiviewGrid
              cameras={cameras}
              selectedIds={multiviewIds}
              onOpenCamera={openCameraFromMultiview}
              onRemoveCamera={removeFromMultiview}
            />
          ) : !activeTab || !activeCamera ? (
            <Box className="placeholder page-placeholder">
              <Typography>No camera page selected.</Typography>
              <Typography color="text.secondary">Add a camera or pick one from the sidebar.</Typography>
            </Box>
          ) : (
            <CameraPageView
              key={activeTab.id}
              camera={activeCamera}
              initialSegment={activeTab.type === 'segment' ? activeTab.segment : null}
              isSegmentTab={activeTab.type === 'segment'}
              tabId={activeTab.id}
              segmentDurationSec={segmentDurationSec}
              retentionDays={retentionDays}
              canRecord={storage?.canRecord !== false}
              setCameras={setCameras}
              refreshCameras={refreshCameras}
              onRequestRemove={requestRemoveCamera}
              onSegmentDeleted={handleSegmentDeleted}
              onSegmentMetadataUpdate={handleSegmentMetadataUpdate}
              onOpenSegmentTab={(seg) => openSegmentInNewTab(seg, activeCamera.id, activeCamera.name)}
              onTabGoLive={handleTabGoLive}
              getPlaybackPosition={getPlaybackPosition}
              onPlaybackPositionChange={savePlaybackPosition}
              onDragStart={startDrag}
              onDragEnd={endDrag}
            />
          )}
        </section>
      </main>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove camera?"
        description={`Remove "${removeTarget?.name}"? This will stop all streams and delete the camera from your list.`}
        confirmLabel="Remove"
        confirming={removing}
        onCancel={cancelRemoveCamera}
        onConfirm={confirmRemoveCamera}
      />
    </div>
    </AppThemeProvider>
  );
}
