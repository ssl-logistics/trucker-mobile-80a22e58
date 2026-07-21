/**
 * Notify external waypoint tracker that a checkpoint has been checked in.
 * Fire-and-forget POST to the external Supabase edge function.
 */
import { createTrackingRoom } from '@/lib/trackingRoomClient';

const CHECKIN_WAYPOINT_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkin-waypoint`;


export interface CheckinWaypointPayload {
  room_code: string;
  sequence_order: number;
  order_number?: string;
  waypoints?: Array<{ lat: number; lng: number }>;
}

export function notifyCheckinWaypoint(payload: CheckinWaypointPayload): void {
  if (!payload.room_code || payload.sequence_order == null || payload.sequence_order < 0) {
    console.warn('[checkin-waypoint] Skipped, missing data:', payload);
    return;
  }

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  fetch(CHECKIN_WAYPOINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(async (res) => {
      // Proxy always returns 200 with an envelope; inspect `ok` for the real result.
      const data = await res.json().catch(() => ({} as any));
      if (data?.ok === false) {
        console.warn('[checkin-waypoint] Non-OK envelope:', data);
      } else {
        console.log('[checkin-waypoint] Sent:', payload, data);
      }
    })
    .catch((err) => {
      console.warn('[checkin-waypoint] Request failed:', err);
    });
}

export interface EnsureRoomCodeInput {
  orderCode: string;
  truckPlate?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
  driverId?: string | null;
  context?: string;
}

/**
 * Return the tracking room_code for an order.
 * - First try localStorage (`room_code_${orderCode}`).
 * - Otherwise create a new tracking room and persist it.
 * - Returns null if creation is not possible (missing plate/coords) or fails.
 */
export async function ensureRoomCode(input: EnsureRoomCodeInput): Promise<string | null> {
  const { orderCode } = input;
  if (!orderCode) return null;

  try {
    const cached = localStorage.getItem(`room_code_${orderCode}`);
    if (cached) return cached;
  } catch { /* noop */ }

  const truckPlate =
    input.truckPlate ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_truck_plate') : '') ||
    '';
  const driverId =
    input.driverId ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_driver_id') : '') ||
    undefined;

  const originLat = input.originLat ?? input.currentLat ?? null;
  const originLng = input.originLng ?? input.currentLng ?? null;
  const destinationLat = input.destinationLat ?? null;
  const destinationLng = input.destinationLng ?? null;
  const currentLat = input.currentLat ?? originLat;
  const currentLng = input.currentLng ?? originLng;

  if (
    !truckPlate ||
    originLat == null || originLng == null ||
    destinationLat == null || destinationLng == null ||
    currentLat == null || currentLng == null
  ) {
    console.warn('[ensureRoomCode] skip create — missing data', {
      orderCode, truckPlate, originLat, originLng, destinationLat, destinationLng,
    });
    return null;
  }

  try {
    const res = await createTrackingRoom(
      {
        truck_plate: truckPlate,
        order_code: orderCode,
        origin_lat: Number(originLat),
        origin_lng: Number(originLng),
        destination_lat: Number(destinationLat),
        destination_lng: Number(destinationLng),
        current_lat: Number(currentLat),
        current_lng: Number(currentLng),
        driver_id: driverId,
      },
      input.context || 'ensure-room-code',
    );

    const rc = res?.data?.room?.room_code ?? res?.data?.room_code ?? null;
    if (rc) {
      try { localStorage.setItem(`room_code_${orderCode}`, rc); } catch { /* noop */ }
      return rc;
    }

    // 409 fallback — parse existing room code from details
    const details = res?.data?.details?.details || res?.data?.details || '';
    const match = String(details).match(/room '(RM[A-Z0-9]+)'/);
    if (match && match[1]) {
      try { localStorage.setItem(`room_code_${orderCode}`, match[1]); } catch { /* noop */ }
      return match[1];
    }

    console.warn('[ensureRoomCode] create failed', res?.status, res?.error);
    return null;
  } catch (err) {
    console.warn('[ensureRoomCode] exception', err);
    return null;
  }
}
