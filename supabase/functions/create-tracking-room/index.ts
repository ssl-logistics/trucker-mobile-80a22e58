import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingRoomRequest {
  truck_plate: string;
  order_code: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
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

    const body: TrackingRoomRequest = await req.json();
    console.log('Creating tracking room for order:', body.order_code);

    // Validate required fields
    if (!body.truck_plate || !body.order_code || 
        body.origin_lat === undefined || body.origin_lng === undefined ||
        body.destination_lat === undefined || body.destination_lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call external tracking API
    const externalApiUrl = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/create-tracking-room';
    
    console.log('Calling external tracking API:', externalApiUrl);
    
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        truck_plate: body.truck_plate,
        order_code: body.order_code,
        origin_lat: body.origin_lat,
        origin_lng: body.origin_lng,
        destination_lat: body.destination_lat,
        destination_lng: body.destination_lng,
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
          error: 'Failed to create tracking room',
          details: responseData 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Tracking room created successfully:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating tracking room:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
