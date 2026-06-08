import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { api } from '../api.js';

async function waitForPlaylist(src, maxAttempts = 15, intervalMs = 800) {
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

export default function CameraPreview({ cameraId, streaming, size = 'md' }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!streaming) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const src = api.liveUrl(cameraId);
    let cancelled = false;

    async function start() {
      const ready = await waitForPlaylist(src);
      if (cancelled || !ready) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 2,
          maxBufferLength: 10,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.play().catch(() => {});
      }
    }

    start();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [cameraId, streaming]);

  const isLive = streaming;

  return (
    <span
      className={`camera-preview camera-preview-${size}${isLive ? ' live' : ' offline'}`}
      aria-hidden="true"
    >
      {isLive ? (
        <video ref={videoRef} className="camera-preview-video" muted playsInline autoPlay />
      ) : (
        <span className="camera-preview-placeholder" />
      )}
    </span>
  );
}
