import { getDriverCheckins } from '@/lib/externalApi';
import { supabase } from '@/integrations/supabase/client';

const CLOSED = new Set(['closed', 'completed', 'delivered']);
export function isClosedStatus(s?: string | null) { return !s || CLOSED.has(String(s).toLowerCase()); }

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
    (r): r is CodClearRecord => !!r && r.status === 'pending' && isClosedStatus(r.order_status),
  );
}

export function isCodCheckin(c: any): boolean {
  if (!c) return false;
  return c.checkin_type === 'payment' || String(c.payment_method || '').toLowerCase() === 'cod'
    || (Array.isArray(c.cod_proof_urls) && c.cod_proof_urls.length > 0);
}

export type CodOrderRef = { order_number?: string; order_id?: string };

/** Orders (by number, else by id) that had a COD check-in in the last `days` days. */
export function codOrdersFromCheckins(checkins: any[], days = 30, now = Date.now()): CodOrderRef[] {
  const cutoff = now - days * 86400000;
  const map = new Map<string, CodOrderRef>();
  for (const c of checkins || []) {
    if (!isCodCheckin(c)) continue;
    const t = new Date(c.checked_in_at || c.created_at || 0).getTime();
    if (t && t < cutoff) continue;
    const on = c.transport_orders?.order_number || c.order_number;
    const id = c.transport_order_id;
    const key = on || id;
    if (!key || map.has(key)) continue;
    map.set(key, on ? { order_number: on } : { order_id: id });
  }
  return [...map.values()];
}

export async function getCodClear(ref: string | CodOrderRef): Promise<CodClearRecord | null> {
  const params: Record<string, string> = typeof ref === 'string'
    ? { order_number: ref }
    : ref.order_number ? { order_number: ref.order_number } : { order_id: String(ref.order_id) };
  const qs = new URLSearchParams(params).toString();
  const { data, error } = await supabase.functions.invoke(`cod-clear-proxy?${qs}`, { method: 'GET' });
  if (error) return null; // 404 COD_NOT_FOUND etc.
  return (data as any)?.data ?? null; // 404 COD_NOT_FOUND → no data.data → skipped
}

export async function submitCodClear(body: {
  order_number: string;
  amount?: number;
  notes?: string;
  proof_urls: string[];
  driver_type?: DriverType;
  driver_id?: string;
}) {
  const { data, error } = await supabase.functions.invoke('cod-clear-proxy', { method: 'POST', body });
  if (error) {
    let msg = error.message;
    try { const t = await (error as any).context?.text?.(); const j = JSON.parse(t); msg = j?.error?.message || j?.message || j?.error || msg; } catch { /* noop */ }
    return { data: null, error: { message: String(msg) } } as any;
  }
  return { data, error: null } as any;
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
  const seen = new Set<string>();
  const pending = filterPending(results).filter((r) => {
    const k = r.order_number || r.order_id || '';
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ driverId, items: pending, at: Date.now() })); } catch { /* noop */ }
  return pending;
}
