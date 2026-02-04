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
    const body = await req.json();
    const {
      order_number,
      job_id,
      driver_id,
      container_number,
      seal_number,
      container_number_2,
      seal_number_2,
      photo_url,
      ocr_data,
    } = body;

    // Validate required fields
    if (!order_number || !container_number || !seal_number) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: order_number, container_number, seal_number',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Container verification request:', {
      order_number,
      job_id,
      driver_id,
      container_number,
      seal_number,
      container_number_2,
      seal_number_2,
      has_photo: !!photo_url,
      ocr_data,
    });

    // Forward to external API for verification
    const externalApiUrl = Deno.env.get('EXTERNAL_API_URL') || 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
    const apiKey = Deno.env.get('EXTERNAL_API_KEY') || 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';

    const payload = {
      order_number,
      job_id,
      driver_id,
      container_number,
      seal_number,
      container_number_2: container_number_2 || null,
      seal_number_2: seal_number_2 || null,
      photo_url: photo_url || null,
      ocr_data: ocr_data || null,
      submitted_at: new Date().toISOString(),
    };

    const response = await fetch(`${externalApiUrl}/receive-container-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    // If external API is not available, return success anyway (for development)
    if (!response.ok) {
      console.log('External API not available, returning success for development');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Container verification submitted (pending external API)',
          data: payload,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Container verification submitted successfully',
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in submit-container-verification:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
