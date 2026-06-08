import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import MediaToolbar from './MediaToolbar.jsx';
import FullscreenButton from './FullscreenButton.jsx';
import { useMediaControls } from '../hooks/useMediaControls.js';

async function waitForPlaylist(src, maxAttempts = 30, intervalMs = 1000) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (res.ok) return true;
    } catch {
      // stream not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export default function LivePlayer({ src, active, compact = false }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hasPlayedRef = useRef(false);
  const [status, setStatus] = useState('connecting');
  const {
    containerRef,
    volume,
    muted,
    isFullscreen,
    setVolume,
    toggleMute,
    toggleFullscreen,
  } = useMediaControls(videoRef);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !active) return undefined;

    let cancelled = false;

    async function start() {
      if (!hasPlayedRef.current) {
        setStatus('connecting');
      }
      const ready = await waitForPlaylist(src);
      if (cancelled) return undefined;

      if (!ready) {
        setStatus('waiting');
        return undefined;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          manifestLoadingMaxRetry: 12,
          manifestLoadingRetryDelay: 1000,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          hasPlayedRef.current = true;
          setStatus('playing');
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setStatus(hasPlayedRef.current ? 'reconnecting' : 'connecting');
            hls.startLoad();
            return;
          }
          setStatus('error');
          hls.destroy();
        });
        return undefined;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.play().catch(() => {});
        hasPlayedRef.current = true;
        setStatus('playing');
      }
      return undefined;
    }

    start();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, active]);

  useEffect(() => {
    if (!active) {
      hasPlayedRef.current = false;
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [active]);

  const showStatus = status !== 'playing';

  return (
    <div className={`live-player-wrap${compact ? ' compact' : ''}`} ref={containerRef}>
      <video
        ref={videoRef}
        className="video-player"
        muted
        playsInline
        autoPlay
      />
      {showStatus && status === 'connecting' && (
        <div className="live-status">Connecting to camera…</div>
      )}
      {showStatus && status === 'waiting' && (
        <div className="live-status">Waiting for stream (check FFmpeg logs)…</div>
      )}
      {showStatus && status === 'reconnecting' && (
        <div className="live-status">Reconnecting…</div>
      )}
      {showStatus && status === 'error' && (
        <div className="live-status error">Live stream error</div>
      )}
      {!compact && (
        <>
          <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
          <div className="player-chrome">
            <MediaToolbar
              volume={volume}
              muted={muted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
            {muted && (
              <span className="muted-hint">Click 🔇 or raise volume for sound</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
