import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PodPayload {
  order_number: string;
  driver_name: string;
  driver_phone: string;
  driver_id: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  notes: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: PodPayload = await req.json();

    console.log('=== Received POD Submission ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const requiredFields = ['order_number', 'driver_name', 'driver_phone', 'driver_id', 'photo_url', 'latitude', 'longitude', 'notes'];
    const missingFields = requiredFields.filter(field => payload[field as keyof PodPayload] === undefined || payload[field as keyof PodPayload] === null);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get API key from environment
    const apiKey = Deno.env.get('TRUCKER_API_KEY');
    if (!apiKey) {
      console.error('TRUCKER_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward to external system (match login-style calling convention)
    const externalUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/receive-pod';
    console.log('Forwarding POD to external system:', externalUrl);

    const externalResponse = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const externalResult = await externalResponse.text();
    console.log('External response status:', externalResponse.status);
    console.log('External response body:', externalResult);

    let responseData;
    try {
      responseData = JSON.parse(externalResult);
    } catch {
      responseData = { message: externalResult };
    }

    const ok = externalResponse.ok;

    if (ok) {
      console.log('POD submission processed successfully');
      console.log('================================');
    } else {
      console.error('External POD submission failed');
      console.log('================================');
    }

    return new Response(
      JSON.stringify({
        success: ok,
        message: ok ? 'POD submitted successfully' : 'POD submission failed',
        data: responseData,
      }),
      {
        status: externalResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing POD submission:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
