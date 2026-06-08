/**
 * Compact live HLS preview for tab thumbnails and sidebar tiles.
 *
 * Waits for the server playlist before attaching Hls.js so we do not spin on a
 * manifest that ffmpeg has not written yet. Shows a static placeholder when offline.
 */
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { api } from '../api.js';

/** Poll until the live `.m3u8` responds — stream status can flip to live before the file exists. */
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

/**
 * @param {object} props
 * @param {string} props.cameraId
 * @param {boolean} props.streaming - When false, renders placeholder only (no HLS attach).
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export default function CameraPreview({ cameraId, streaming, size = 'md' }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Attach HLS when streaming; tear down on camera change or when streaming stops.
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
          enableWorker: false,
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
