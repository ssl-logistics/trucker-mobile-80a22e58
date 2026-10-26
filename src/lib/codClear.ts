import { getDriverCheckins, getDriverAssignedJobs, getFreelanceAcceptedJobs, getFactoryAssignedJobs } from '@/lib/externalApi';
import { supabase } from '@/integrations/supabase/client';

const CLOSED = new Set(['closed']);
export function isClosedStatus(s?: string | null) { return !!s && CLOSED.has(String(s).toLowerCase()); }
// Delivered-but-not-closed jobs may be cleared too (main system accepts them).
const CLEARABLE = new Set(['closed', 'completed', 'delivered']);
export function isClearableStatus(s?: string | null) { return !!s && CLEARABLE.has(String(s).toLowerCase()); }

export interface CodClearRecord {
  order_id?: string;
  order_number: string;
  order_status?: string;
  status: 'pending' | 'cleared' | string;
  expected_total?: number | null;
  cleared_amount?: number | null;
  proof_urls?: string[];
  cleared_at?: string | null;
  clear_method?: string | null;
  clear_reference?: string | null;
}

export type DriverType = 'internal' | 'external' | 'freelance';

/** Keep only closed orders still waiting to be cleared. */
export function filterPending(records: Array<CodClearRecord | null | undefined>): CodClearRecord[] {
  return records.filter(
    (r): r is CodClearRecord => !!r && r.status === 'pending' && isClearableStatus(r.order_status),
  );
}

/** Keep only check-ins made by this driver (the API may return other drivers' rows). */
export function checkinsForDriver(checkins: any[], driverId: string): any[] {
  const id = String(driverId);
  return (checkins || []).filter((c) => [c?.freelance_driver_id, c?.internal_driver_id, c?.external_driver_id, c?.driver_id]
    .some((v) => v != null && String(v) === id));
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
  const qs = new URLSearchParams({ ...params, _t: String(Date.now()) }).toString();
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
  clear_method?: 'cash' | 'static_qr' | 'mint_qr';
  clear_reference?: string;
}) {
  const { data, error } = await supabase.functions.invoke('cod-clear-proxy', { method: 'POST', body });
  if (error) {
    let msg = error.message;
    let j: any = null;
    try { const t = await (error as any).context?.text?.(); j = JSON.parse(t); } catch { /* noop */ }
    if (j) msg = codClearErrorMessage(j) || msg;
    return { data: j, error: { message: String(msg) } } as any;
  }
  if (data && (data as any).success === false) {
    return { data, error: { message: codClearErrorMessage(data) || 'failed' } } as any;
  }
  return { data, error: null } as any;
}

/** Human-readable reason from the main server's error body (plain string or zod fieldErrors). */
export function codClearErrorMessage(j: any): string {
  if (!j) return '';
  const e = j.error;
  if (typeof e === 'string') return e;
  if (e?.fieldErrors) {
    return Object.entries(e.fieldErrors as Record<string, string[]>)
      .map(([k, v]) => `${k}: ${(v || []).join(', ')}`).join(' · ');
  }
  return e?.message || j.message || '';
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
  const orders = codOrdersFromCheckins(checkinsForDriver(data?.data || [], driverId));
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

/** Entered amount equals the expected COD total (to 2 decimals). */
export function codAmountMatches(entered: string | number, expected?: number | null): boolean {
  if (entered === '' || entered == null || expected == null) return false;
  const a = Number(entered);
  if (!Number.isFinite(a)) return false;
  return Math.round(a * 100) === Math.round(Number(expected) * 100);
}

export interface CodPoint { name?: string; amount?: number | null; payment_method?: string | null; paid_method?: string | null; no_clear_needed?: boolean | null; sequence_number?: number | null; destination_id?: string | null }
export interface CodSummaryPoint extends CodPoint { collected: boolean; qr: boolean }
export type CodRecordFull = CodClearRecord & { points?: CodPoint[]; clear_required_total?: number | null; qr_paid_total?: number | null; no_clear_needed?: boolean | null };
export interface CodSummary {
  record: CodRecordFull;
  total: number; collected: number; outstanding: number;
  /** Paid by QR (already in company account) — counts as collected, no clear needed. */
  qrPaid: number;
  /** Cash amount the driver must clear. */
  clearRequired: number;
  noClearNeeded: boolean;
  points: CodSummaryPoint[]; closed: boolean; canClear: boolean;
  reason: 'ready' | 'not_collected' | 'not_closed';
}

const orderKeyOf = (c: any) => c?.transport_orders?.order_number || c?.order_number || c?.transport_order_id || '';
const isCollectCheckin = (c: any) => isCodCheckin(c) || ['payment', 'pod', 'delivery_confirmed'].includes(c?.checkin_type);
const isQrMethod = (m?: string | null) => !!m && m.toLowerCase() !== 'cash';

/** Per-order COD totals: a point counts as collected once a COD/payment check-in exists for it. */
export function summarizeCod(record: CodRecordFull, checkins: any[]): CodSummary {
  const mine = (checkins || []).filter((c) => {
    const k = orderKeyOf(c);
    return (k === record.order_number || (record.order_id && k === record.order_id)) && isCollectCheckin(c);
  });
  const raw: CodPoint[] = record.points?.length ? record.points : [{ amount: record.expected_total ?? 0, sequence_number: null }];
  const single = raw.length === 1;
  const points = raw.map((p) => {
    const qr = p.no_clear_needed != null ? !!p.no_clear_needed : isQrMethod(p.paid_method ?? p.payment_method);
    const hasCi = mine.some((c) => single || c.destination_sequence_number == null
      ? single : Number(c.destination_sequence_number) === Number(p.sequence_number));
    return { ...p, qr, collected: hasCi || p.no_clear_needed === true };
  });
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sum = (a: CodPoint[]) => r2(a.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const total = record.expected_total != null ? Number(record.expected_total) : sum(points);
  const collected = Math.min(total, sum(points.filter((p) => p.collected)));
  const outstanding = r2(total - collected);
  const qrPaid = record.qr_paid_total != null ? Number(record.qr_paid_total) : sum(points.filter((p) => p.qr && p.collected));
  const clearRequired = record.clear_required_total != null ? Number(record.clear_required_total) : sum(points.filter((p) => !p.qr));
  const noClearNeeded = record.no_clear_needed != null ? !!record.no_clear_needed : points.every((p) => p.qr && p.collected);
  const closed = isClosedStatus(record.order_status);
  const reason = outstanding > 0 ? 'not_collected' : !isClearableStatus(record.order_status) ? 'not_closed' : 'ready';
  return { record, total, collected, outstanding, qrPaid, clearRequired, noClearNeeded, points, closed, canClear: !noClearNeeded && reason === 'ready' && record.status === 'pending', reason };
}

const ALL_KEY = 'cod_summary_v1';
export function readSummaryCache(driverId: string): CodSummary[] | null {
  try { const c = JSON.parse(localStorage.getItem(ALL_KEY) || 'null'); if (c?.driverId === driverId) return c.items; } catch { /* noop */ }
  return null;
}

const JOB_STATUSES = 'accepted,arrived_at_pickup,pickup_checked_in,in_transit,delivery_checked_in,delivery_sop_completed,delivered,returning_container,at_container_return,container_returned,completed,closed';

/** Unique order refs from the driver's jobs + own check-ins, newest first, within `days`. */
export function collectOrderRefs(jobs: any[], ownCheckins: any[], days = 30, now = Date.now()): CodOrderRef[] {
  const cutoff = now - days * 86400000;
  const refs = new Map<string, CodOrderRef>();
  const add = (on?: string, id?: string, t?: string) => {
    const ts = new Date(t || 0).getTime();
    if (ts && ts < cutoff) return;
    const key = on || id;
    if (key && !refs.has(key) && !(id && refs.has(id))) refs.set(key, on ? { order_number: on } : { order_id: id });
  };
  for (const j of jobs || []) add(j?.order_number, j?.id, j?.updated_at || j?.created_at);
  for (const c of ownCheckins || []) add(c.transport_orders?.order_number || c.order_number, c.transport_order_id, c.checked_in_at || c.created_at);
  return [...refs.values()];
}

async function driverJobs(driverId: string, driverType: DriverType): Promise<any[]> {
  try {
    if (driverType === 'freelance') {
      const [a, f] = await Promise.all([
        getFreelanceAcceptedJobs(driverId).catch(() => null),
        getFactoryAssignedJobs(driverId, 50).catch(() => null),
      ]);
      return [...((a as any)?.data?.data || []), ...((f as any)?.data?.data || [])];
    }
    const r: any = await getDriverAssignedJobs(driverId, driverType, 200, JOB_STATUSES);
    return r?.data?.data || [];
  } catch { return []; }
}

/** Every COD order (open or closed, checked in or not) of this driver not yet cleared. */
export async function fetchCodSummaries(driverId: string, driverType: DriverType, onProgress?: (items: CodSummary[], checked: Set<string>) => void): Promise<CodSummary[]> {
  const [jobs, ci] = await Promise.all([
    driverJobs(driverId, driverType),
    getDriverCheckins(driverId, driverType, 'all', { allDrivers: true, limit: 5000 }).catch(() => ({ data: null, error: 'x' } as any)),
  ]);
  const allCi: any[] = ci?.data?.data || [];
  if (!jobs.length && ci?.error && !ci?.data) throw new Error('load failed');
  const list = collectOrderRefs(jobs, checkinsForDriver(allCi, driverId));
  const out: CodSummary[] = [];
  const seen = new Set<string>();
  const checked = new Set<string>();
  for (let i = 0; i < list.length; i += 10) {
    const slice = list.slice(i, i + 10);
    const res = await Promise.all(slice.map(async (r) => {
      const rec = await getCodClear(r).catch(() => null);
      if (!rec || (rec.status !== 'pending' && rec.status !== 'cleared')) return null;
      return summarizeCod(rec as any, allCi.filter((x: any) => (x.transport_orders?.order_number || x.order_number) === rec.order_number || (rec.order_id && x.transport_order_id === rec.order_id)).map((x: any) => ({ ...x, order_number: rec.order_number })));
    }));
    slice.forEach((r) => checked.add(String(r.order_number || r.order_id)));
    for (const s of res) if (s && !seen.has(s.record.order_number)) { seen.add(s.record.order_number); out.push(s); }
    onProgress?.([...out], checked);
  }
  try {
    localStorage.setItem(ALL_KEY, JSON.stringify({ driverId, items: out }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({ driverId, items: out.filter((s) => s.canClear).map((s) => s.record), at: Date.now() }));
  } catch { /* noop */ }
  return out;
}

/** While refreshing: orders already re-checked use fresh data (or drop if cleared); others keep cached values. */
export function mergeCodSummaries(cached: CodSummary[], fresh: CodSummary[], checkedKeys: Set<string>): CodSummary[] {
  const freshMap = new Map(fresh.map((s) => [s.record.order_number, s]));
  const out: CodSummary[] = [];
  for (const c of cached) {
    const k = c.record.order_number;
    if (freshMap.has(k)) { out.push(freshMap.get(k)!); freshMap.delete(k); }
    else if (!checkedKeys.has(k) && !checkedKeys.has(String(c.record.order_id || ''))) out.push(c);
  }
  return [...out, ...freshMap.values()];
}

/** Split summaries into not-yet-cleared and cleared lists. */
export function splitCodSummaries(list: CodSummary[]): { pending: CodSummary[]; cleared: CodSummary[] } {
  return {
    pending: list.filter((s) => s.record.status !== 'cleared' && !s.noClearNeeded),
    cleared: list.filter((s) => s.record.status === 'cleared' || s.noClearNeeded),
  };
}

/** Mark an order as cleared locally right after a successful clear. */
export function markCleared(s: CodSummary, amount: number, proofUrls: string[], at = new Date().toISOString()): CodSummary {
  return { ...s, canClear: false, record: { ...s.record, status: 'cleared', cleared_amount: amount, proof_urls: proofUrls, cleared_at: at } };
}

export function removeFromCodCache(driverId: string, orderNumber: string) {
  try {
    const a = readSummaryCache(driverId);
    if (a) localStorage.setItem(ALL_KEY, JSON.stringify({ driverId, items: a.filter((s) => s.record.order_number !== orderNumber) }));
    const p = readPendingCache(driverId);
    if (p) localStorage.setItem(CACHE_KEY, JSON.stringify({ driverId, items: p.filter((r) => r.order_number !== orderNumber), at: Date.now() }));
  } catch { /* noop */ }
}

/** Extra POST fields per clear tab: slip tab sends nothing new; Mint QR sends method + Mint payment_id as reference. */
export function clearMethodFields(tab: 'slip' | 'mint_qr', mintPaymentId?: string | null): { clear_method?: 'mint_qr'; clear_reference?: string } {
  if (tab !== 'mint_qr' || !mintPaymentId) return {};
  return { clear_method: 'mint_qr', clear_reference: String(mintPaymentId).slice(0, 200) };
}
