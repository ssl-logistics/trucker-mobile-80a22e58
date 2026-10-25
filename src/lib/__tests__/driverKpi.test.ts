import { describe, it, expect } from 'vitest';
import { aggregateKpi, kpiTone } from '../driverKpi';

describe('aggregateKpi', () => {
  it('weights % by points across days', () => {
    const a = aggregateKpi([
      { kpi_date: '2026-10-23', location_checked: 6, location_passed: 5, time_checked: 2, time_passed: 1, total_orders: 3, company_total_orders: 20 },
      { kpi_date: '2026-10-24', location_checked: 4, location_passed: 4, time_checked: 0, time_passed: 0, total_orders: 1, company_total_orders: 20, open_order_numbers: ['X'] },
    ]);
    expect(a.location.pct).toBe(90);
    expect(a.time.pct).toBe(50);
    expect(a.load.pct).toBe(10);
    expect(a.openOrders).toEqual(['X']);
  });
  it('null when nothing to compare', () => {
    expect(aggregateKpi([{ kpi_date: '2026-10-24' }]).time.pct).toBeNull();
  });
  it('tone thresholds', () => {
    expect([kpiTone(80), kpiTone(50), kpiTone(49), kpiTone(null)]).toEqual(['good', 'mid', 'bad', 'none']);
  });
});
