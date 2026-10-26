export interface KpiRow {
  kpi_date: string;
  total_orders?: number;
  company_total_orders?: number;
  open_orders?: number;
  open_order_numbers?: string[];
  location_checked?: number;
  location_passed?: number;
  location_pass_pct?: number | null;
  time_checked?: number;
  time_passed?: number;
  time_pass_pct?: number | null;
  load_pct?: number | null;
}

const pct = (p: number, c: number) => (c > 0 ? Math.round((p / c) * 10000) / 100 : null);

/** Sums passed/checked across days so multi-day % is weighted by points, not averaged per day. */
export function aggregateKpi(rows: KpiRow[]) {
  const s = { locC: 0, locP: 0, timeC: 0, timeP: 0, orders: 0, company: 0 };
  for (const r of rows) {
    s.locC += r.location_checked || 0; s.locP += r.location_passed || 0;
    s.timeC += r.time_checked || 0; s.timeP += r.time_passed || 0;
    s.orders += r.total_orders || 0; s.company += r.company_total_orders || 0;
  }
  const latest = [...rows].sort((a, b) => b.kpi_date.localeCompare(a.kpi_date))[0];
  return {
    location: { pct: pct(s.locP, s.locC), passed: s.locP, checked: s.locC },
    time: { pct: pct(s.timeP, s.timeC), passed: s.timeP, checked: s.timeC },
    load: { pct: pct(s.orders, s.company), orders: s.orders, company: s.company },
    openOrders: latest?.open_order_numbers || [],
  };
}

export const kpiTone = (p: number | null) => (p == null ? 'none' : p >= 80 ? 'good' : p >= 50 ? 'mid' : 'bad');

export const bangkokDay = (t: number) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
export const isSameBangkokDay = (a: number, b: number) => bangkokDay(a) === bangkokDay(b);
export const kpiCacheKey = (who: string, range: number) => `kpiCache:${who}:${range}`;
export const overallPct = (a: number | null, b: number | null) => {
  const v = [a, b].filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100) / 100 : null;
};
