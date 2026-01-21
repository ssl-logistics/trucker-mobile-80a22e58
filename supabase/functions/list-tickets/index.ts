import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_API_URL = "https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/list-tickets";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LIST_TICKETS_API_KEY');
    
    if (!apiKey) {
      console.error('LIST_TICKETS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters from request
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'active';
    const limit = url.searchParams.get('limit') || '50';

    console.log(`Fetching tickets from external API with status=${status}, limit=${limit}`);

    // Build external API URL with query params
    const externalUrl = new URL(EXTERNAL_API_URL);
    externalUrl.searchParams.set('status', status);
    externalUrl.searchParams.set('limit', limit);

    // Forward request to external API
    const response = await fetch(externalUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    const responseText = await response.text();
    console.log('External API response status:', response.status);
    console.log('External API response preview:', responseText.substring(0, 500));

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
    console.error('Error in list-tickets function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
