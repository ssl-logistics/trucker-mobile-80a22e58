import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let body: any = {};
  try {
    const apiKey = Deno.env.get('TRACKING_API_KEY');
    if (!apiKey) {
      throw new Error('TRACKING_API_KEY not configured');
    }

    body = await req.json();
    const { driver_id, order_number, room_code } = body;
    console.log('Updating tracking waypoints for room:', room_code);

    // Strip driver_id/order_number before forwarding (external API doesn't expect them)
    const forwardBody = { ...body };
    delete forwardBody.driver_id;
    delete forwardBody.order_number;

    const response = await fetch('https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/update-tracking-waypoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(forwardBody),
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

    await writeAuditLog({
      function_name: 'update-tracking-waypoints',
      driver_id,
      order_number,
      room_code,
      request_payload: body,
      external_request_payload: forwardBody,
      response_status: response.status,
      response_body: responseData,
      success: response.ok,
      error_message: response.ok ? null : `External API error: ${response.status}`,
      duration_ms: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify(responseData),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating tracking waypoints:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await writeAuditLog({
      function_name: 'update-tracking-waypoints',
      driver_id: body?.driver_id,
      order_number: body?.order_number,
      room_code: body?.room_code,
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
