// Shared helper to UPSERT tracking room records for orders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type TrackingRoomSource =
  | 'created'
  | 'idempotent_409'
  | 'external_lookup'
  | 'recreated'
  | 'server_freelance'
  | 'backfill_audit';

export interface TrackingRoomRecord {
  order_number: string;
  room_code: string;
  truck_plate?: string | null;
  driver_id?: string | null;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  source: TrackingRoomSource;
  status?: string;
}

function getClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function upsertTrackingRoom(rec: TrackingRoomRecord): Promise<void> {
  try {
    if (!rec.order_number || !rec.room_code) return;
    const sb = getClient();
    if (!sb) return;
    const { error } = await sb
      .from('order_tracking_rooms')
      .upsert({
        order_number: rec.order_number,
        room_code: rec.room_code,
        truck_plate: rec.truck_plate ?? null,
        driver_id: rec.driver_id ?? null,
        origin_lat: rec.origin_lat ?? null,
        origin_lng: rec.origin_lng ?? null,
        destination_lat: rec.destination_lat ?? null,
        destination_lng: rec.destination_lng ?? null,
        source: rec.source,
        status: rec.status ?? 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'order_number' });
    if (error) console.warn('[trackingRoomStore] upsert failed:', error.message);
  } catch (e) {
    console.warn('[trackingRoomStore] exception:', e instanceof Error ? e.message : String(e));
  }
}

export async function getTrackingRoomByOrder(orderNumber: string): Promise<TrackingRoomRecord | null> {
  try {
    const sb = getClient();
    if (!sb) return null;
    const { data, error } = await sb
      .from('order_tracking_rooms')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (error) {
      console.warn('[trackingRoomStore] select failed:', error.message);
      return null;
    }
    return (data as TrackingRoomRecord) ?? null;
  } catch (e) {
    console.warn('[trackingRoomStore] select exception:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
