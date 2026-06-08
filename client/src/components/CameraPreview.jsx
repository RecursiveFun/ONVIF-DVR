/**
 * Compact live preview for tab thumbnails and sidebar tiles.
 *
 * HTTP/MJPEG cameras poll a server-proxied JPEG frame. RTSP cameras decode HLS
 * in a hidden video element and paint the latest frame to an <img>.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { loadHls } from '../utils/loadHls.js';
import { isHttpStreamUrl } from '../utils/streamUrl.js';

const HTTP_REFRESH_MS = 2500;
const HLS_CAPTURE_MS = 2000;

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

function captureVideoFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

/**
 * @param {object} props
 * @param {string} props.cameraId
 * @param {string} [props.streamUrl] - Masked camera URL; used to detect HTTP streams.
 * @param {boolean} props.streaming - When false, renders placeholder only.
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export default function CameraPreview({ cameraId, streamUrl, streaming, size = 'md' }) {
  const [thumbSrc, setThumbSrc] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const httpStream = isHttpStreamUrl(streamUrl);

  const updateThumb = useCallback((src) => {
    if (src) setThumbSrc(src);
  }, []);

  // HTTP cameras: server fetches one MJPEG frame (works even when HLS preview is black).
  useEffect(() => {
    if (!streaming || !httpStream) return undefined;

    let objectUrl = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch(api.previewUrl(cameraId), { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        setThumbSrc(objectUrl);
      } catch {
        // keep last good frame
      }
    };

    refresh();
    const timer = setInterval(refresh, HTTP_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cameraId, streaming, httpStream]);

  // RTSP cameras: decode HLS off-screen and snapshot frames into the thumbnail <img>.
  useEffect(() => {
    if (!streaming || httpStream) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const src = api.liveUrl(cameraId);
    let cancelled = false;
    let captureTimer = null;

    const capture = () => {
      const frame = captureVideoFrame(video);
      if (frame) updateThumb(frame);
    };

    async function start() {
      const ready = await waitForPlaylist(src);
      if (cancelled || !ready) return;

      const Hls = await loadHls();
      if (cancelled) return;

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

      video.addEventListener('loadeddata', capture);
      captureTimer = setInterval(capture, HLS_CAPTURE_MS);
    }

    start();

    return () => {
      cancelled = true;
      if (captureTimer) clearInterval(captureTimer);
      video.removeEventListener('loadeddata', capture);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [cameraId, streaming, httpStream, updateThumb]);

  useEffect(() => {
    if (!streaming) setThumbSrc(null);
  }, [streaming]);

  const isLive = streaming;

  return (
    <span
      className={`camera-preview camera-preview-${size}${isLive ? ' live' : ' offline'}`}
      aria-hidden="true"
    >
      {isLive ? (
        <>
          {!httpStream && (
            <video
              ref={videoRef}
              className="camera-preview-source"
              muted
              playsInline
              autoPlay
            />
          )}
          {thumbSrc ? (
            <img src={thumbSrc} alt="" className="camera-preview-video" />
          ) : (
            <span className="camera-preview-placeholder" />
          )}
        </>
      ) : (
        <span className="camera-preview-placeholder" />
      )}
    </span>
  );
}
