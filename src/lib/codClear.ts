import { callExternalApi, getDriverCheckins } from '@/lib/externalApi';

export interface CodClearRecord {
  order_id?: string;
  order_number: string;
  order_status?: string;
  status: 'pending' | 'cleared' | string;
  expected_total?: number | null;
  cleared_amount?: number | null;
  proof_urls?: string[];
  cleared_at?: string | null;
}

export type DriverType = 'internal' | 'external' | 'freelance';

/** Keep only closed orders still waiting to be cleared. */
export function filterPending(records: Array<CodClearRecord | null | undefined>): CodClearRecord[] {
  return records.filter(
    (r): r is CodClearRecord => !!r && r.status === 'pending' && (!r.order_status || r.order_status === 'closed'),
  );
}

/** Order numbers that had a COD payment check-in in the last `days` days. */
export function codOrdersFromCheckins(checkins: any[], days = 30, now = Date.now()): string[] {
  const cutoff = now - days * 86400000;
  const set = new Set<string>();
  for (const c of checkins || []) {
    if (c?.checkin_type !== 'payment') continue;
    const t = new Date(c.checked_in_at || c.created_at || 0).getTime();
    if (t && t < cutoff) continue;
    const on = c.transport_orders?.order_number || c.order_number;
    if (on) set.add(on);
  }
  return [...set];
}

export async function getCodClear(orderNumber: string): Promise<CodClearRecord | null> {
  const { data } = await callExternalApi<{ success?: boolean; data?: CodClearRecord }>('driver-cod-clear', {
    params: { order_number: orderNumber },
  });
  return data?.data ?? null; // 404 COD_NOT_FOUND → no data.data → skipped
}

export async function submitCodClear(body: {
  order_number: string;
  amount?: number;
  notes?: string;
  proof_urls: string[];
  driver_type?: DriverType;
  driver_id?: string;
}) {
  return callExternalApi<any>('driver-cod-clear', { method: 'POST', body });
}

const CACHE_KEY = 'cod_clear_pending_v1';

export function readPendingCache(driverId: string): CodClearRecord[] | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.driverId === driverId) return c.items;
  } catch { /* noop */ }
  return null;
}

export async function fetchPendingCodClears(driverId: string, driverType: DriverType): Promise<CodClearRecord[]> {
  const { data } = await getDriverCheckins(driverId, driverType, 'all', { limit: 2000 });
  const orders = codOrdersFromCheckins(data?.data || []);
  const results: Array<CodClearRecord | null> = [];
  for (let i = 0; i < orders.length; i += 5) {
    const chunk = await Promise.all(orders.slice(i, i + 5).map((o) => getCodClear(o).catch(() => null)));
    results.push(...chunk);
  }
  const pending = filterPending(results);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ driverId, items: pending, at: Date.now() })); } catch { /* noop */ }
  return pending;
}
