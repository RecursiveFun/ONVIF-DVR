import { describe, expect, it } from 'vitest';
import {
  normalizeMultiviewIds,
  removeMultiviewId,
  toggleMultiviewId,
} from './multiviewSelection.js';

describe('multiviewSelection', () => {
  it('keeps only known camera ids in order', () => {
    expect(normalizeMultiviewIds(['cam-2', 'cam-1', 'cam-2'], ['cam-1', 'cam-2', 'cam-3']))
      .toEqual(['cam-2', 'cam-1']);
  });

  it('toggles ids without removing the last camera', () => {
    expect(toggleMultiviewId(['cam-1', 'cam-2'], 'cam-2')).toEqual(['cam-1']);
    expect(toggleMultiviewId(['cam-1'], 'cam-1')).toEqual(['cam-1']);
    expect(toggleMultiviewId(['cam-1'], 'cam-2')).toEqual(['cam-1', 'cam-2']);
  });

  it('removes a camera id from multiview', () => {
    expect(removeMultiviewId(['cam-1', 'cam-2'], 'cam-1')).toEqual(['cam-2']);
    expect(removeMultiviewId(['cam-1'], 'cam-1')).toEqual([]);
  });
});
