import { describe, it, expect } from 'vitest';
import { filterPending, codOrdersFromCheckins } from '../codClear';

describe('codClear', () => {
  it('keeps only pending closed orders, skips cleared and missing COD', () => {
    const r = filterPending([
      { order_number: 'A', status: 'pending', order_status: 'closed', expected_total: 8200 },
      { order_number: 'B', status: 'cleared', order_status: 'closed' },
      null,
      { order_number: 'C', status: 'pending', order_status: 'in_progress' },
    ]);
    expect(r.map((x) => x.order_number)).toEqual(['A']);
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
});
