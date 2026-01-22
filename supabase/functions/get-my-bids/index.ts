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
    const { contractor_id } = await req.json();

    if (!contractor_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'contractor_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('=== Get My Bids ===');
    console.log('Contractor ID:', contractor_id);

    // Get the API key from secrets
    const apiKey = Deno.env.get('LIST_TICKETS_API_KEY');
    if (!apiKey) {
      console.error('LIST_TICKETS_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch bids from external API
    const externalUrl = `https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/list-bids?contractor_id=${contractor_id}`;
    
    console.log('Fetching from:', externalUrl);

    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      }
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
    console.error('Error in get-my-bids:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
