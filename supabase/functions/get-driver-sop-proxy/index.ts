import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Forward all query parameters to the external API
    const forwardUrl = new URL('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop');
    
    // Copy all query parameters
    url.searchParams.forEach((value, key) => {
      forwardUrl.searchParams.set(key, value);
    });

    console.log('Fetching SOP data from:', forwardUrl.toString());

    const response = await fetch(forwardUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
      },
    });

    const responseText = await response.text();
    console.log('External API response:', response.status, responseText);

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
    console.error('Proxy error:', error);
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
