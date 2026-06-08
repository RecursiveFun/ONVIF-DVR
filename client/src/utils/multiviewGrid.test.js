import { describe, expect, it } from 'vitest';
import {
  buildMultiviewSlots,
  maxMultiviewSlots,
  multiviewGridLabel,
  normalizeMultiviewGridSize,
} from './multiviewGrid.js';

const cameras = [
  { id: 'cam-1', name: 'Front' },
  { id: 'cam-2', name: 'Garage' },
  { id: 'cam-3', name: 'Back' },
];

describe('multiviewGrid', () => {
  it('normalizes grid size to supported bounds', () => {
    expect(normalizeMultiviewGridSize(3)).toBe(3);
    expect(normalizeMultiviewGridSize(1)).toBe(2);
    expect(normalizeMultiviewGridSize(9)).toBe(6);
    expect(normalizeMultiviewGridSize('4')).toBe(4);
    expect(normalizeMultiviewGridSize(null)).toBe(2);
  });

  it('computes slot counts and labels', () => {
    expect(maxMultiviewSlots(3)).toBe(9);
    expect(multiviewGridLabel(4)).toBe('4×4');
  });

  it('builds fixed slots with empty cells', () => {
    expect(buildMultiviewSlots(['cam-1'], cameras, 2)).toEqual([
      cameras[0],
      null,
      null,
      null,
    ]);
    expect(buildMultiviewSlots(['cam-1', 'cam-2', 'cam-3'], cameras, 2)).toEqual([
      cameras[0],
      cameras[1],
      cameras[2],
      null,
    ]);
  });
});
