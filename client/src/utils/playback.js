export function usableDuration(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function seekableEnd(video) {
  if (!video?.seekable?.length) return 0;
  try {
    return video.seekable.end(video.seekable.length - 1);
  } catch {
    return 0;
  }
}
