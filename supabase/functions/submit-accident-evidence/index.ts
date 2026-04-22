import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/submit-accident-evidence';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use the same API key as driver-checkin (EXPRESS_RENT_API_KEY in client)
    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY') || Deno.env.get('EXTERNAL_API_KEY');
    if (!apiKey) {
      console.error('❌ External API key not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('📤 submit-accident-evidence proxy →', {
      order_id: body.order_id,
      order_number: body.order_number,
      photo_count: Array.isArray(body.photo_urls) ? body.photo_urls.length : (body.photo_url ? 1 : 0),
    });

    // Basic validation
    if (!body.order_id && !body.order_number) {
      return new Response(
        JSON.stringify({ error: 'order_id or order_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const photoUrls: string[] = Array.isArray(body.photo_urls)
      ? body.photo_urls
      : (body.photo_url ? [body.photo_url] : []);

    if (photoUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'NO_PHOTOS', message: 'At least one photo is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ...body, photo_urls: photoUrls }),
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`📥 External API status ${response.status}`, responseData);

    return new Response(
      JSON.stringify(responseData),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ submit-accident-evidence error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
