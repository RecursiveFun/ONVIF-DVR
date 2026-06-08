/**
 * Lazy-load hls.js once and reuse the same module across previews and players.
 * Keeps the ~500 kB library out of the initial app bundle.
 */

let hlsPromise;

export function loadHls() {
  if (!hlsPromise) {
    hlsPromise = import('hls.js').then((mod) => mod.default);
  }
  return hlsPromise;
}
