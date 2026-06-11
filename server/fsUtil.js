/**
 * Filesystem helpers shared across storage and per-camera data modules.
 */
import fs from 'fs';
import path from 'path';

/** Recursive byte total for all files under `dir` (missing dirs return 0). */
export function getDirectorySizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;

  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySizeBytes(full);
    } else if (entry.isFile()) {
      try {
        total += fs.statSync(full).size;
      } catch {
        // ignore unreadable files and races with writers
      }
    }
  }
  return total;
}
