import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    console.log('=== Create Bid Proxy ===');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Get the API key from secrets
    const apiKey = Deno.env.get('CREATE_BID_API_KEY');
    if (!apiKey) {
      console.error('CREATE_BID_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward to external create-bid API
    const externalUrl = 'https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/create-bid';
    
    const response = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.text();
    console.log('External response status:', response.status);
    console.log('External response:', result);

    let parsedResult;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      parsedResult = { raw: result };
    }

    return new Response(
      JSON.stringify(parsedResult),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Error in create-bid-proxy:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
