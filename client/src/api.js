/**
 * HTTP client for the ONVIF-DVR backend and shared display formatters.
 *
 * In development, Vite proxies `/api` and `/live` to the Node server.
 * In LAN/production mode, the same paths are served from Express directly.
 */

const BASE = '';

/** JSON fetch wrapper — throws with the server's error message on non-2xx responses. */
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  getStorage: () => request('/api/storage'),
  listFsRoots: () => request('/api/fs/roots'),
  listDirectory: (dirPath) =>
    request(`/api/fs/directories?path=${encodeURIComponent(dirPath || '')}`),
  getSettings: () => request('/api/settings'),
  updateSettings: (body) =>
    request('/api/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  listCameras: () => request('/api/cameras'),
  addCamera: (body) => request('/api/cameras', { method: 'POST', body: JSON.stringify(body) }),
  deleteCamera: (id) => request(`/api/cameras/${id}`, { method: 'DELETE' }),
  startCamera: (id) => request(`/api/cameras/${id}/start`, { method: 'POST' }),
  stopCamera: (id) => request(`/api/cameras/${id}/stop`, { method: 'POST' }),
  startLive: (id) => request(`/api/cameras/${id}/live/start`, { method: 'POST' }),
  stopLive: (id) => request(`/api/cameras/${id}/live/stop`, { method: 'POST' }),
  startRecording: (id) => request(`/api/cameras/${id}/record/start`, { method: 'POST' }),
  stopRecording: (id) => request(`/api/cameras/${id}/record/stop`, { method: 'POST' }),
  getTimeline: (id) => request(`/api/cameras/${id}/timeline`),
  getRecordings: (id) => request(`/api/cameras/${id}/recordings`),
  discoverOnvif: () => request('/api/onvif/discover'),
  probeOnvifHost: (body) =>
    request('/api/onvif/probe-host', { method: 'POST', body: JSON.stringify(body) }),
  connectOnvifHost: (body) =>
    request('/api/onvif/connect', { method: 'POST', body: JSON.stringify(body) }),
  getOnvifStreamUri: (body) =>
    request('/api/onvif/stream-uri', { method: 'POST', body: JSON.stringify(body) }),
  recordingUrl: (recordingId) => `/api/recordings/${recordingId}`,
  deleteRecording: (recordingId) =>
    request(`/api/recordings/${encodeURIComponent(recordingId)}`, { method: 'DELETE' }),
  liveUrl: (cameraId) => `/live/${cameraId}/index.m3u8`,
};

/** Human-readable local date/time from an ISO string. */
export function formatLocalTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

/** Compact byte size for storage banners and timeline totals. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

/** m:ss or h:mm:ss for player controls. */
export function formatDuration(seconds) {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
