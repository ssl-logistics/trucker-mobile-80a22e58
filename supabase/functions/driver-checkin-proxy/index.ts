import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Determine driver type and set appropriate ID fields
    const driverType = body.driver_type || 'freelance';
    const requestBody: Record<string, unknown> = {
      order_number: body.order_number,
      checkin_type: body.checkin_type,
      driver_name: body.driver_name,
      driver_phone: body.driver_phone,
      driver_avatar: body.driver_avatar,
      latitude: body.latitude,
      longitude: body.longitude,
      notes: body.notes,
      driver_type: driverType,
      // Include container fields for empty_container check-in
      container_number: body.container_number,
      seal_number: body.seal_number,
      container_number_2: body.container_number_2,
      seal_number_2: body.seal_number_2,
    };

    // Set the appropriate driver ID field based on driver type
    if (driverType === 'internal') {
      requestBody.internal_driver_id = body.driver_id;
    } else if (driverType === 'external') {
      requestBody.external_driver_id = body.driver_id;
    } else {
      requestBody.freelance_driver_id = body.driver_id;
    }
    
    console.log('Proxying check-in request:', requestBody);

    // Forward request to external API
    const response = await fetch(
      'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/driver-checkin',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
        },
        body: JSON.stringify(requestBody)
      }
    );

    const responseText = await response.text();
    console.log('External API response:', response.status, responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    return new Response(
      JSON.stringify(responseData),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    console.error('Proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
