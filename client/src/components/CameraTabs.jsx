import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import CameraPreview from './CameraPreview.jsx';
import SegmentPreview from './SegmentPreview.jsx';
import DragHandle from './DragHandle.jsx';
import { parseDragPayload, setTabDragData } from '../utils/dragPayload.js';

function getInsertIndex(bar, clientX, clientY) {
  const tabEls = Array.from(bar.querySelectorAll('.camera-tab'));
  if (tabEls.length === 0) return 0;

  for (let i = 0; i < tabEls.length; i += 1) {
    const rect = tabEls[i].getBoundingClientRect();
    const onRow = clientY >= rect.top - 10 && clientY <= rect.bottom + 10;
    if (!onRow) continue;
    const midpoint = rect.left + rect.width / 2;
    if (clientX < midpoint) return i;
  }

  return tabEls.length;
}

function getIndicatorLeft(bar, insertIndex) {
  const barRect = bar.getBoundingClientRect();
  const tabEls = Array.from(bar.querySelectorAll('.camera-tab'));
  if (tabEls.length === 0) return 0;

  if (insertIndex <= 0) {
    return tabEls[0].getBoundingClientRect().left - barRect.left;
  }

  if (insertIndex >= tabEls.length) {
    const last = tabEls[tabEls.length - 1].getBoundingClientRect();
    return last.right - barRect.left;
  }

  return tabEls[insertIndex].getBoundingClientRect().left - barRect.left;
}

export default function CameraTabs({
  tabs,
  cameras,
  activeTabId,
  playbackThumbTimes = {},
  dragging,
  onSelectTab,
  onCloseTab,
  onTabBarDrop,
  onDragStart,
  onDragEnd,
}) {
  const barRef = useRef(null);
  const dragTabIdRef = useRef(null);
  const insertIndexRef = useRef(null);
  const [dragTabId, setDragTabId] = useState(null);
  const [insertIndex, setInsertIndex] = useState(null);
  const [indicatorLeft, setIndicatorLeft] = useState(0);

  const isTabDrag = Boolean(dragTabId);
  const showExternalDrop = dragging && !isTabDrag;
  const showInsertIndicator = insertIndex != null && (isTabDrag || dragging);

  const cameraById = (id) => cameras.find((c) => c.id === id);

  const updateInsertIndex = useCallback((index) => {
    const bar = barRef.current;
    if (!bar || index == null) {
      insertIndexRef.current = null;
      setInsertIndex(null);
      return;
    }
    insertIndexRef.current = index;
    setInsertIndex(index);
    setIndicatorLeft(getIndicatorLeft(bar, index));
  }, []);

  const handleTabDragStart = (tab, e) => {
    setTabDragData(e, tab.id);
    dragTabIdRef.current = tab.id;
    setDragTabId(tab.id);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    dragTabIdRef.current = null;
    insertIndexRef.current = null;
    setDragTabId(null);
    setInsertIndex(null);
    onDragEnd?.();
  };

  const handleBarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = barRef.current;
    if (!bar) return;

    const index = getInsertIndex(bar, e.clientX, e.clientY);
    updateInsertIndex(index);
    e.dataTransfer.dropEffect = dragTabIdRef.current ? 'move' : 'copy';
  };

  const handleBarDragLeave = (e) => {
    if (!barRef.current?.contains(e.relatedTarget)) {
      updateInsertIndex(null);
    }
  };

  const commitDrop = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = parseDragPayload(e);
    updateInsertIndex(null);
    if (payload) {
      onTabBarDrop(payload, index ?? insertIndexRef.current ?? tabs.length);
    }
  };

  const handleBarDrop = (e) => {
    commitDrop(e, insertIndexRef.current ?? tabs.length);
  };

  const handleEndDrop = (e) => {
    commitDrop(e, tabs.length);
  };

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !activeTabId) return;
    const activeEl = bar.querySelector('.camera-tab.active');
    activeEl?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [activeTabId, tabs]);

  if (tabs.length === 0 && !dragging) return null;

  return (
    <nav
      ref={barRef}
      className={`camera-tabs${showInsertIndicator ? ' dragging-active' : ''}`}
      aria-label="Camera pages"
      onDragOver={handleBarDragOver}
      onDragLeave={handleBarDragLeave}
      onDrop={handleBarDrop}
    >
      {showInsertIndicator && (
        <div
          className="camera-tab-insert-indicator"
          style={{ left: `${indicatorLeft}px` }}
          aria-hidden="true"
        />
      )}

      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const cam = cameraById(tab.cameraId);
        const recording = cam?.recording;
        return (
          <div
            key={tab.id}
            className={`camera-tab${active ? ' active' : ''}${dragTabId === tab.id ? ' dragging' : ''}`}
            onDragOver={handleBarDragOver}
            onDrop={handleBarDrop}
          >
            <DragHandle
              label={`Drag ${tab.label} to reorder`}
              onDragStart={(e) => handleTabDragStart(tab, e)}
              onDragEnd={handleDragEnd}
            />
            <button
              type="button"
              className="camera-tab-select"
              onClick={() => onSelectTab(tab.id)}
              aria-current={active ? 'page' : undefined}
            >
              {tab.type === 'segment' && tab.segment?.id ? (
                <SegmentPreview
                  segmentId={tab.segment.id}
                  time={playbackThumbTimes[tab.segment.id] ?? 0}
                  size="sm"
                />
              ) : cam ? (
                <CameraPreview
                  cameraId={cam.id}
                  streaming={cam.status === 'live' || cam.recording}
                  size="sm"
                />
              ) : null}
              <span className="camera-tab-name">{tab.label}</span>
              {recording && tab.type === 'camera' && (
                <span className="camera-tab-rec" aria-label="Recording">●</span>
              )}
            </button>
            <IconButton
              className="camera-tab-close"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              aria-label={`Close tab ${tab.label}`}
              title="Close tab"
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </div>
        );
      })}

      {showExternalDrop && (
        <div
          className={`camera-tab-drop-zone end${insertIndex === tabs.length ? ' active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            updateInsertIndex(tabs.length);
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleEndDrop}
        >
          <span className="camera-tab-drop-label">+ Drop for new tab</span>
        </div>
      )}

      {isTabDrag && tabs.length > 0 && (
        <div
          className={`camera-tab-drop-zone end tab-move${insertIndex === tabs.length ? ' active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            updateInsertIndex(tabs.length);
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={handleEndDrop}
        >
          <span className="camera-tab-drop-label">Drop to move here</span>
        </div>
      )}
    </nav>
  );
}
