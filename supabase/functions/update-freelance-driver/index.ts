import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'PUT') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const API_KEY = Deno.env.get('EXTERNAL_REGISTER_API_KEY');
    const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/update-freelance-driver';

    const body = await req.json();
    console.log('Updating driver with data:', JSON.stringify(body));

    // Validate required fields - accept driver_id or type-specific ID
    const driverId = body.driver_id || body.internal_driver_id || body.external_driver_id || body.freelance_driver_id;
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: 'driver_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward the request to the external API
    const response = await fetch(EXTERNAL_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY || '',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('External API response:', responseText);

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

  } catch (error) {
    console.error('Error updating driver:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
