import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_number, destinations } = body;

    if (!order_number || !destinations || !Array.isArray(destinations)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_number or destinations array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate destinations have required fields
    for (const dest of destinations) {
      if (!dest.id || dest.sequence_number === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: 'Each destination must have id and sequence_number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call external TMS API to update destination order
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

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error('External API error:', response.status, responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData?.message || responseData?.error || `External API error: ${response.status}`,
          // Still return success: false but don't fail hard - localStorage will keep the order
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
