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
    // Use server-side secret (do NOT require client to send x-api-key)
    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');

    if (!apiKey) {
      console.error('Missing EXPRESS_RENT_API_KEY secret');
      return new Response(
        JSON.stringify({ error: 'Server is missing EXPRESS_RENT_API_KEY' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const driverId = url.searchParams.get('driver_id');
    const driverType = url.searchParams.get('driver_type'); // 'internal' or 'external'
    const limit = url.searchParams.get('limit') || '10';

    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'driver_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!driverType || !['internal', 'external'].includes(driverType)) {
      return new Response(
        JSON.stringify({ error: 'driver_type must be "internal" or "external"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Fetching assigned jobs for ${driverType} driver:`, driverId);

    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-assigned-jobs?driver_id=${driverId}&driver_type=${driverType}&limit=${limit}`;
    
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('External API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch data from external API', details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log(`Successfully fetched assigned jobs for ${driverType} driver:`, data?.data?.length || 0, 'items');

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-driver-assigned-jobs:', error);
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
