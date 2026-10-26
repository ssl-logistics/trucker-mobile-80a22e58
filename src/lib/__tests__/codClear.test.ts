import { describe, it, expect } from 'vitest';
import { filterPending, codOrdersFromCheckins, codAmountMatches } from '../codClear';

describe('codClear', () => {
  it('keeps only pending closed orders, skips cleared and missing COD', () => {
    const r = filterPending([
      { order_number: 'A', status: 'pending', order_status: 'closed', expected_total: 8200 },
      { order_number: 'B', status: 'cleared', order_status: 'closed' },
      null,
      { order_number: 'C', status: 'pending', order_status: 'in_progress' },
      { order_number: 'D', status: 'pending', order_status: 'completed' },
    ]);
    expect(r.map((x) => x.order_number)).toEqual(['A', 'D']);
  });

  it('collects orders with payment check-ins within 30 days', () => {
    const now = Date.parse('2026-10-24T00:00:00Z');
    const r = codOrdersFromCheckins([
      { checkin_type: 'payment', order_number: 'A', checked_in_at: '2026-10-20T00:00:00Z' },
      { checkin_type: 'payment', order_number: 'A', checked_in_at: '2026-10-21T00:00:00Z' },
      { checkin_type: 'pod', order_number: 'B', checked_in_at: '2026-10-21T00:00:00Z' },
      { checkin_type: 'payment', order_number: 'OLD', checked_in_at: '2026-08-01T00:00:00Z' },
    ], 30, now);
    expect(r).toEqual([{ order_number: 'A' }]);
  });

  it('detects COD on delivery check-ins and falls back to order id', () => {
    const now = Date.parse('2026-10-24T00:00:00Z');
    const r = codOrdersFromCheckins([
      { checkin_type: 'delivery', payment_method: 'cod', transport_order_id: 'id1', transport_orders: null, checked_in_at: '2026-10-23T00:00:00Z' },
      { checkin_type: 'delivery_confirmed', cod_proof_urls: ['x'], transport_order_id: 'id1', checked_in_at: '2026-10-23T00:00:00Z' },
      { checkin_type: 'delivery', payment_method: null, cod_proof_urls: null, transport_order_id: 'id2', checked_in_at: '2026-10-23T00:00:00Z' },
    ], 30, now);
    expect(r).toEqual([{ order_id: 'id1' }]);
  });

  it('confirm only when amount matches expected total', () => {
    expect(codAmountMatches('120.00', 120)).toBe(true);
    expect(codAmountMatches('100', 120)).toBe(false);
    expect(codAmountMatches('', 120)).toBe(false);
  });
});

import { summarizeCod } from '../codClear';
describe('summarizeCod', () => {
  const rec = (order_status: string) => ({ order_number: 'OR1', status: 'pending', order_status, expected_total: 1200,
    points: [{ amount: 500, sequence_number: 1 }, { amount: 700, sequence_number: 2 }] });
  const ci = (seq: number) => ({ order_number: 'OR1', checkin_type: 'delivery', payment_method: 'cod', destination_sequence_number: seq });
  it('partly collected: outstanding 700, cannot clear', () => {
    const s = summarizeCod(rec('completed'), [ci(1)]);
    expect([s.total, s.collected, s.outstanding, s.canClear, s.reason]).toEqual([1200, 500, 700, false, 'not_collected']);
  });
  it('all collected but job open: cannot clear', () => {
    expect(summarizeCod(rec('in_transit'), [ci(1), ci(2)]).reason).toBe('not_closed');
  });
  it('all collected and closed: can clear', () => {
    expect(summarizeCod(rec('completed'), [ci(1), ci(2)]).canClear).toBe(true);
  });
});

import { mergeCodSummaries } from '../codClear';
describe('mergeCodSummaries', () => {
  const s = (on: string, collected: number) => ({ record: { order_number: on, status: 'pending' }, total: 100, collected, outstanding: 100 - collected, points: [], closed: true, canClear: false, reason: 'not_collected' }) as any;
  it('fresh replaces cached, checked-but-cleared drops, unchecked stays', () => {
    const r = mergeCodSummaries([s('A', 0), s('B', 0), s('C', 0)], [s('A', 100)], new Set(['A', 'B']));
    expect(r.map((x) => [x.record.order_number, x.collected])).toEqual([['A', 100], ['C', 0]]);
  });
});

import { checkinsForDriver } from '../codClear';
describe('checkinsForDriver', () => {
  it("drops other drivers' check-ins", () => {
    const r = checkinsForDriver([{ freelance_driver_id: 'me', id: 1 }, { internal_driver_id: 'other', id: 2 }, { external_driver_id: 'me', id: 3 }], 'me');
    expect(r.map((x) => x.id)).toEqual([1, 3]);
  });
});

import { collectOrderRefs } from '../codClear';
describe('collectOrderRefs', () => {
  it('includes jobs without check-ins, dedupes, skips old', () => {
    const now = Date.parse('2026-10-26T00:00:00Z');
    const r = collectOrderRefs(
      [{ order_number: 'NEW', id: 'n1', created_at: '2026-10-25T00:00:00Z' }, { order_number: 'OLD', created_at: '2026-08-01T00:00:00Z' }],
      [{ order_number: 'NEW', created_at: '2026-10-25T00:00:00Z' }, { order_number: 'X', created_at: '2026-10-24T00:00:00Z' }], 30, now);
    expect(r).toEqual([{ order_number: 'NEW' }, { order_number: 'X' }]);
  });
  it('single-point COD with no sequence counts after delivery confirm', () => {
    const rec = { order_number: 'S', status: 'pending', order_status: 'in_transit', expected_total: 1, points: [{ amount: 1, sequence_number: null }] };
    expect(summarizeCod(rec, []).collected).toBe(0);
    expect(summarizeCod(rec, [{ order_number: 'S', checkin_type: 'delivery_confirmed' }]).collected).toBe(1);
  });
});
