import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      order_number,
      post_id,
      freelance_driver_id,
      freelance_driver_name,
      driver_phone,
      license_plate,
      vehicle_type,
      vehicle_brand,
    } = await req.json();

    console.log('[accept-express-rent-job-proxy] Accepting express rent job:', {
      order_number,
      post_id,
      freelance_driver_id,
    });

    // Get external API key from environment
    const externalApiKey = Deno.env.get('EXTERNAL_API_KEY');
    if (!externalApiKey) {
      throw new Error('EXTERNAL_API_KEY not configured');
    }

    // Call the external API to accept the job
    const externalApiUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/accept-express-rent-job';
    
    const payload = {
      order_number,
      post_id,
      freelance_driver_id,
      freelance_driver_name,
      driver_phone,
      license_plate,
      vehicle_type,
      vehicle_brand,
    };

    console.log('[accept-express-rent-job-proxy] Calling external API with payload:', payload);

    const response = await fetch(externalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': externalApiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[accept-express-rent-job-proxy] External API response status:', response.status);
    console.log('[accept-express-rent-job-proxy] External API response:', responseText);

    if (!response.ok) {
      throw new Error(`External API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[accept-express-rent-job-proxy] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
