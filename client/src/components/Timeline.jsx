import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';
import ZoomOutOutlinedIcon from '@mui/icons-material/ZoomOutOutlined';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatLocalTime } from '../api.js';
import { useTimelineScrub } from '../hooks/useTimelineScrub.js';
import { setSegmentDragData } from '../utils/dragPayload.js';
import { DEFAULT_RETENTION_DAYS, formatRetentionLabel } from '../utils/retention.js';
import { DEFAULT_SEGMENT_DURATION_SEC, formatSegmentDurationLabel } from '../utils/segmentDuration.js';
import { segmentEndTime, segmentTime } from '../utils/segments.js';
import {
  clamp,
  getVisibleTimeMs,
  playbackScrubMarker,
  segmentBarLayout,
  timelineRange,
} from '../utils/timeline.js';

function todayKey() {
  return localDayKey(new Date().toISOString());
}

function localDayKey(isoOrMtime) {
  const d = new Date(isoOrMtime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(isoOrMtime) {
  const d = new Date(isoOrMtime);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const key = localDayKey(d);
  if (key === localDayKey(today)) return 'Today';
  if (key === localDayKey(yesterday)) return 'Yesterday';

  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatStorage(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function totalBytes(segments) {
  return segments.reduce((sum, seg) => sum + (seg.sizeBytes || 0), 0);
}

function formatSegmentTime(seg) {
  const d = new Date(seg.startLocal || seg.mtime);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function sortSegments(segments, sortOrder) {
  return [...segments].sort((a, b) => {
    const ta = segmentTime(a);
    const tb = segmentTime(b);
    return sortOrder === 'newest' ? tb - ta : ta - tb;
  });
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.5;

function groupSegmentsByDay(segments, sortOrder) {
  const byDay = new Map();

  for (const seg of segments) {
    const stamp = seg.startLocal || seg.mtime;
    const key = localDayKey(stamp);
    if (!byDay.has(key)) {
      byDay.set(key, { key, stamp, segments: [] });
    }
    byDay.get(key).segments.push(seg);
  }

  const daySort = sortOrder === 'newest'
    ? (a, b) => b.key.localeCompare(a.key)
    : (a, b) => a.key.localeCompare(b.key);

  return Array.from(byDay.values())
    .sort(daySort)
    .map((group) => {
      const sorted = sortSegments(group.segments, sortOrder);
      return {
        ...group,
        label: formatDayLabel(group.stamp),
        segments: sorted,
        totalBytes: totalBytes(sorted),
      };
    });
}

/**
 * Recording timeline — day-grouped list plus a zoomable segment bar.
 *
 * Playback scrubbing (optional):
 *   playbackScrub  — { segmentId, timeSec } from the parent; drives the red playhead.
 *   onScrubChange  — called while dragging and on release; parent seeks the video player.
 *   When both are set and a segment is selected, that segment and the playhead become draggable.
 */
export default function Timeline({
  segments,
  selectedId,
  playbackScrub = null,
  onScrubChange,
  onSelect,
  rangeStart,
  rangeEnd,
  segmentDurationSec = DEFAULT_SEGMENT_DURATION_SEC,
  retentionDays = DEFAULT_RETENTION_DAYS,
  cameraId,
  cameraName,
  onDragStart,
  onDragEnd,
}) {
  const [expandedDays, setExpandedDays] = useState(() => new Set([todayKey()]));
  const [sortOrder, setSortOrder] = useState('newest');
  const [zoomLevel, setZoomLevel] = useState(MIN_ZOOM);
  const [viewportScroll, setViewportScroll] = useState({ scrollLeft: 0, width: 0 });
  const barViewportRef = useRef(null);
  const barTrackRef = useRef(null);

  const syncViewportScroll = useCallback(() => {
    const viewport = barViewportRef.current;
    if (!viewport) return;
    setViewportScroll({ scrollLeft: viewport.scrollLeft, width: viewport.clientWidth });
  }, []);

  const toggleDay = (key) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedId) return;
    const seg = segments.find((s) => s.id === selectedId);
    if (!seg) return;
    const key = localDayKey(seg.startLocal || seg.mtime);
    setExpandedDays((prev) => new Set(prev).add(key));
  }, [selectedId, segments]);

  const applyZoom = useCallback((nextZoom, anchorFraction = 0.5) => {
    const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const viewport = barViewportRef.current;

    if (!viewport || clamped === zoomLevel) {
      setZoomLevel(clamped);
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const scrollLeft = viewport.scrollLeft;
    const oldTrackWidth = viewportWidth * zoomLevel;
    const anchorPx = scrollLeft + anchorFraction * viewportWidth;
    const anchorOnTimeline = oldTrackWidth > 0 ? anchorPx / oldTrackWidth : anchorFraction;

    setZoomLevel(clamped);

    requestAnimationFrame(() => {
      const newTrackWidth = viewportWidth * clamped;
      const maxScroll = Math.max(newTrackWidth - viewportWidth, 0);
      const newAnchorPx = anchorOnTimeline * newTrackWidth;
      viewport.scrollLeft = clamp(newAnchorPx - anchorFraction * viewportWidth, 0, maxScroll);
      setViewportScroll({ scrollLeft: viewport.scrollLeft, width: viewport.clientWidth });
    });
  }, [zoomLevel]);

  const handleBarWheel = useCallback((e) => {
    const viewport = barViewportRef.current;
    if (!viewport) return;

    const panWhenZoomed = zoomLevel > MIN_ZOOM
      && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY));

    if (panWhenZoomed) {
      e.preventDefault();
      viewport.scrollLeft += e.deltaY + e.deltaX;
      return;
    }

    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const anchorFraction = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    applyZoom(zoomLevel + delta, anchorFraction);
  }, [applyZoom, zoomLevel]);

  useEffect(() => {
    const viewport = barViewportRef.current;
    if (!viewport) return undefined;

    const onWheel = (e) => handleBarWheel(e);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [handleBarWheel, segments.length]);

  const handleBarScroll = useCallback(() => {
    syncViewportScroll();
  }, [syncViewportScroll]);

  const handleBarKeyDown = useCallback((e) => {
    if (zoomLevel <= MIN_ZOOM) return;
    const viewport = barViewportRef.current;
    if (!viewport) return;

    const step = 40;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      viewport.scrollLeft -= step;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      viewport.scrollLeft += step;
    }
  }, [zoomLevel]);

  useEffect(() => {
    if (!segments?.length || !selectedId || zoomLevel <= MIN_ZOOM) return;
    const seg = segments.find((s) => s.id === selectedId);
    const viewport = barViewportRef.current;
    if (!seg || !viewport) return;

    const { startMs, span } = timelineRange(rangeStart, rangeEnd);
    const segStart = segmentTime(seg);
    const segEnd = segmentEndTime(seg);
    const leftFrac = (segStart - startMs) / span;
    const widthFrac = (segEnd - segStart) / span;
    const viewportWidth = viewport.clientWidth;
    const trackWidth = viewportWidth * zoomLevel;
    const segCenterPx = (leftFrac + widthFrac / 2) * trackWidth;
    const maxScroll = Math.max(trackWidth - viewportWidth, 0);
    viewport.scrollLeft = clamp(segCenterPx - viewportWidth / 2, 0, maxScroll);
    setViewportScroll({ scrollLeft: viewport.scrollLeft, width: viewport.clientWidth });
  }, [selectedId, segments, zoomLevel, rangeStart, rangeEnd]);

  useEffect(() => {
    const viewport = barViewportRef.current;
    if (!viewport) return undefined;

    const observer = new ResizeObserver(syncViewportScroll);
    observer.observe(viewport);
    syncViewportScroll();

    return () => observer.disconnect();
  }, [segments, syncViewportScroll]);

  // --- Timeline scale (wall-clock ms for the full bar) ---

  const { startMs: timelineStartMs, span: timelineSpan } = useMemo(
    () => timelineRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const selectedSegment = useMemo(
    () => (selectedId && segments?.length ? segments.find((s) => s.id === selectedId) : null),
    [segments, selectedId],
  );

  // Scrubbing is only active during playback when the parent wires both position and a change handler.
  const canScrubSegment = Boolean(onScrubChange && playbackScrub && selectedSegment);

  const {
    beginScrub,
    moveScrub,
    endScrub,
    dragTimeSec,
    isDragging,
  } = useTimelineScrub({
    enabled: canScrubSegment,
    trackRef: barTrackRef,
    segment: selectedSegment,
    rangeStartMs: timelineStartMs,
    rangeSpan: timelineSpan,
    onScrubChange,
  });

  const dayGroups = useMemo(
    () => (segments?.length ? groupSegmentsByDay(segments, sortOrder) : []),
    [segments, sortOrder],
  );
  const allBytes = useMemo(() => totalBytes(segments || []), [segments]);
  const segmentLayouts = useMemo(
    () => (segments || []).map((seg) => ({
      seg,
      layout: segmentBarLayout(seg, timelineStartMs, timelineSpan),
    })),
    [segments, timelineStartMs, timelineSpan],
  );
  const { startMs: visibleStartMs, endMs: visibleEndMs } = useMemo(
    () => getVisibleTimeMs(
      viewportScroll.scrollLeft,
      viewportScroll.width,
      zoomLevel,
      timelineStartMs,
      timelineSpan,
    ),
    [viewportScroll.scrollLeft, viewportScroll.width, zoomLevel, timelineStartMs, timelineSpan],
  );
  // Red playhead: prefer live drag position, otherwise follow the video's reported time.
  const scrubMarker = useMemo(() => {
    if (!selectedSegment || !playbackScrub || playbackScrub.segmentId !== selectedId) return null;

    const displayTimeSec = dragTimeSec ?? playbackScrub.timeSec ?? 0;
    return playbackScrubMarker(selectedSegment, displayTimeSec, timelineStartMs, timelineSpan);
  }, [selectedSegment, playbackScrub, selectedId, dragTimeSec, timelineStartMs, timelineSpan]);

  if (!segments?.length) {
    return (
      <div className="timeline empty">
        <Typography gutterBottom>No recordings yet. Start the camera to begin DVR capture.</Typography>
        <Typography variant="body2" color="text.secondary">
          Segments are saved every {formatSegmentDurationLabel(segmentDurationSec)}.
          {' '}
          {retentionDays === 0
            ? 'Automatic cleanup is disabled.'
            : `Recordings older than ${formatRetentionLabel(retentionDays)} are removed automatically.`}
        </Typography>
      </div>
    );
  }

  const handleSegmentDragStart = (seg, e) => {
    setSegmentDragData(e, { segment: seg, cameraId, cameraName });
    onDragStart?.();
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span>{formatLocalTime(new Date(visibleStartMs).toISOString())}</span>
        <span className="muted timeline-header-meta">
          {scrubMarker ? (
            <span className="timeline-scrub-header">Playing at {scrubMarker.label}</span>
          ) : null}
          {scrubMarker ? ' · ' : ''}
          {dayGroups.length} day{dayGroups.length !== 1 ? 's' : ''} · {segments.length} segment{segments.length !== 1 ? 's' : ''} · {formatStorage(allBytes)}
        </span>
        <span>{formatLocalTime(new Date(visibleEndMs).toISOString())}</span>
      </div>

      <div className="timeline-bar-toolbar">
        <Typography component="span" variant="caption" color="text.secondary" className="timeline-zoom-label">
          Zoom
        </Typography>
        <IconButton
          size="small"
          onClick={() => applyZoom(zoomLevel - ZOOM_STEP)}
          disabled={zoomLevel <= MIN_ZOOM}
          aria-label="Zoom out timeline"
          title="Zoom out"
        >
          <ZoomOutOutlinedIcon fontSize="small" />
        </IconButton>
        <Slider
          className="timeline-zoom-slider"
          size="small"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          value={zoomLevel}
          onChange={(_e, value) => applyZoom(value)}
          aria-label="Timeline zoom"
        />
        <Typography component="span" variant="caption" className="timeline-zoom-value" aria-live="polite">
          {zoomLevel === MIN_ZOOM ? '1×' : `${zoomLevel}×`}
        </Typography>
        <IconButton
          size="small"
          onClick={() => applyZoom(zoomLevel + ZOOM_STEP)}
          disabled={zoomLevel >= MAX_ZOOM}
          aria-label="Zoom in timeline"
          title="Zoom in"
        >
          <ZoomInOutlinedIcon fontSize="small" />
        </IconButton>
      </div>

      <div
        ref={barViewportRef}
        className={`timeline-bar-viewport${zoomLevel > MIN_ZOOM ? ' zoomed' : ''}`}
        onScroll={handleBarScroll}
        onKeyDown={handleBarKeyDown}
        tabIndex={zoomLevel > MIN_ZOOM ? 0 : -1}
        aria-label="Recording timeline segments"
        title={zoomLevel > MIN_ZOOM ? 'Wheel to zoom. Shift+wheel, horizontal scroll, or arrow keys to pan.' : 'Wheel to zoom in'}
      >
        {/* Move/up handlers live on the track so pointer capture keeps receiving events. */}
        <div
          ref={barTrackRef}
          className={`timeline-bar-track${canScrubSegment ? ' scrub-enabled' : ''}`}
          style={{ width: `${zoomLevel * 100}%` }}
          onPointerMove={moveScrub}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        >
          {segmentLayouts.map(({ seg, layout }) => {
            const selected = seg.id === selectedId;
            // Only the playing segment scrubs; others stay draggable to open a new tab.
            const scrubbable = selected && canScrubSegment;

            return (
              <div
                key={seg.id}
                role="button"
                tabIndex={0}
                className={`timeline-segment draggable-item${selected ? ' selected' : ''}${scrubbable ? ' scrubbable' : ''}`}
                draggable={!scrubbable}
                style={{ left: `${layout.left}%`, width: `${layout.width}%` }}
                title={
                  scrubbable
                    ? `${seg.startLocalDisplay} — click or drag to scrub`
                    : `${seg.startLocalDisplay} — drag to open a new tab`
                }
                onClick={() => {
                  // A scrub ends with pointer-up; suppress the click that would follow.
                  if (isDragging()) return;
                  if (!scrubbable) onSelect(seg);
                }}
                onPointerDown={scrubbable ? beginScrub : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(seg);
                  }
                }}
                onDragStart={(e) => handleSegmentDragStart(seg, e)}
                onDragEnd={onDragEnd}
              />
            );
          })}
          {scrubMarker && (
            <div
              className="timeline-scrub-marker"
              style={{ left: `${scrubMarker.leftPercent}%` }}
              aria-label={`Playback position at ${scrubMarker.label}`}
              onPointerDown={canScrubSegment ? beginScrub : undefined}
              title="Drag to scrub playback"
            >
              <span className="timeline-scrub-label">{scrubMarker.label}</span>
              <span className="timeline-scrub-line" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <div className="timeline-list-toolbar">
        <Typography component="span" variant="caption" color="text.secondary" className="timeline-sort-label">
          Sort
        </Typography>
        <ToggleButtonGroup
          className="timeline-sort-toggle"
          exclusive
          size="small"
          value={sortOrder}
          onChange={(_e, value) => { if (value) setSortOrder(value); }}
        >
          <ToggleButton value="newest">Newest</ToggleButton>
          <ToggleButton value="oldest">Oldest</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="timeline-days">
        {dayGroups.map((group) => {
          const expanded = expandedDays.has(group.key);
          return (
            <Accordion
              key={group.key}
              className="timeline-day"
              expanded={expanded}
              onChange={() => toggleDay(group.key)}
              disableGutters
              elevation={0}
              square
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} className="timeline-day-toggle">
                <Typography component="span" className="timeline-day-label" sx={{ fontWeight: 500 }}>
                  {group.label}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary" className="timeline-day-count" sx={{ ml: 1 }}>
                  {group.segments.length} segment{group.segments.length !== 1 ? 's' : ''} · {formatStorage(group.totalBytes)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense disablePadding className="timeline-list">
                  {group.segments.map((seg) => (
                    <ListItem key={seg.id} disablePadding className="timeline-list-row" secondaryAction={null}>
                      <ListItemButton
                        draggable
                        selected={seg.id === selectedId}
                        className="draggable-row"
                        onClick={() => onSelect(seg)}
                        onDragStart={(e) => handleSegmentDragStart(seg, e)}
                        onDragEnd={onDragEnd}
                        title="Click to open, drag to open a new tab"
                        sx={{ flex: 1, gap: 0.5 }}
                      >
                        <span className="drag-handle-icon" aria-hidden="true">⠿</span>
                        <ListItemText
                          primary={formatSegmentTime(seg)}
                          secondary={`${(seg.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                          slotProps={{ secondary: { variant: 'caption' } }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </div>

      <Typography variant="caption" color="text.secondary" className="timeline-retention-note" component="p">
        {retentionDays === 0
          ? 'Automatic cleanup is disabled — delete segments manually.'
          : `Recordings older than ${formatRetentionLabel(retentionDays)} are removed automatically.`}
      </Typography>
    </div>
  );
}
