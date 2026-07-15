import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-app-secret',
};

interface UpdatePositionRequest {
  room_code: string;
  current_lat: number;
  current_lng: number;
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

    const body: UpdatePositionRequest = await req.json();
    console.log('Updating truck position for room:', body.room_code);

    // Validate required fields
    if (!body.room_code || body.current_lat === undefined || body.current_lng === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: room_code, current_lat, current_lng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call external tracking API
    const externalApiUrl = 'https://wqtrceqyeshyeozladzi.supabase.co/functions/v1/update-truck-position';
    
    console.log('Calling external tracking API:', externalApiUrl);
    
    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        room_code: body.room_code,
        current_lat: body.current_lat,
        current_lng: body.current_lng,
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

      // If room is not active/completed, return 200 so the client can stop tracking
      // without treating this as a fatal error.
      if (
        response.status === 404 &&
        (
          responseData?.error === 'Room not found or inactive' ||
          responseData?.details?.error === 'Room not found or inactive' ||
          responseData?.error === 'Room not found or already completed' ||
          responseData?.details?.error === 'Room not found or already completed'
        )
      ) {
        const msg =
          responseData?.error || responseData?.details?.error || 'Room not found or inactive';
        return new Response(
          JSON.stringify({
            success: false,
            should_stop: true,
            error: msg,
            details: responseData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // External tracking API sometimes returns transient 401s (e.g. "Failed to validate API key").
      // Do NOT propagate 401 to the client (it can cause unhandled errors/blank screens).
      // Instead return 200 and let the client retry on the next interval.
      if (response.status === 401) {
        const msg =
          responseData?.error || responseData?.details?.error || 'Failed to validate API key';
        return new Response(
          JSON.stringify({
            success: false,
            should_retry: true,
            error: msg,
            details: responseData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'Failed to update truck position',
          details: responseData,
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Truck position updated successfully:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating truck position:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Network errors (connection reset, timeout, etc.) are transient.
    // Return 200 so the client doesn't crash; it will retry on the next interval.
    const isNetworkError =
      errorMessage.includes('connection') ||
      errorMessage.includes('SendRequest') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('reset');

    if (isNetworkError) {
      return new Response(
        JSON.stringify({
          success: false,
          should_retry: true,
          error: errorMessage,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
