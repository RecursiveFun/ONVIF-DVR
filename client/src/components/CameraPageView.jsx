import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, formatLocalTime } from '../api.js';
import ConfirmDialog from './ConfirmDialog.jsx';
import DVRPlayer from './DVRPlayer.jsx';
import LivePlayer from './LivePlayer.jsx';
import Timeline from './Timeline.jsx';
import { getMostRecentlyFinishedSegment } from '../utils/segments.js';

export default function CameraPageView({
  camera,
  initialSegment = null,
  isSegmentTab = false,
  tabId = null,
  segmentDurationSec = 300,
  retentionDays = 7,
  canRecord = true,
  setCameras,
  refreshCameras,
  onRequestRemove,
  onSegmentDeleted,
  onSegmentMetadataUpdate,
  onOpenSegmentTab,
  onTabGoLive,
  getPlaybackPosition,
  onPlaybackPositionChange,
  onDragStart,
  onDragEnd,
}) {
  const [mode, setMode] = useState(() => (initialSegment ? 'playback' : 'live'));
  const [timeline, setTimeline] = useState({ segments: [], rangeStart: null, rangeEnd: null });
  const [selectedSegment, setSelectedSegment] = useState(() => initialSegment || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [segmentRemoveTarget, setSegmentRemoveTarget] = useState(null);
  const [deletingSegment, setDeletingSegment] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);

  // Playback position shown on the timeline playhead (seconds into the active segment).
  const [playbackScrubSec, setPlaybackScrubSec] = useState(0);
  const playerRef = useRef(null);
  const wasRecordingRef = useRef(camera.recording);

  const isLive = camera.status === 'live';
  const isRecording = camera.recording;
  const isIdle = !isLive && !isRecording;

  const refreshTimeline = useCallback(async () => {
    try {
      const data = await api.getTimeline(camera.id);
      setTimeline(data);
    } catch {
      setTimeline({ segments: [], rangeStart: null, rangeEnd: null });
    }
  }, [camera.id]);

  useEffect(() => {
    if (isSegmentTab && initialSegment) {
      setSelectedSegment(initialSegment);
      setError('');
      return;
    }
    if (initialSegment) {
      setSelectedSegment(initialSegment);
      setMode('playback');
    } else {
      setMode('live');
      setSelectedSegment(null);
    }
    setError('');
  }, [camera.id, initialSegment?.id, isSegmentTab]);

  useEffect(() => {
    refreshTimeline();
    const interval = setInterval(refreshTimeline, 15000);
    return () => clearInterval(interval);
  }, [camera.id, refreshTimeline]);

  useEffect(() => {
    wasRecordingRef.current = camera.recording;
    setMediaRevision(0);
  }, [camera.id]);

  useEffect(() => {
    setMediaRevision(0);
  }, [selectedSegment?.id]);

  // Restore saved position when the user switches segments or the file is rewritten mid-playback.
  useEffect(() => {
    const segmentId = selectedSegment?.id ?? (isSegmentTab ? initialSegment?.id : null);
    if (!segmentId) {
      setPlaybackScrubSec(0);
      return;
    }
    setPlaybackScrubSec(getPlaybackPosition?.(segmentId) ?? 0);
  }, [selectedSegment?.id, initialSegment?.id, isSegmentTab, getPlaybackPosition, mediaRevision]);

  useEffect(() => {
    const wasRecording = wasRecordingRef.current;
    wasRecordingRef.current = camera.recording;
    if (wasRecording && !camera.recording && mode === 'playback' && selectedSegment) {
      setMediaRevision((revision) => revision + 1);
    }
  }, [camera.recording, mode, selectedSegment]);

  useEffect(() => {
    if (!selectedSegment) return;
    const updated = timeline.segments.find((seg) => seg.id === selectedSegment.id);
    if (updated) {
      setSelectedSegment((current) => {
        if (!current || current.id !== updated.id) return current;
        if (
          current.mtime === updated.mtime
          && current.sizeBytes === updated.sizeBytes
          && current.durationSec === updated.durationSec
        ) {
          return current;
        }
        if (isSegmentTab && tabId) {
          onSegmentMetadataUpdate?.(tabId, updated);
        }
        return updated;
      });
    }
  }, [timeline.segments, selectedSegment?.id, isSegmentTab, tabId, onSegmentMetadataUpdate]);

  const updateCamera = (cam) => {
    setCameras((prev) => prev.map((c) => (c.id === cam.id ? cam : c)));
  };

  const runAction = async (action, { refreshTimelineAfter = false } = {}) => {
    setBusy(true);
    setError('');
    try {
      const cam = await action();
      updateCamera(cam);
      if (refreshTimelineAfter) await refreshTimeline();
      setTimeout(() => refreshCameras().catch(() => {}), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startLiveOnly = () => runAction(() => api.startLive(camera.id));
  const startRecordingOnly = () => runAction(() => api.startRecording(camera.id), { refreshTimelineAfter: true });
  const startLiveAndRecord = () => runAction(() => api.startCamera(camera.id), { refreshTimelineAfter: true });
  const stopLiveOnly = () => runAction(() => api.stopLive(camera.id));
  const stopRecordingOnly = () => runAction(() => api.stopRecording(camera.id), { refreshTimelineAfter: true });
  const stopAll = () => runAction(() => api.stopCamera(camera.id), { refreshTimelineAfter: true });

  const latestFinishedSegment = getMostRecentlyFinishedSegment(timeline.segments, isRecording);
  const activeSegment = selectedSegment || (isSegmentTab ? initialSegment : null);
  const canPlayback = isSegmentTab
    ? Boolean(selectedSegment || initialSegment)
    : Boolean(latestFinishedSegment);

  const requestRemove = () => {
    if (mode === 'playback' && activeSegment) {
      setSegmentRemoveTarget(activeSegment);
      return;
    }
    onRequestRemove(camera.id);
  };

  const confirmRemoveSegment = async () => {
    if (!segmentRemoveTarget || deletingSegment) return;
    setDeletingSegment(true);
    setError('');
    try {
      await api.deleteRecording(segmentRemoveTarget.id);
      onSegmentDeleted?.(segmentRemoveTarget);
      setSegmentRemoveTarget(null);
      if (!isSegmentTab) {
        setSelectedSegment(null);
        setMode('live');
      }
      await refreshTimeline();
    } catch (err) {
      setError(err.message || 'Failed to delete segment');
    } finally {
      setDeletingSegment(false);
    }
  };

  const selectSegment = (seg) => {
    onOpenSegmentTab?.(seg);
  };

  const goLive = () => {
    setMode('live');
    if (isSegmentTab && tabId) {
      onTabGoLive?.(tabId);
      return;
    }
    setSelectedSegment(null);
  };

  const returnToPlayback = () => {
    if (isSegmentTab && initialSegment) {
      setSelectedSegment(initialSegment);
      setMode('playback');
      return;
    }

    if (!latestFinishedSegment) return;

    onOpenSegmentTab?.(latestFinishedSegment);
  };

  const savedPlaybackTime = activeSegment?.id
    ? getPlaybackPosition?.(activeSegment.id) ?? 0
    : 0;

  /** Video timeupdate → timeline playhead (normal playback, not timeline drag). */
  const handlePlaybackTimeChange = useCallback((segmentId, time) => {
    if (segmentId === activeSegment?.id) {
      setPlaybackScrubSec(time);
    }
    onPlaybackPositionChange?.(segmentId, time);
  }, [activeSegment?.id, onPlaybackPositionChange]);

  /**
   * Timeline drag → video seek.
   * Seeks on every move; only updates persisted position and parent state on release
   * so we avoid re-rendering this page on every pointer pixel during drag.
   */
  const handleTimelineScrub = useCallback((segmentId, timeSec, { final = false } = {}) => {
    if (segmentId !== activeSegment?.id) return;

    playerRef.current?.scrubTo(timeSec, { final });

    if (final) {
      setPlaybackScrubSec(timeSec);
      onPlaybackPositionChange?.(segmentId, timeSec);
    }
  }, [activeSegment?.id, onPlaybackPositionChange]);

  return (
    <Box component="article" className="camera-page">
      <Box className="camera-page-header" sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h5" component="h2">{camera.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
              {camera.rtspUrl}
            </Typography>
          </Box>
          {isRecording && <Chip label="REC" color="error" size="small" />}
        </Box>
      </Box>

      <Box className="toolbar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <ToggleButtonGroup
          className="mode-toggle"
          exclusive
          size="small"
          value={mode}
          onChange={(_e, value) => {
            if (!value) return;
            if (value === 'live') goLive();
            else returnToPlayback();
          }}
        >
          <ToggleButton value="live" disabled={!isLive}>Live</ToggleButton>
          <ToggleButton
            value="playback"
            disabled={!canPlayback}
          >
            Playback
          </ToggleButton>
        </ToggleButtonGroup>

        <Box className="toolbar-actions" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {isIdle && (
            <>
              <Button variant="contained" onClick={startLiveOnly} disabled={busy}>
                Watch Live
              </Button>
              <Button
                variant="outlined"
                onClick={startLiveAndRecord}
                disabled={busy || !canRecord}
                title={!canRecord ? 'Not enough free disk space to record' : undefined}
              >
                Watch &amp; Record
              </Button>
            </>
          )}
          {isLive && !isRecording && (
            <>
              <Button
                variant="outlined"
                onClick={startRecordingOnly}
                disabled={busy || !canRecord}
                title={!canRecord ? 'Not enough free disk space to record' : undefined}
              >
                Start Recording
              </Button>
              <Button variant="contained" color="error" onClick={stopLiveOnly} disabled={busy}>
                Stop
              </Button>
            </>
          )}
          {mode !== 'playback' && isLive && isRecording && (
            <>
              <Button variant="outlined" onClick={stopRecordingOnly} disabled={busy}>
                Stop Recording
              </Button>
              <Button variant="contained" color="error" onClick={stopAll} disabled={busy}>
                Stop All
              </Button>
            </>
          )}
          {mode !== 'playback' && !isLive && isRecording && (
            <Button variant="contained" color="error" onClick={stopRecordingOnly} disabled={busy}>
              Stop Recording
            </Button>
          )}
          <Button
            variant={mode === 'playback' && activeSegment ? 'contained' : 'outlined'}
            color={mode === 'playback' && activeSegment ? 'error' : 'inherit'}
            onClick={requestRemove}
            disabled={busy || deletingSegment}
          >
            {mode === 'playback' && activeSegment ? 'Delete Segment' : 'Remove'}
          </Button>
        </Box>
      </Box>

      <Box className="viewer">
        {mode === 'live' && isLive ? (
          <LivePlayer src={api.liveUrl(camera.id)} active />
        ) : mode === 'playback' && activeSegment ? (
          <DVRPlayer
            ref={playerRef}
            src={api.recordingUrl(activeSegment.id)}
            segmentId={activeSegment.id}
            segmentLabel={activeSegment.startLocalDisplay}
            durationSec={activeSegment.durationSec}
            initialTime={savedPlaybackTime}
            onPlaybackTimeChange={handlePlaybackTimeChange}
            mediaRevision={mediaRevision}
            onGoLive={goLive}
            isLiveMode={false}
          />
        ) : (
          <Box className="placeholder video-placeholder">
            <Typography color="text.secondary" align="center">
              {isIdle
                ? 'Press “Watch Live” to view the stream, or “Watch & Record” to also start DVR capture.'
                : isRecording && !isLive
                  ? 'Recording in progress without a live preview. Start live view or select a segment below.'
                  : 'Select a recording segment below to play back.'}
            </Typography>
          </Box>
        )}
      </Box>

      {(camera.startedAt || camera.error) && (
        <Box className="meta-bar" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {camera.startedAt && (
            <Typography variant="body2" color="text.secondary">
              Session: {formatLocalTime(camera.startedAt)}
            </Typography>
          )}
          {camera.error && (
            <Typography variant="body2" color="error">{camera.error}</Typography>
          )}
        </Box>
      )}

      <Timeline
        segments={timeline.segments}
        selectedId={mode === 'live' ? null : activeSegment?.id}
        playbackScrub={
          mode === 'playback' && activeSegment
            ? { segmentId: activeSegment.id, timeSec: playbackScrubSec }
            : null
        }
        onScrubChange={
          mode === 'playback' && activeSegment ? handleTimelineScrub : undefined
        }
        onSelect={selectSegment}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
        cameraId={camera.id}
        cameraName={camera.name}
        segmentDurationSec={segmentDurationSec}
        retentionDays={retentionDays}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <ConfirmDialog
        open={Boolean(segmentRemoveTarget)}
        title="Delete recording segment?"
        description={`Are you sure you want to delete "${segmentRemoveTarget?.startLocalDisplay || segmentRemoveTarget?.filename}"? This cannot be undone.`}
        confirmLabel="Delete Segment"
        confirming={deletingSegment}
        onCancel={() => { if (!deletingSegment) setSegmentRemoveTarget(null); }}
        onConfirm={confirmRemoveSegment}
      />
    </Box>
  );
}
