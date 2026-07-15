import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { writeAuditLog } from "../_shared/auditLog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await req.json();
    const { order_number, destinations, driver_id } = body;

    if (!order_number || !destinations || !Array.isArray(destinations)) {
      await writeAuditLog({
        function_name: 'reorder-destinations',
        driver_id,
        order_number,
        request_payload: body,
        success: false,
        error_message: 'Missing order_number or destinations array',
        response_status: 400,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_number or destinations array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const dest of destinations) {
      if (!dest.id || dest.sequence_number === undefined) {
        await writeAuditLog({
          function_name: 'reorder-destinations',
          driver_id,
          order_number,
          request_payload: body,
          success: false,
          error_message: 'Each destination must have id and sequence_number',
          response_status: 400,
          duration_ms: Date.now() - startedAt,
        });
        return new Response(
          JSON.stringify({ success: false, error: 'Each destination must have id and sequence_number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      await writeAuditLog({
        function_name: 'reorder-destinations',
        driver_id,
        order_number,
        request_payload: body,
        success: false,
        error_message: 'Server configuration error',
        response_status: 500,
        duration_ms: Date.now() - startedAt,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      order_number,
      destinations: destinations.map((d: any) => ({
        id: d.id,
        sequence_number: d.sequence_number,
      })),
    };

    console.log('Sending reorder request to external API:', JSON.stringify(payload));

    const response = await fetch(`${EXTERNAL_API_URL}/reorder-destinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('External API response:', response.status, responseText);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    await writeAuditLog({
      function_name: 'reorder-destinations',
      driver_id,
      order_number,
      request_payload: body,
      external_request_payload: payload,
      response_status: response.status,
      response_body: responseData,
      success: response.ok,
      error_message: response.ok ? null : (responseData?.message || responseData?.error || `External API error: ${response.status}`),
      duration_ms: Date.now() - startedAt,
    });

    if (!response.ok) {
      console.error('External API error:', response.status, responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: responseData?.message || responseData?.error || `External API error: ${response.status}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reorder-destinations:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await writeAuditLog({
      function_name: 'reorder-destinations',
      driver_id: body?.driver_id,
      order_number: body?.order_number,
      request_payload: body,
      success: false,
      error_message: errorMessage,
      response_status: 500,
      duration_ms: Date.now() - startedAt,
    });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
