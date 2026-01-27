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
    const url = new URL(req.url);
    const driverType = url.searchParams.get('driver_type') || 'freelance';
    const driverId = url.searchParams.get('driver_id');
    const orderNumber = url.searchParams.get('order_number');

    // Support legacy parameter for backwards compatibility
    const freelanceDriverId = url.searchParams.get('freelance_driver_id');

    if (!driverId && !freelanceDriverId) {
      return new Response(
        JSON.stringify({ error: 'driver_id or freelance_driver_id is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Fetching check-ins for driver:', driverId || freelanceDriverId, 'type:', driverType, 'order:', orderNumber);

    // Build forward URL with appropriate driver ID parameter
    const forwardUrl = new URL('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-checkins');
    
    // Set the appropriate driver ID parameter based on driver type
    if (driverType === 'internal' && driverId) {
      forwardUrl.searchParams.set('internal_driver_id', driverId);
    } else if (driverType === 'external' && driverId) {
      forwardUrl.searchParams.set('external_driver_id', driverId);
    } else {
      forwardUrl.searchParams.set('freelance_driver_id', driverId || freelanceDriverId || '');
    }
    
    // Add other query params
    if (orderNumber) {
      forwardUrl.searchParams.set('order_number', orderNumber);
    }
    forwardUrl.searchParams.set('driver_type', driverType);

    // Forward request to external API
    const response = await fetch(forwardUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
      },
    });

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
