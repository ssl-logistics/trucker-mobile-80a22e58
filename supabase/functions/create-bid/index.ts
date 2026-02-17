import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_API_URL = "https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/create-bid";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('CREATE_BID_API_KEY');
    
    if (!apiKey) {
      console.error('CREATE_BID_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('Creating bid for ticket:', body.ticket_id, 'contractor:', body.contractor_id, 'price:', body.bid_price);

    // Build outbound headers - support both x-api-key and Supabase gateway auth
    const outboundHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };

    // If the key looks like a JWT (Supabase anon key), also send apikey/Authorization
    if (apiKey.startsWith('eyJ')) {
      outboundHeaders.apikey = apiKey;
      outboundHeaders.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: outboundHeaders,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('External create-bid response status:', response.status);
    console.log('External create-bid response preview:', responseText.substring(0, 500));

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-bid function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
