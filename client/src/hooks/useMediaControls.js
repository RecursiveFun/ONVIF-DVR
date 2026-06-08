/**
 * Shared volume, mute, and fullscreen behavior for live and DVR players.
 * Volume level is remembered in localStorage across sessions.
 */

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

  const applyVolume = useCallback((level, isMuted) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = level;
    video.muted = isMuted;
  }, [videoRef]);

  useEffect(() => {
    applyVolume(volume, muted);
  }, [volume, muted, applyVolume]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const setVolume = useCallback((value) => {
    const level = Math.max(0, Math.min(1, value));
    setVolumeState(level);
    localStorage.setItem(VOLUME_KEY, String(level));
    if (level > 0) setMuted(false);
    applyVolume(level, level === 0);
  }, [applyVolume]);

  const toggleMute = useCallback(() => {
    setMuted((wasMuted) => {
      const next = !wasMuted;
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
