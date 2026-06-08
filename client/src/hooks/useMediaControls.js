import { useCallback, useEffect, useRef, useState } from 'react';

const VOLUME_KEY = 'onvif-dvr-volume';

function loadSavedVolume() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (!Number.isNaN(v) && v >= 0 && v <= 1) return v;
  } catch { /* ignore */ }
  return 0.8;
}

export function useMediaControls(videoRef) {
  const containerRef = useRef(null);
  const [volume, setVolumeState] = useState(loadSavedVolume);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const applyVolume = useCallback((v, m) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = m;
  }, [videoRef]);

  useEffect(() => {
    applyVolume(volume, muted);
  }, [volume, muted, applyVolume]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const setVolume = useCallback((value) => {
    const v = Math.max(0, Math.min(1, value));
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    if (v > 0) setMuted(false);
    applyVolume(v, v === 0);
  }, [applyVolume]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      applyVolume(volume, next);
      return next;
    });
  }, [volume, applyVolume]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch { /* browser may block */ }
  }, []);

  return {
    containerRef,
    volume,
    muted,
    isFullscreen,
    setVolume,
    toggleMute,
    toggleFullscreen,
  };
}
