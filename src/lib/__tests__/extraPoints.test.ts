import { describe, it, expect, beforeEach } from 'vitest';
import { getExtraCargoPoints, saveExtraStep, allExtraCargoDone, readExtraProgress, isExtraPointDone } from '@/lib/extraPoints';

describe('extraPoints', () => {
  beforeEach(() => localStorage.clear());

  it('sorts extra cargo points by sequence', () => {
    const pts = getExtraCargoPoints({ extra_cargo_points: [{ sequence: 2 }, { sequence: 1 }] });
    expect(pts.map((p) => p.sequence)).toEqual([1, 2]);
  });

  it('next step stays locked until every extra cargo point is done', () => {
    const pts = getExtraCargoPoints({ extra_cargo_points: [{ sequence: 1 }, { sequence: 2 }] });
    saveExtraStep('OR1/01', 'cargo', 1, 'done');
    expect(allExtraCargoDone('OR1/01', pts)).toBe(false);
    saveExtraStep('OR1/01', 'cargo', 2, 'done');
    expect(allExtraCargoDone('OR1/01', pts)).toBe(true);
  });

  it('job without extra points is never blocked', () => {
    expect(allExtraCargoDone('OR2', getExtraCargoPoints({}))).toBe(true);
  });

  it('drop point is done only after the container is picked up again', () => {
    saveExtraStep('OR3', 'drop', 1, 'dropped');
    expect(isExtraPointDone('drop', readExtraProgress('OR3', 'drop', 1))).toBe(false);
    saveExtraStep('OR3', 'drop', 1, 'picked_up');
    expect(isExtraPointDone('drop', readExtraProgress('OR3', 'drop', 1))).toBe(true);
  });
});
