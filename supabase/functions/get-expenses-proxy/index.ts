import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const orderNumber = url.searchParams.get('order_number');
    const driverId = url.searchParams.get('driver_id');
    const driverType = url.searchParams.get('driver_type');

    if (!orderNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!driverId) {
      return new Response(
        JSON.stringify({ success: false, error: 'driver_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetching expenses for order: ${orderNumber}, driver: ${driverId}, type: ${driverType}`);

    // Get API key from environment
    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build query parameters for external API
    const queryParams = new URLSearchParams({
      order_number: orderNumber,
    });
    
    if (driverId) {
      queryParams.append('driver_id', driverId);
    }
    
    if (driverType) {
      queryParams.append('driver_type', driverType);
    }

    // Forward the request to the external API
    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-transport-expenses?${queryParams.toString()}`;
    
    console.log(`Calling external API: ${externalUrl}`);
    
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    console.log(`External API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch expenses from external API', details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('External API response:', JSON.stringify(data));

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-expenses-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
