import { describe, it, expect } from 'vitest';
import { filterPending, codOrdersFromCheckins, codAmountMatches, clearMethodFields } from '../codClear';

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
    expect(summarizeCod(rec('closed'), [ci(1), ci(2)]).canClear).toBe(true);
    expect(summarizeCod(rec('completed'), [ci(1), ci(2)]).canClear).toBe(true);
    expect(summarizeCod(rec('delivered'), [ci(1), ci(2)]).canClear).toBe(true);
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

import { splitCodSummaries, markCleared } from '@/lib/codClear';
describe('splitCodSummaries', () => {
  const mk = (on: string, status: string) => ({ record: { order_number: on, status }, total: 1, collected: 1, outstanding: 0, points: [], closed: true, canClear: status === 'pending', reason: 'ready' } as any);
  it('separates pending and cleared orders', () => {
    const r = splitCodSummaries([mk('A', 'pending'), mk('B', 'cleared'), mk('C', 'pending')]);
    expect(r.pending.map((s) => s.record.order_number)).toEqual(['A', 'C']);
    expect(r.cleared.map((s) => s.record.order_number)).toEqual(['B']);
  });
  it('a just-cleared order moves to cleared and can no longer be cleared', () => {
    const c = markCleared(mk('A', 'pending'), 120, ['u']);
    const r = splitCodSummaries([c]);
    expect(r.pending).toHaveLength(0);
    expect(r.cleared[0].canClear).toBe(false);
    expect(r.cleared[0].record.cleared_amount).toBe(120);
  });
});

describe('QR-paid points need no clearing', () => {

  it('all-QR order needs no clear and counts as collected', () => {
    const s = summarizeCod({ order_number: 'A', status: 'pending', order_status: 'closed', expected_total: 2, qr_paid_total: 2, clear_required_total: 0, no_clear_needed: true,
      points: [{ sequence_number: 1, amount: 2, payment_method: 'qr', paid_method: 'mint_qr', no_clear_needed: true }] }, []);
    expect(s.canClear).toBe(false); expect(s.collected).toBe(2); expect(s.qrPaid).toBe(2);
    expect(splitCodSummaries([s]).pending.length).toBe(0);
  });
  it('mixed order clears only the cash amount', () => {
    const s = summarizeCod({ order_number: 'B', status: 'pending', order_status: 'closed', expected_total: 3, qr_paid_total: 2, clear_required_total: 1, no_clear_needed: false,
      points: [{ sequence_number: 1, amount: 1, payment_method: 'cash', paid_method: 'cash', no_clear_needed: false }, { sequence_number: 2, amount: 2, payment_method: 'qr', paid_method: 'mint_qr', no_clear_needed: true }] },
      [{ order_number: 'B', checkin_type: 'payment', destination_sequence_number: 1 }]);
    expect(s.clearRequired).toBe(1); expect(s.qrPaid).toBe(2); expect(s.collected).toBe(3); expect(s.canClear).toBe(true);
  });
});

describe('clear method fields', () => {
  it('slip tab sends no clear_method', () => { expect(clearMethodFields('slip', 'x')).toEqual({}); });
  it('mint tab sends Mint payment_id as clear_reference', () => {
    expect(clearMethodFields('mint_qr', '33962211-e2e7-43ad-b76f-d206b282f642')).toEqual({ clear_method: 'mint_qr', clear_reference: '33962211-e2e7-43ad-b76f-d206b282f642' });
  });
  it('mint tab before payment sends nothing', () => { expect(clearMethodFields('mint_qr', null)).toEqual({}); });
});

describe('QR billed but paid cash', () => {
  it('counts the stop as cash to clear and flags mismatch', async () => {
    const { summarizeCod } = await import('../codClear');
    const s = summarizeCod({ order_number: 'OR1', status: 'pending', order_status: 'delivered', expected_total: 100,
      points: [{ amount: 100, payment_method: 'qr', sequence_number: 1 }] } as any,
      [{ order_number: 'OR1', checkin_type: 'payment', cod_method: 'cash' }]);
    expect(s.points[0].methodMismatch).toBe(true);
    expect(s.clearRequired).toBe(100);
    expect(s.noClearNeeded).toBe(false);
  });
});
