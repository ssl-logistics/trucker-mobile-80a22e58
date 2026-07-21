import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";
import { upsertTrackingRoom, getTrackingRoomByOrder } from "../_shared/trackingRoomStore.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
};

interface Waypoint {
  lat: number;
  lng: number;
}

interface TrackingRoomRequest {
  truck_plate: string;
  order_code: string;
  origin_lat: number;
  origin_lng: number;
  waypoints?: Waypoint[];
  destination_lat: number;
  destination_lng: number;
  current_lat: number;
  current_lng: number;
  driver_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let body: TrackingRoomRequest = {} as TrackingRoomRequest;

  try {
    const apiKey = Deno.env.get('TRACKING_API_KEY');
    if (!apiKey) {
      console.error('TRACKING_API_KEY not configured');
      throw new Error('Tracking API key not configured');
    }

    body = await req.json();
    console.log('Creating tracking room for order:', body.order_code);

    // Fire-and-forget "received" trace so we can prove the function was reached
    writeAuditLog({
      function_name: 'create-tracking-room:received',
      driver_id: body?.driver_id,
      order_number: body?.order_code,
      request_payload: body,
      success: true,
      response_status: 0,
      duration_ms: 0,
    }).catch(() => {});


    if (!body.truck_plate || !body.order_code ||
        body.origin_lat === undefined || body.origin_lng === undefined ||
        body.destination_lat === undefined || body.destination_lng === undefined ||
        body.current_lat === undefined || body.current_lng === undefined) {
      await writeAuditLog({
        function_name: 'create-tracking-room',
        driver_id: body.driver_id,
        order_number: body.order_code,
        request_payload: body,
        success: false,
        error_message: 'Missing required fields',
        response_status: 400,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields', details: 'current_lat and current_lng are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalApiUrl = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/create-tracking-room';
    console.log('Calling external tracking API:', externalApiUrl);

    const externalPayload = {
      truck_plate: body.truck_plate,
      order_code: body.order_code,
      origin_lat: body.origin_lat,
      origin_lng: body.origin_lng,
      ...(body.waypoints && body.waypoints.length > 0 && { waypoints: body.waypoints }),
      destination_lat: body.destination_lat,
      destination_lng: body.destination_lng,
      current_lat: body.current_lat,
      current_lng: body.current_lng,
    };

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(externalPayload),
    });

    const responseText = await response.text();
    console.log('External API response status:', response.status);
    console.log('External API response:', responseText);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      if (response.status === 409) {
        const detailsStr = responseData?.details ?? responseData?.message ?? '';
        const roomMatch = String(detailsStr).match(/room '(RM[A-Z0-9]+)'/);

        if (roomMatch && roomMatch[1]) {
          const existingRoomCode = roomMatch[1];
          console.log('Tracking room already exists, using room_code:', existingRoomCode);

          await upsertTrackingRoom({
            order_number: body.order_code,
            room_code: existingRoomCode,
            truck_plate: body.truck_plate,
            driver_id: body.driver_id,
            origin_lat: body.origin_lat,
            origin_lng: body.origin_lng,
            destination_lat: body.destination_lat,
            destination_lng: body.destination_lng,
            source: 'idempotent_409',
          });

          await writeAuditLog({
            function_name: 'create-tracking-room',
            driver_id: body.driver_id,
            order_number: body.order_code,
            room_code: existingRoomCode,
            request_payload: body,
            external_request_payload: externalPayload,
            response_status: response.status,
            response_body: responseData,
            success: true,
            error_message: 'Tracking room already exists (idempotent)',
            duration_ms: Date.now() - startedAt,
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Tracking room already exists',
              room: {
                room_code: existingRoomCode,
                truck_plate: body.truck_plate,
                order_code: body.order_code,
                origin_lat: body.origin_lat,
                origin_lng: body.origin_lng,
                destination_lat: body.destination_lat,
                destination_lng: body.destination_lng,
                status: 'active',
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.error('External API error:', responseData);
      await writeAuditLog({
        function_name: 'create-tracking-room',
        driver_id: body.driver_id,
        order_number: body.order_code,
        request_payload: body,
        external_request_payload: externalPayload,
        response_status: response.status,
        response_body: responseData,
        success: false,
        error_message: 'Failed to create tracking room',
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to create tracking room',
          details: responseData,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tracking room created successfully:', responseData);

    const createdRoomCode = responseData?.room?.room_code ?? responseData?.room_code ?? null;

    if (createdRoomCode) {
      await upsertTrackingRoom({
        order_number: body.order_code,
        room_code: createdRoomCode,
        truck_plate: body.truck_plate,
        driver_id: body.driver_id,
        origin_lat: body.origin_lat,
        origin_lng: body.origin_lng,
        destination_lat: body.destination_lat,
        destination_lng: body.destination_lng,
        source: 'created',
      });
    }


    await writeAuditLog({
      function_name: 'create-tracking-room',
      driver_id: body.driver_id,
      order_number: body.order_code,
      room_code: createdRoomCode,
      request_payload: body,
      external_request_payload: externalPayload,
      response_status: response.status,
      response_body: responseData,
      success: true,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating tracking room:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await writeAuditLog({
      function_name: 'create-tracking-room',
      driver_id: body?.driver_id,
      order_number: body?.order_code,
      request_payload: body,
      success: false,
      error_message: errorMessage,
      response_status: 500,
      duration_ms: Date.now() - startedAt,
    });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
