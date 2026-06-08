import fs from 'fs';
import path from 'path';
import { assertUnderBrowseRoots, getBrowseAllowRoots } from './security.js';
import { DEFAULT_RECORDINGS_DIR } from './settings.js';

function isWindowsDriveRoot(resolved) {
  return process.platform === 'win32' && /^[A-Z]:\\$/i.test(resolved);
}

export function resolveBrowsePath(input) {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  const resolved = trimmed
    ? path.resolve(trimmed)
    : path.resolve(DEFAULT_RECORDINGS_DIR);
  return assertUnderBrowseRoots(resolved);
}

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
