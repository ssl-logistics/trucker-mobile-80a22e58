// Helper to call `create-tracking-room` via direct fetch (not supabase.functions.invoke)
// and log every attempt/success/error to the audit table via `log-client-event`.
//
// Why direct fetch: the project uses custom auth so there is no Supabase session.
// `supabase.functions.invoke()` can reject silently at its auth layer before the POST
// actually goes out (observed in production: only OPTIONS preflight reached the server).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface TrackingRoomBody {
  truck_plate: string;
  order_code: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  current_lat: number;
  current_lng: number;
  waypoints?: Array<{ lat: number; lng: number }>;
  driver_id?: string;
}

export interface TrackingRoomResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

function logClientEvent(payload: Record<string, unknown>): void {
  try {
    fetch(`${SUPABASE_URL}/functions/v1/log-client-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export async function createTrackingRoom(
  body: TrackingRoomBody,
  context: string,
): Promise<TrackingRoomResult> {
  const startedAt = Date.now();
  const driverId = body.driver_id ?? localStorage.getItem("auth_driver_id") ?? null;

  logClientEvent({
    event: `create-tracking-room:attempt`,
    driver_id: driverId,
    order_number: body.order_code,
    payload: { context, body },
  });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/create-tracking-room`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const roomCode = data?.room?.room_code ?? data?.room_code ?? undefined;

    logClientEvent({
      event: `create-tracking-room:${response.ok ? "success" : "error"}`,
      driver_id: driverId,
      order_number: body.order_code,
      room_code: roomCode,
      payload: { context, body },
      response_status: response.status,
      response_body: data,
      success: response.ok,
      error_message: response.ok ? null : `HTTP ${response.status}`,
      duration_ms: Date.now() - startedAt,
    });

    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logClientEvent({
      event: `create-tracking-room:error`,
      driver_id: driverId,
      order_number: body.order_code,
      payload: { context, body },
      success: false,
      error_message: `fetch threw: ${message}`,
      duration_ms: Date.now() - startedAt,
    });
    return { ok: false, status: 0, error: message };
  }
}
