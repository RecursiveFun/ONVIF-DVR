/**
 * Safe filesystem browser for choosing a recordings directory in the UI.
 *
 * All paths are resolved and validated against browse roots defined in
 * `security.js` before any directory listing is returned.
 */
import fs from 'fs';
import path from 'path';
import { assertUnderBrowseRoots, getBrowseAllowRoots } from './security.js';
import { DEFAULT_RECORDINGS_DIR } from './settings.js';

function isWindowsDriveRoot(resolved) {
  return process.platform === 'win32' && /^[A-Z]:\\$/i.test(resolved);
}

/**
 * Resolve a user-supplied path (or the default recordings dir) and ensure it
 * lies under an allowed browse root.
 * @param {string} [input] Absolute or relative folder path from the client.
 * @returns {string} Normalized absolute path safe to list.
 */
export function resolveBrowsePath(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  const resolved = trimmed
    ? path.resolve(trimmed)
    : path.resolve(DEFAULT_RECORDINGS_DIR);
  return assertUnderBrowseRoots(resolved);
}

/**
 * Return labeled browse roots the UI can offer as quick navigation shortcuts.
 * @returns {{ label: string, path: string }[]}
 */
export function listRoots() {
  return getBrowseAllowRoots().map((rootPath) => {
    if (rootPath.endsWith(`${path.sep}recordings`) || /recordings$/i.test(rootPath)) {
      return { label: 'Default recordings', path: rootPath };
    }
    if (rootPath.endsWith(`${path.sep}data`) || /[\\/]data$/i.test(rootPath)) {
      return { label: 'Project data', path: rootPath };
    }
    return { label: 'Home', path: rootPath };
  });
}

/**
 * List child directories under a validated path for the folder picker.
 * @param {string} [inputPath] Folder to list; defaults to the recordings directory.
 * @returns {{ path: string, parent: string | null, entries: { name: string, path: string }[] }}
 */
export function listDirectory(inputPath) {
  const resolved = resolveBrowsePath(inputPath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error('Folder not found');
  }
  if (!stat.isDirectory()) {
    throw new Error('Not a folder');
  }

  const entries = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.' || entry.name === '..') continue;
    const childPath = path.join(resolved, entry.name);
    assertUnderBrowseRoots(childPath);
    entries.push({
      name: entry.name,
      path: childPath,
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const parent = path.dirname(resolved);
  const atRoot = parent === resolved || isWindowsDriveRoot(resolved);
  let safeParent = null;
  if (!atRoot) {
    try {
      safeParent = assertUnderBrowseRoots(parent);
    } catch {
      safeParent = null;
    }
  }

  return {
    path: resolved,
    parent: safeParent,
    entries,
  };
}

