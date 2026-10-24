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
    expect(r).toEqual(['A']);
  });
});
