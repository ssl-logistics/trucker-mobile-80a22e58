import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TRUCKER_API_KEY');
    
    if (!apiKey) {
      console.error('TRUCKER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const freelanceDriverId = url.searchParams.get('freelance_driver_id');
    const limit = url.searchParams.get('limit') || '10';

    if (!freelanceDriverId) {
      return new Response(
        JSON.stringify({ error: 'freelance_driver_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Fetching factory assigned jobs for driver:', freelanceDriverId);

    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${freelanceDriverId}&limit=${limit}`;
    
    const response = await fetch(externalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('External API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch data from external API' }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Successfully fetched factory assigned jobs:', data?.data?.length || 0, 'items');

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-factory-assigned-jobs:', error);
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
