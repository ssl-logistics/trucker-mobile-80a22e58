// 3-tier tracking room lookup:
//   Tier 1: SELECT from public.order_tracking_rooms
//   Tier 2: External /get-tracking-rooms?order_code=X -> UPSERT
//   Tier 3: Auto recreate via /create-tracking-room -> UPSERT
// Response: { room_code, source, tier }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { getTrackingRoomByOrder, upsertTrackingRoom } from "../_shared/trackingRoomStore.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const EXTERNAL_BASE = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1';

interface Body {
  order_number: string;
  driver_id?: string;
  // Optional data for Tier 3 recreate
  truck_plate?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  current_lat?: number;
  current_lng?: number;
  waypoints?: Array<{ lat: number; lng: number }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let body: Body = {} as Body;

  try {
    body = await req.json();
    const orderNumber = body.order_number;
    if (!orderNumber) {
      return new Response(JSON.stringify({ error: 'order_number is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tier 1: DB lookup
    const rec = await getTrackingRoomByOrder(orderNumber);
    if (rec?.room_code) {
      await writeAuditLog({
        function_name: 'get-tracking-room:tier1-db',
        driver_id: body.driver_id, order_number: orderNumber, room_code: rec.room_code,
        success: true, response_status: 200, duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ room_code: rec.room_code, source: rec.source, tier: 1 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('TRACKING_API_KEY');
    if (!apiKey) {
      throw new Error('TRACKING_API_KEY not configured');
    }

    // Tier 2: External lookup
    try {
      const lookupUrl = `${EXTERNAL_BASE}/get-tracking-rooms?order_code=${encodeURIComponent(orderNumber)}`;
      const lookupResp = await fetch(lookupUrl, {
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      });
      const lookupText = await lookupResp.text();
      let lookupData: any;
      try { lookupData = JSON.parse(lookupText); } catch { lookupData = { raw: lookupText }; }

      const rooms: any[] = Array.isArray(lookupData?.data) ? lookupData.data : [];
      const active = rooms.find((r) => r?.room_code) ?? rooms[0];
      const foundRoomCode = active?.room_code;

      if (lookupResp.ok && foundRoomCode) {
        await upsertTrackingRoom({
          order_number: orderNumber,
          room_code: foundRoomCode,
          truck_plate: active?.truck_plate ?? body.truck_plate,
          driver_id: body.driver_id,
          origin_lat: active?.origin_lat ?? body.origin_lat,
          origin_lng: active?.origin_lng ?? body.origin_lng,
          destination_lat: active?.destination_lat ?? body.destination_lat,
          destination_lng: active?.destination_lng ?? body.destination_lng,
          source: 'external_lookup',
        });
        await writeAuditLog({
          function_name: 'get-tracking-room:tier2-external',
          driver_id: body.driver_id, order_number: orderNumber, room_code: foundRoomCode,
          response_status: lookupResp.status, response_body: lookupData,
          success: true, duration_ms: Date.now() - startedAt,
        });
        return new Response(
          JSON.stringify({ room_code: foundRoomCode, source: 'external_lookup', tier: 2 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await writeAuditLog({
        function_name: 'get-tracking-room:tier2-external',
        driver_id: body.driver_id, order_number: orderNumber,
        response_status: lookupResp.status, response_body: lookupData,
        success: false, error_message: 'external returned no room',
      });
    } catch (e) {
      await writeAuditLog({
        function_name: 'get-tracking-room:tier2-external',
        driver_id: body.driver_id, order_number: orderNumber,
        success: false,
        error_message: e instanceof Error ? e.message : String(e),
      });
    }

    // Tier 3: Recreate if we have coords
    const canRecreate =
      body.truck_plate &&
      typeof body.origin_lat === 'number' && typeof body.origin_lng === 'number' &&
      typeof body.destination_lat === 'number' && typeof body.destination_lng === 'number' &&
      typeof body.current_lat === 'number' && typeof body.current_lng === 'number';

    if (!canRecreate) {
      await writeAuditLog({
        function_name: 'get-tracking-room:tier3-recreate',
        driver_id: body.driver_id, order_number: orderNumber,
        success: false,
        error_message: 'insufficient data to recreate (need truck_plate + all coords)',
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ error: 'room not found and insufficient data to recreate' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recreatePayload = {
      truck_plate: body.truck_plate,
      order_code: orderNumber,
      origin_lat: body.origin_lat,
      origin_lng: body.origin_lng,
      destination_lat: body.destination_lat,
      destination_lng: body.destination_lng,
      current_lat: body.current_lat,
      current_lng: body.current_lng,
      ...(body.waypoints && body.waypoints.length > 0 && { waypoints: body.waypoints }),
    };

    const createResp = await fetch(`${EXTERNAL_BASE}/create-tracking-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(recreatePayload),
    });
    const createText = await createResp.text();
    let createData: any;
    try { createData = JSON.parse(createText); } catch { createData = { raw: createText }; }

    // Handle 409 idempotent
    let newRoomCode: string | null =
      createData?.room?.room_code ?? createData?.room_code ?? null;
    if (!newRoomCode && createResp.status === 409) {
      const detailsStr = createData?.details ?? createData?.message ?? '';
      const m = String(detailsStr).match(/room '(RM[A-Z0-9]+)'/);
      if (m) newRoomCode = m[1];
    }

    if (newRoomCode) {
      await upsertTrackingRoom({
        order_number: orderNumber,
        room_code: newRoomCode,
        truck_plate: body.truck_plate,
        driver_id: body.driver_id,
        origin_lat: body.origin_lat,
        origin_lng: body.origin_lng,
        destination_lat: body.destination_lat,
        destination_lng: body.destination_lng,
        source: 'recreated',
      });
      await writeAuditLog({
        function_name: 'get-tracking-room:tier3-recreate',
        driver_id: body.driver_id, order_number: orderNumber, room_code: newRoomCode,
        request_payload: recreatePayload, response_status: createResp.status,
        response_body: createData, success: true,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ room_code: newRoomCode, source: 'recreated', tier: 3 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await writeAuditLog({
      function_name: 'get-tracking-room:tier3-recreate',
      driver_id: body.driver_id, order_number: orderNumber,
      request_payload: recreatePayload, response_status: createResp.status,
      response_body: createData, success: false,
      error_message: `recreate failed HTTP ${createResp.status}`,
      duration_ms: Date.now() - startedAt,
    });
    return new Response(
      JSON.stringify({ error: 'failed to recreate tracking room', details: createData }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeAuditLog({
      function_name: 'get-tracking-room',
      driver_id: body?.driver_id, order_number: body?.order_number,
      request_payload: body, success: false, error_message: message,
      response_status: 500, duration_ms: Date.now() - startedAt,
    });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
