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
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatLocalTime } from '../api.js';
import DragHandle from './DragHandle.jsx';
import { setSegmentDragData } from '../utils/dragPayload.js';
import { DEFAULT_RETENTION_DAYS, formatRetentionLabel } from '../utils/retention.js';
import { DEFAULT_SEGMENT_DURATION_SEC, formatSegmentDurationLabel } from '../utils/segmentDuration.js';

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

function segmentTime(seg) {
  return new Date(seg.startLocal || seg.mtime).getTime();
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getVisibleTimeMs(scrollLeft, viewportWidth, zoomLevel, startMs, span) {
  const trackWidth = viewportWidth * zoomLevel;
  if (!viewportWidth || trackWidth <= 0) {
    return { startMs, endMs: startMs + span };
  }
  return {
    startMs: startMs + (scrollLeft / trackWidth) * span,
    endMs: startMs + ((scrollLeft + viewportWidth) / trackWidth) * span,
  };
}

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

export default function Timeline({
  segments,
  selectedId,
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

    const startMs = rangeStart ? new Date(rangeStart).getTime() : 0;
    const endMs = rangeEnd ? new Date(rangeEnd).getTime() : startMs + 1;
    const span = Math.max(endMs - startMs, 1);
    const segStart = seg.startLocal ? new Date(seg.startLocal).getTime() : new Date(seg.mtime).getTime();
    const segEnd = seg.endLocal ? new Date(seg.endLocal).getTime() : segStart + seg.durationSec * 1000;
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

  const dayGroups = groupSegmentsByDay(segments, sortOrder);
  const allBytes = totalBytes(segments);
  const startMs = rangeStart ? new Date(rangeStart).getTime() : 0;
  const endMs = rangeEnd ? new Date(rangeEnd).getTime() : startMs + 1;
  const span = Math.max(endMs - startMs, 1);
  const { startMs: visibleStartMs, endMs: visibleEndMs } = getVisibleTimeMs(
    viewportScroll.scrollLeft,
    viewportScroll.width,
    zoomLevel,
    startMs,
    span,
  );

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span>{formatLocalTime(new Date(visibleStartMs).toISOString())}</span>
        <span className="muted">
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
        <div
          className="timeline-bar-track"
          style={{ width: `${zoomLevel * 100}%` }}
        >
          {segments.map((seg) => {
            const segStart = seg.startLocal ? new Date(seg.startLocal).getTime() : new Date(seg.mtime).getTime();
            const segEnd = seg.endLocal ? new Date(seg.endLocal).getTime() : segStart + seg.durationSec * 1000;
            const left = ((segStart - startMs) / span) * 100;
            const width = Math.max(((segEnd - segStart) / span) * 100, 0.5);
            const selected = seg.id === selectedId;

            return (
              <div
                key={seg.id}
                role="button"
                tabIndex={0}
                className={`timeline-segment draggable-item${selected ? ' selected' : ''}`}
                draggable
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${seg.startLocalDisplay} — drag to open a new tab`}
                onClick={() => onSelect(seg)}
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
                      <DragHandle
                        label="Drag segment to open a new tab"
                        onDragStart={(e) => handleSegmentDragStart(seg, e)}
                        onDragEnd={onDragEnd}
                      />
                      <ListItemButton
                        selected={seg.id === selectedId}
                        onClick={() => onSelect(seg)}
                        sx={{ flex: 1 }}
                      >
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
