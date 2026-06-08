/**
 * Multiview grid layout — fixed N×N slot counts (2×2 through 6×6).
 */

export const MULTIVIEW_GRID_SIZES = [2, 3, 4, 5, 6];
export const DEFAULT_MULTIVIEW_GRID_SIZE = 2;
export const STORAGE_KEY = 'onvif-dvr-multiview-grid-size';

export function normalizeMultiviewGridSize(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return DEFAULT_MULTIVIEW_GRID_SIZE;
  if (n < MULTIVIEW_GRID_SIZES[0]) return MULTIVIEW_GRID_SIZES[0];
  if (n > MULTIVIEW_GRID_SIZES[MULTIVIEW_GRID_SIZES.length - 1]) {
    return MULTIVIEW_GRID_SIZES[MULTIVIEW_GRID_SIZES.length - 1];
  }
  return n;
}

export function loadMultiviewGridSize() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MULTIVIEW_GRID_SIZE;
    return normalizeMultiviewGridSize(JSON.parse(raw));
  } catch {
    return DEFAULT_MULTIVIEW_GRID_SIZE;
  }
}

export function saveMultiviewGridSize(size) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMultiviewGridSize(size)));
  } catch {
    // ignore quota / private mode errors
  }
}

export function maxMultiviewSlots(gridSize) {
  const size = normalizeMultiviewGridSize(gridSize);
  return size * size;
}

/** Map selected camera IDs into a fixed N×N slot list (null = empty cell). */
export function buildMultiviewSlots(selectedIds, cameras, gridSize) {
  const max = maxMultiviewSlots(gridSize);
  const byId = new Map(cameras.map((camera) => [camera.id, camera]));
  const slots = [];

  for (let i = 0; i < max; i += 1) {
    const id = selectedIds[i];
    slots.push(id && byId.has(id) ? byId.get(id) : null);
  }

  return slots;
}

export function multiviewGridLabel(gridSize) {
  const size = normalizeMultiviewGridSize(gridSize);
  return `${size}×${size}`;
}
