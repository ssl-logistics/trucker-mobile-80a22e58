import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { order_number, container_no, seal_no } = body;

    // Validate required fields
    if (!order_number || !container_no) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'order_number and container_no are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Verifying container:', { order_number, container_no, seal_no });

    // Get API key - same as get-driver-assigned-jobs
    const apiKey = Deno.env.get('EXTERNAL_API_KEY') || 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';

    // Forward to external API
    const externalUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/verify-container';
    
    const payload = {
      order_number,
      container_no,
      seal_no: seal_no || null,
    };

    console.log('Calling external API:', externalUrl);

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
        JSON.stringify({ 
          success: false, 
          error: result.error || `External API error: ${response.status}`,
          ...result
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in verify-container:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
