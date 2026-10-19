import { describe, it, expect } from 'vitest';
import { getExtraCargoPoints, getExtraDropPoints, allDropsPickedUp, allExtraCargoDone, dropState } from '@/lib/extraPoints';

describe('extraPoints', () => {
  it('sorts extra cargo points by sequence', () => {
    const pts = getExtraCargoPoints({ extra_cargo_points: [{ sequence: 2 }, { sequence: 1 }] });
    expect(pts.map((p) => p.sequence)).toEqual([1, 2]);
  });

  it('job without extra points is never locked', () => {
    expect(getExtraCargoPoints({})).toEqual([]);
    expect(getExtraDropPoints({})).toEqual([]);
    expect(allDropsPickedUp([], [])).toBe(true);
    expect(allExtraCargoDone([], [])).toBe(true);
  });

  it('dropped but not picked up locks the main cargo point', () => {
    const pts = [{ sequence: 1 }];
    const ck = [{ checkin_type: 'extra_drop', destination_sequence_number: 1 }];
    expect(dropState(pts[0], ck)).toBe('dropped');
    expect(allDropsPickedUp(pts, ck)).toBe(false);
  });

  it('picked up again unlocks the main cargo point', () => {
    const ck = [
      { checkin_type: 'extra_drop', destination_sequence_number: 1 },
      { checkin_type: 'extra_drop_pickup', destination_sequence_number: 1 },
    ];
    expect(allDropsPickedUp([{ sequence: 1 }], ck)).toBe(true);
    expect(allDropsPickedUp([{ sequence: 1, status: 'picked_up' }], [])).toBe(true);
  });

  it('extra cargo not completed locks container return', () => {
    const pts = [{ sequence: 1 }, { sequence: 2 }];
    expect(allExtraCargoDone(pts, [{ checkin_type: 'extra_cargo', destination_sequence_number: 1 }])).toBe(false);
    expect(allExtraCargoDone(pts, [
      { checkin_type: 'extra_cargo', destination_sequence_number: 1 },
      { checkin_type: 'extra_cargo', extra_point_sequence: 2 },
    ])).toBe(true);
  });
});
