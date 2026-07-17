import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
};

const EXTERNAL_BASE = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1';
const EXTERNAL_URL = `${EXTERNAL_BASE}/checkin-waypoint`;
const UPDATE_WAYPOINTS_URL = `${EXTERNAL_BASE}/update-tracking-waypoints`;

interface Body {
  room_code: string;
  sequence_order: number;
  order_number?: string;
  waypoints?: Array<{ lat: number; lng: number }>;
}

async function callExternalCheckin(apiKey: string, room_code: string, sequence_order: number) {
  const res = await fetch(EXTERNAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ room_code, sequence_order }),
  });
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, ok: res.ok, body: parsed, text };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TRACKING_API_KEY');
    if (!apiKey) {
      // Wrap in 200 envelope so client dev overlay doesn't flag as runtime error.
      return new Response(
        JSON.stringify({ ok: false, code: 'no_api_key', error: 'TRACKING_API_KEY not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as Body;
    const { room_code, sequence_order, order_number, waypoints } = body || ({} as Body);
    console.log('[checkin-waypoint proxy] forwarding:', { room_code, sequence_order, order_number, has_waypoints: !!waypoints?.length });

    if (!room_code || !sequence_order) {
      return new Response(
        JSON.stringify({ ok: false, code: 'bad_request', error: 'room_code and sequence_order are required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First attempt
    let first = await callExternalCheckin(apiKey, room_code, sequence_order);
    console.log('[checkin-waypoint proxy] response:', first.status, first.text);

    // Retry path — external returns 404 "No matching waypoint" when the room
    // exists but has no waypoint for that sequence. Sync waypoints then retry once.
    const shouldRepair =
      first.status === 404 &&
      String(first.body?.error || '').toLowerCase().includes('no matching waypoint');

    if (shouldRepair) {
      try {
        const syncPayload: Record<string, unknown> = { room_code };
        if (waypoints && waypoints.length > 0) syncPayload.waypoints = waypoints;
        if (order_number) syncPayload.order_number = order_number;

        console.log('[checkin-waypoint proxy] 404 -> syncing waypoints', syncPayload);
        const syncRes = await fetch(UPDATE_WAYPOINTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify(syncPayload),
        });
        const syncText = await syncRes.text();
        console.log('[checkin-waypoint proxy] waypoint sync response:', syncRes.status, syncText);

        // Retry regardless — sync may still have populated something useful.
        const retry = await callExternalCheckin(apiKey, room_code, sequence_order);
        console.log('[checkin-waypoint proxy] retry response:', retry.status, retry.text);

        return new Response(
          JSON.stringify({
            ok: retry.ok,
            status: retry.status,
            body: retry.body,
            retried: true,
            sync_status: syncRes.status,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (repairErr) {
        const msg = repairErr instanceof Error ? repairErr.message : String(repairErr);
        console.warn('[checkin-waypoint proxy] repair failed:', msg);
        return new Response(
          JSON.stringify({
            ok: false,
            status: first.status,
            body: first.body,
            retried: false,
            repair_error: msg,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Success or non-repairable error — wrap in 200 envelope either way
    // so the Lovable preview doesn't classify fire-and-forget fetches as RUNTIME_ERROR.
    return new Response(
      JSON.stringify({ ok: first.ok, status: first.status, body: first.body }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[checkin-waypoint proxy] error:', msg);
    return new Response(
      JSON.stringify({ ok: false, code: 'exception', error: msg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
