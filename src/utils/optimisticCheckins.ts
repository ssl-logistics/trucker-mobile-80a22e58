/**
 * Optimistic Check-in Cache
 *
 * Why: External API `get-driver-checkins` has a server-side hard cap of ~1000 rows
 * and ignores `order_number` filter when `allDrivers=true`, so a check-in that the
 * driver just performed may not appear in the next fetch (it falls outside the
 * first 1000 records). To keep the UI consistent with the user's action, we
 * cache the freshly-created check-ins locally for a short TTL and merge them
 * into the API response in `DomesticJobDetail`.
 *
 * Storage: localStorage (key `optimistic_checkins_v1`), per-user is not required
 * because each device == one driver in this app.
 *
 * TTL: 30 minutes — long enough to outlast the API replication lag, short enough
 * that a stale optimistic record can't permanently mask a deletion.
 */

const STORAGE_KEY = 'optimistic_checkins_v1';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface OptimisticCheckin {
  order_number: string;
  checkin_type: string; // e.g. 'pickup', 'delivery', 'delivery_confirmed', 'delivery_2', 'container_pickup_confirmed', ...
  destination_sequence_number?: number;
  checked_in_at: string; // ISO
  created_at: string; // ISO (mirrors API shape)
  _optimistic: true;
  _savedAt: number; // epoch ms — for TTL eviction
}

function readAll(): OptimisticCheckin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(items: OptimisticCheckin[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function prune(items: OptimisticCheckin[]): OptimisticCheckin[] {
  const now = Date.now();
  return items.filter((it) => now - (it._savedAt || 0) < TTL_MS);
}

/**
 * Add an optimistic check-in record for an order.
 * Call this **immediately after** a successful `driverCheckin()` POST.
 */
export function addOptimisticCheckin(params: {
  orderNumber: string;
  checkinType: string;
  destinationSequenceNumber?: number;
}) {
  if (!params.orderNumber || !params.checkinType) return;
  const nowIso = new Date().toISOString();
  const record: OptimisticCheckin = {
    order_number: params.orderNumber,
    checkin_type: params.checkinType,
    destination_sequence_number: params.destinationSequenceNumber,
    checked_in_at: nowIso,
    created_at: nowIso,
    _optimistic: true,
    _savedAt: Date.now(),
  };
  const next = prune(readAll());
  // Replace any existing record matching the same (order, type, seq) to avoid duplicates
  const filtered = next.filter(
    (r) =>
      !(
        r.order_number === record.order_number &&
        r.checkin_type === record.checkin_type &&
        (r.destination_sequence_number ?? null) === (record.destination_sequence_number ?? null)
      )
  );
  filtered.push(record);
  writeAll(filtered);
}

/** Get all non-expired optimistic check-ins for a given order_number. */
export function getOptimisticCheckins(orderNumber: string): OptimisticCheckin[] {
  if (!orderNumber) return [];
  const fresh = prune(readAll());
  // Persist pruned list opportunistically
  writeAll(fresh);
  return fresh.filter((r) => r.order_number === orderNumber);
}

/** Clear optimistic records for an order — call when API confirms the data round-trip. */
export function clearOptimisticCheckins(orderNumber: string) {
  if (!orderNumber) return;
  const next = prune(readAll()).filter((r) => r.order_number !== orderNumber);
  writeAll(next);
}
