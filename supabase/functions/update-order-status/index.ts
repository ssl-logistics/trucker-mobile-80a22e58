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
    // Get API key from request header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      console.error('x-api-key header not provided');
      return new Response(
        JSON.stringify({ error: 'x-api-key header is required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { order_id, order_number, status, driver_id, driver_type } = body;

    if (!order_id && !order_number) {
      return new Response(
        JSON.stringify({ error: 'order_id or order_number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!status) {
      return new Response(
        JSON.stringify({ error: 'status is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!driver_type || !['internal', 'external'].includes(driver_type)) {
      return new Response(
        JSON.stringify({ error: 'driver_type must be "internal" or "external"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Updating order status: order_id=${order_id}, order_number=${order_number}, status=${status}, driver_type=${driver_type}`);

    // Forward the request to the external API
    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/update-order-status`;
    
    const response = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        order_id,
        order_number,
        status,
        driver_id,
        driver_type,
      }),
    });

    if (!response.ok) {
      console.error('External API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to update status in external API', details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Successfully updated order status:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in update-order-status:', error);
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
