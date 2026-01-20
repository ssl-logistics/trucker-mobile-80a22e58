import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TruckArrivalRequest {
  room_code: string;
  arrival_type: 'origin' | 'destination';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TRACKING_API_KEY');
    if (!apiKey) {
      console.error('TRACKING_API_KEY not configured');
      throw new Error('Tracking API key not configured');
    }

    const body: TruckArrivalRequest = await req.json();
    console.log('Truck arrival notification for room:', body.room_code, 'type:', body.arrival_type);

    // Validate required fields
    if (!body.room_code || !body.arrival_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: room_code, arrival_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate arrival_type
    if (!['origin', 'destination'].includes(body.arrival_type)) {
      return new Response(
        JSON.stringify({ error: 'arrival_type must be "origin" or "destination"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call external tracking API
    const externalApiUrl = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/truck-arrival';
    
    console.log('Calling external tracking API:', externalApiUrl);
    
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        room_code: body.room_code,
        arrival_type: body.arrival_type,
      }),
    });

    const responseText = await response.text();
    console.log('External API response status:', response.status);
    console.log('External API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('External API error:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to notify truck arrival',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Truck arrival notification sent successfully:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error notifying truck arrival:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
