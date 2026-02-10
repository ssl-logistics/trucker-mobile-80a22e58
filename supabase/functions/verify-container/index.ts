import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { container_no, seal_no } = body;

    if (!container_no) {
      return new Response(
        JSON.stringify({ success: false, error: 'container_no is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Looking up container:', { container_no, seal_no });

    const apiKey = Deno.env.get('EXTERNAL_API_KEY') || 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';
    const externalUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/lookup-container';

    const payload: Record<string, unknown> = { container_no };
    if (seal_no) payload.seal_no = seal_no;

    console.log('Calling external API:', externalUrl, payload);

    const response = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('External API response:', result);

    if (!response.ok) {
      console.error('External API error:', response.status, result);
      return new Response(
        JSON.stringify({ success: false, error: result.error || `External API error: ${response.status}`, ...result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in lookup-container proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
