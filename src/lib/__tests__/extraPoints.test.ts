import { describe, it, expect } from 'vitest';
import { getExtraCargoPoints, getExtraDropPoints } from '@/lib/extraPoints';

describe('extraPoints', () => {
  it('sorts extra cargo points by sequence', () => {
    const pts = getExtraCargoPoints({ extra_cargo_points: [{ sequence: 2 }, { sequence: 1 }] });
    expect(pts.map((p) => p.sequence)).toEqual([1, 2]);
  });

  it('job without extra points shows none', () => {
    expect(getExtraCargoPoints({})).toEqual([]);
    expect(getExtraDropPoints({})).toEqual([]);
  });
});
