import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { DATA_DIR } from './settings.js';
import { listDirectory, listRoots, resolveBrowsePath } from './fsBrowser.js';

const tempRoot = fs.mkdtempSync(path.join(DATA_DIR, 'fs-browser-'));
const childDir = path.join(tempRoot, 'nested');

before(() => {
  fs.mkdirSync(childDir, { recursive: true });
});

after(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('fsBrowser', () => {
  it('resolves browse paths', () => {
    assert.equal(resolveBrowsePath(tempRoot), path.resolve(tempRoot));
  });

  it('lists child directories', () => {
    const listing = listDirectory(tempRoot);
    assert.equal(listing.path, path.resolve(tempRoot));
    assert.ok(listing.entries.some((entry) => entry.name === 'nested'));
    assert.equal(listing.entries.find((entry) => entry.name === 'nested').path, path.resolve(childDir));
  });

  it('returns roots including project folders', () => {
    const roots = listRoots();
    assert.ok(roots.length >= 2);
    assert.ok(roots.some((root) => /recordings/i.test(root.label)));
  });

  it('rejects missing folders', () => {
    assert.throws(
      () => listDirectory(path.join(tempRoot, 'missing-folder')),
      /not found/i,
    );
  });
});
