/**
 * Still thumbnail from a recorded segment at a given offset.
 *
 * Loads the MP4 in a hidden video element, seeks, then draws one frame to a canvas.
 * Used for segment tab icons and timeline hover previews.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

/** Debounce seek captures while scrubbing so we do not decode on every pointer move. */
const THUMB_DEBOUNCE_MS = 500;

/**
 * @param {object} props
 * @param {string} props.segmentId
 * @param {number} [props.time] - Offset in seconds within the segment.
 * @param {'sm'|'md'|'lg'} [props.size]
 */
export default function SegmentPreview({ segmentId, time = 0, size = 'sm' }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const lastSegmentIdRef = useRef(null);
  const targetTime = Math.max(0, Number.isFinite(time) ? time : 0);

  // Reset cached image when switching to a different segment.
  useEffect(() => {
    if (lastSegmentIdRef.current !== segmentId) {
      lastSegmentIdRef.current = segmentId;
      setSrc(null);
      setFailed(false);
    }
  }, [segmentId]);

  // Hidden video → seek → canvas JPEG; debounced when time > 0 (scrubbing).
  useEffect(() => {
    if (!segmentId) return undefined;

    let cancelled = false;
    let video = null;
    let debounceTimer = null;

    const cleanupVideo = () => {
      if (!video) return;
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
      video = null;
    };

    const capture = () => {
      if (cancelled || !video?.videoWidth || !video?.videoHeight) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFailed(true);
          return;
        }
        ctx.drawImage(video, 0, 0);
        setSrc(canvas.toDataURL('image/jpeg', 0.82));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    };

    const onLoadedData = () => {
      if (!video) return;
      try {
        video.currentTime = targetTime;
      } catch {
        capture();
      }
    };

    const onSeeked = () => capture();

    const onError = () => {
      if (!cancelled) setFailed(true);
    };

    const startCapture = () => {
      if (cancelled) return;
      cleanupVideo();

      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.src = api.recordingUrl(segmentId);
      video.load();
    };

    debounceTimer = setTimeout(startCapture, targetTime > 0 ? THUMB_DEBOUNCE_MS : 0);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      cleanupVideo();
    };
  }, [segmentId, targetTime]);

  return (
    <span
      className={`camera-preview camera-preview-${size} segment-preview${failed && !src ? ' offline' : ''}`}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="camera-preview-video" />
      ) : (
        <span className="camera-preview-placeholder" />
      )}
    </span>
  );
}
