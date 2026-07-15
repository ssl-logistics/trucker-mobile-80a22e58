// Client-side helper to look up (or auto-recreate) the tracking room for an order.
// Wraps the `get-tracking-room` edge function with 3-tier fallback and caches results in memory.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface RoomLookupOptions {
  // Optional fallback data used only if the room must be recreated (Tier 3)
  truck_plate?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  current_lat?: number;
  current_lng?: number;
  waypoints?: Array<{ lat: number; lng: number }>;
}

export interface RoomLookupResult {
  roomCode: string;
  source: string;
  tier: number;
}

const cache = new Map<string, string>();

export function clearRoomCache(orderCode?: string) {
  if (orderCode) cache.delete(orderCode);
  else cache.clear();
}

export function getCachedRoomCode(orderCode: string): string | undefined {
  return cache.get(orderCode);
}

export async function getRoomCodeForOrder(
  orderCode: string,
  opts: RoomLookupOptions = {},
): Promise<RoomLookupResult | null> {
  if (!orderCode) return null;

  // In-memory cache (session-scoped)
  const cached = cache.get(orderCode);
  if (cached) return { roomCode: cached, source: 'cache', tier: 0 };

  // Legacy localStorage fallback (fast-path for old app data)
  try {
    const legacy = localStorage.getItem(`room_code_${orderCode}`);
    if (legacy) {
      cache.set(orderCode, legacy);
      // fire-and-forget: sync to DB via edge (non-blocking) so future lookups hit Tier 1
      fetch(`${SUPABASE_URL}/functions/v1/get-tracking-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          order_number: orderCode,
          driver_id: localStorage.getItem('auth_driver_id') || undefined,
          ...opts,
        }),
        keepalive: true,
      }).catch(() => {});
      return { roomCode: legacy, source: 'localStorage', tier: 0 };
    }
  } catch {}

  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-tracking-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        order_number: orderCode,
        driver_id: localStorage.getItem('auth_driver_id') || undefined,
        ...opts,
      }),
    });
    const data = await resp.json().catch(() => ({} as any));
    if (resp.ok && data?.room_code) {
      cache.set(orderCode, data.room_code);
      try {
        localStorage.setItem(`room_code_${orderCode}`, data.room_code);
      } catch {}
      return {
        roomCode: data.room_code,
        source: data.source || 'unknown',
        tier: data.tier ?? 1,
      };
    }
    console.warn('[trackingRoomLookup] not found', orderCode, resp.status, data);
    return null;
  } catch (e) {
    console.warn('[trackingRoomLookup] error', orderCode, e);
    return null;
  }
}
