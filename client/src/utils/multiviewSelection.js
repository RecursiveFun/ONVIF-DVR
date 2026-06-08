/**
 * Which cameras appear in multiview grid mode.
 * Selection is persisted and pruned when cameras are removed.
 */

export const STORAGE_KEY = 'onvif-dvr-multiview-cameras';

export function normalizeMultiviewIds(ids, cameraIds) {
  const allowed = new Set(cameraIds);
  if (!Array.isArray(ids)) return cameraIds.filter((id) => allowed.has(id));

  const seen = new Set();
  const next = [];
  for (const id of ids) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function loadMultiviewIds(cameraIds) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...cameraIds];
    const parsed = JSON.parse(raw);
    const normalized = normalizeMultiviewIds(parsed, cameraIds);
    return normalized.length > 0 ? normalized : [...cameraIds];
  } catch {
    return [...cameraIds];
  }
}

export function saveMultiviewIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode errors
  }
}

/** Always keep at least one camera visible — do not allow deselecting the last tile. */
export function toggleMultiviewId(ids, cameraId) {
  if (ids.includes(cameraId)) {
    const next = ids.filter((id) => id !== cameraId);
    return next.length > 0 ? next : ids;
  }
  return [...ids, cameraId];
}

export function removeMultiviewId(ids, cameraId) {
  return ids.filter((id) => id !== cameraId);
}
