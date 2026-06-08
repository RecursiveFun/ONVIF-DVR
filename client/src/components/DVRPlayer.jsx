import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { formatDuration, formatLocalTime } from '../api.js';
import MediaToolbar from './MediaToolbar.jsx';
import FullscreenButton from './FullscreenButton.jsx';
import { useMediaControls } from '../hooks/useMediaControls.js';
import { seekableEnd, usableDuration } from '../utils/playback.js';

const SPEEDS = [0.5, 1, 1.5, 2, 4];
const SKIP_SEC = 10;

/**
 * Recorded-segment video player with transport controls.
 *
 * Exposes ref.scrubTo(timeSec, { final }) for timeline scrubbing:
 *   - While dragging (final: false): pause and seek without resuming.
 *   - On release (final: true): seek and resume if playback was active before the drag.
 */
const DVRPlayer = forwardRef(function DVRPlayer({
  src,
  segmentId,
  segmentLabel,
  durationSec,
  initialTime = 0,
  onPlaybackTimeChange,
  onGoLive,
  isLiveMode,
  mediaRevision = 0,
}, ref) {
  const videoRef = useRef(null);
  const maxSeenTimeRef = useRef(0);
  const pendingSeekRef = useRef(null);
  const suppressTimeReportsRef = useRef(false);
  const lastMediaRevisionRef = useRef(mediaRevision);
  // Set while the timeline is driving seeks; blocks timeupdate from fighting the drag.
  const scrubSessionRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const {
    containerRef,
    volume,
    muted,
    isFullscreen,
    setVolume,
    toggleMute,
    toggleFullscreen,
  } = useMediaControls(videoRef);

  /** Tell the parent (and timeline playhead) where playback is, unless a seek is in flight. */
  const reportTime = useCallback((time) => {
    if (!segmentId || !Number.isFinite(time) || time < 0) return;
    if (suppressTimeReportsRef.current || scrubSessionRef.current) return;
    onPlaybackTimeChange?.(segmentId, time);
  }, [segmentId, onPlaybackTimeChange]);

  const resolveDuration = useCallback((video) => {
    const fromVideo = usableDuration(video?.duration);
    const fromSeekable = seekableEnd(video);
    const fromSeen = maxSeenTimeRef.current;
    return fromVideo || fromSeekable || fromSeen || usableDuration(durationSec);
  }, [durationSec]);

  const getDuration = useCallback(() => {
    return resolveDuration(videoRef.current);
  }, [resolveDuration]);

  const seekTo = useCallback((time, { resume = false } = {}) => {
    const v = videoRef.current;
    if (!v) return;

    const total = resolveDuration(v);
    let target = Math.max(0, Math.min(total || time, time));
    const seekEnd = seekableEnd(v);
    if (seekEnd > 0) {
      target = Math.min(target, Math.max(0, seekEnd - 0.05));
    }

    const applySeek = () => {
      try {
        v.pause();
        v.currentTime = target;
        setCurrentTime(target);
        if (target > maxSeenTimeRef.current) {
          maxSeenTimeRef.current = target;
        }
        suppressTimeReportsRef.current = false;
        if (resume) {
          v.play().catch(() => setPlaying(false));
        }
        reportTime(target);
      } catch {
        // fragmented MP4 may reject some seeks until buffered
      }
    };

    if (v.readyState >= 1) {
      applySeek();
      return;
    }

    pendingSeekRef.current = target;
    const onReady = () => {
      v.removeEventListener('loadeddata', onReady);
      const pending = pendingSeekRef.current;
      pendingSeekRef.current = null;
      if (pending != null) {
        seekTo(pending, { resume });
      } else {
        applySeek();
      }
    };
    v.addEventListener('loadeddata', onReady);
  }, [resolveDuration, reportTime]);

  const togglePlay = useCallback((e) => {
    if (e?.target !== videoRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) {
        seekTo(0, { resume: true });
        return;
      }
      v.play().catch(() => setPlaying(false));
      return;
    }
    v.pause();
  }, [seekTo]);

  const skip = useCallback((delta) => {
    const v = videoRef.current;
    if (!v) return;
    const wasPlaying = !v.paused && !v.ended;
    seekTo(v.currentTime + delta, { resume: wasPlaying });
  }, [seekTo]);

  const changeSpeed = useCallback((s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const syncDuration = () => {
      const next = resolveDuration(v);
      if (next > 0) setDuration(next);
    };

    const onTime = () => {
      const t = v.currentTime;
      setCurrentTime(t);
      reportTime(t);
      if (t > maxSeenTimeRef.current) {
        maxSeenTimeRef.current = t;
        if (!usableDuration(v.duration)) {
          setDuration((d) => Math.max(d, t));
        }
      }
    };

    const onEnded = () => {
      setPlaying(false);
      const end = Math.max(v.currentTime, maxSeenTimeRef.current);
      maxSeenTimeRef.current = end;
      setCurrentTime(end);
      reportTime(end);
      setDuration((d) => {
        const actual = usableDuration(v.duration) || end;
        return actual > 0 ? actual : d;
      });
    };

    const onLoadedData = () => {
      const pending = pendingSeekRef.current;
      if (pending != null) {
        pendingSeekRef.current = null;
        try {
          v.currentTime = pending;
          setCurrentTime(pending);
          suppressTimeReportsRef.current = false;
          reportTime(pending);
        } catch {
          suppressTimeReportsRef.current = false;
          // ignore seek failures on first load
        }
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const boundSegmentId = segmentId;

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', syncDuration);
    v.addEventListener('durationchange', syncDuration);
    v.addEventListener('progress', syncDuration);
    v.addEventListener('loadeddata', onLoadedData);
    v.addEventListener('ended', onEnded);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);

    return () => {
      if (
        boundSegmentId
        && !suppressTimeReportsRef.current
        && Number.isFinite(v.currentTime)
        && v.currentTime >= 0
      ) {
        onPlaybackTimeChange?.(boundSegmentId, v.currentTime);
      }
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', syncDuration);
      v.removeEventListener('durationchange', syncDuration);
      v.removeEventListener('progress', syncDuration);
      v.removeEventListener('loadeddata', onLoadedData);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [src, resolveDuration, segmentId, onPlaybackTimeChange, reportTime]);

  useEffect(() => {
    const start = Math.max(0, initialTime || 0);
    maxSeenTimeRef.current = start;
    pendingSeekRef.current = start > 0 ? start : null;
    suppressTimeReportsRef.current = start > 0;
    lastMediaRevisionRef.current = 0;
    setCurrentTime(start);
    setDuration(usableDuration(durationSec));
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [src, speed, initialTime, durationSec]);

  useEffect(() => {
    const hint = usableDuration(durationSec);
    if (hint > 0) {
      setDuration((d) => (d > 0 ? Math.max(d, hint) : hint));
    }
  }, [durationSec]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mediaRevision === lastMediaRevisionRef.current) return;

    const hadRevision = lastMediaRevisionRef.current > 0;
    lastMediaRevisionRef.current = mediaRevision;

    if (!hadRevision) return;

    const savedTime = Math.max(v.currentTime, maxSeenTimeRef.current);
    const wasPlaying = !v.paused && !v.ended;
    pendingSeekRef.current = savedTime;
    maxSeenTimeRef.current = savedTime;
    setCurrentTime(savedTime);
    v.load();
    if (wasPlaying) {
      const onReady = () => {
        v.removeEventListener('loadeddata', onReady);
        seekTo(savedTime, { resume: true });
      };
      v.addEventListener('loadeddata', onReady);
    }
  }, [mediaRevision, seekTo]);

  useImperativeHandle(ref, () => ({
    scrubTo(timeSec, { final = false } = {}) {
      if (!Number.isFinite(timeSec)) return;

      if (final) {
        const shouldResume = scrubSessionRef.current?.wasPlaying ?? false;
        scrubSessionRef.current = null;
        seekTo(timeSec, { resume: shouldResume });
        return;
      }

      // First move in a drag: remember whether we should resume on release.
      if (!scrubSessionRef.current) {
        const video = videoRef.current;
        const wasPlaying = Boolean(video && !video.paused && !video.ended);
        scrubSessionRef.current = { wasPlaying };
      }

      seekTo(timeSec, { resume: false });
    },
  }), [seekTo]);

  const seek = (e) => {
    e.stopPropagation();
    const total = duration || getDuration();
    if (!total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const wasPlaying = !videoRef.current?.paused && !videoRef.current?.ended;
    seekTo(ratio * total, { resume: wasPlaying });
  };

  const totalDuration = duration || usableDuration(durationSec);
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="dvr-player" ref={containerRef}>
      <video
        ref={videoRef}
        key={src}
        className="video-player"
        src={src}
        playsInline
        onClick={togglePlay}
      />

      <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />

      <div className="dvr-overlay">
        {segmentLabel && (
          <span className="dvr-segment-label">{segmentLabel}</span>
        )}
        {!isLiveMode && (
          <div className="dvr-progress" onClick={seek} role="slider" aria-valuenow={progress}>
            <div className="dvr-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        <Box className="dvr-controls" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
          <Button size="small" onClick={(e) => { e.stopPropagation(); skip(-SKIP_SEC); }} title="Back 10s" sx={{ color: 'inherit', minWidth: 0 }}>
            ⏪ 10s
          </Button>
          <Button
            size="small"
            className="dvr-play-btn"
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              const v = videoRef.current;
              if (!v) return;
              if (v.paused || v.ended) {
                if (v.ended) seekTo(0, { resume: true });
                else v.play().catch(() => setPlaying(false));
              } else {
                v.pause();
              }
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); skip(SKIP_SEC); }} title="Forward 10s" sx={{ color: 'inherit', minWidth: 0 }}>
            10s ⏩
          </Button>

          <Typography className="dvr-time" variant="caption" sx={{ mx: 0.5 }}>
            {formatDuration(currentTime)} / {formatDuration(totalDuration)}
          </Typography>

          <MediaToolbar
            volume={volume}
            muted={muted}
            onVolumeChange={setVolume}
            onToggleMute={toggleMute}
          />

          <ToggleButtonGroup
            className="dvr-speed"
            exclusive
            size="small"
            value={speed}
            onChange={(_e, value) => { if (value) changeSpeed(value); }}
            sx={{ ml: 0.5 }}
          >
            {SPEEDS.map((s) => (
              <ToggleButton key={s} value={s} sx={{ color: 'inherit', px: 0.75 }}>
                {s}x
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {onGoLive && (
            <Button size="small" variant="contained" className="go-live" onClick={onGoLive} sx={{ ml: 'auto' }}>
              Go Live
            </Button>
          )}
        </Box>
      </div>
    </div>
  );
});

export default DVRPlayer;
