import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const EXTERNAL_API_URL = "https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1/submit-price-hint";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('TRUCKER_API_KEY');
    if (!API_KEY) {
      throw new Error('TRUCKER_API_KEY is not configured');
    }

    const url = new URL(req.url);
    
    // Handle GET request - check payment status
    if (req.method === 'GET') {
      const ticketId = url.searchParams.get('ticket_id');
      const contractorId = url.searchParams.get('contractor_id');
      
      if (!ticketId || !contractorId) {
        return new Response(
          JSON.stringify({ success: false, error: 'ticket_id and contractor_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const externalUrl = new URL(EXTERNAL_API_URL);
      externalUrl.searchParams.set('ticket_id', ticketId);
      externalUrl.searchParams.set('contractor_id', contractorId);

      const response = await fetch(externalUrl.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Handle POST request - submit payment
    if (req.method === 'POST') {
      const body = await req.json();
      
      const { ticket_id, contractor_id, price_hint, transaction_id, slip_base64 } = body;
      
      if (!ticket_id || !contractor_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'ticket_id and contractor_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Submitting hint payment for ticket: ${ticket_id}, contractor: ${contractor_id}`);

      const response = await fetch(EXTERNAL_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id,
          contractor_id,
          price_hint,
          transaction_id,
          slip_base64,
        }),
      });

      const data = await response.json();
      
      console.log('External API response:', JSON.stringify(data));
      
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in submit-price-hint proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
