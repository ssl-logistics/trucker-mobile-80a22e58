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
    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalBaseUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/report-problem';

    if (req.method === 'GET') {
      // GET request - fetch problems by order_number
      const url = new URL(req.url);
      const orderNumber = url.searchParams.get('order_number');

      if (!orderNumber) {
        return new Response(
          JSON.stringify({ success: false, error: 'order_number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Fetching problems for order: ${orderNumber}`);

      const response = await fetch(`${externalBaseUrl}?order_number=${encodeURIComponent(orderNumber)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();
      console.log('External API response:', JSON.stringify(data));

      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (req.method === 'POST') {
      // POST request - create new problem report
      const body = await req.json();
      
      console.log('Creating problem report:', JSON.stringify(body));

      // Validate required fields
      const requiredFields = ['order_number', 'driver_id', 'driver_type', 'problem_type', 'reason'];
      for (const field of requiredFields) {
        if (!body[field]) {
          return new Response(
            JSON.stringify({ success: false, error: `${field} is required` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate problem_type
      const validProblemTypes = ['partial-delivery', 'pause-work', 'report-issue'];
      if (!validProblemTypes.includes(body.problem_type)) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid problem_type. Must be one of: ${validProblemTypes.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate driver_type
      const validDriverTypes = ['internal', 'external', 'freelance'];
      if (!validDriverTypes.includes(body.driver_type)) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid driver_type. Must be one of: ${validDriverTypes.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const response = await fetch(externalBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      console.log('External API response:', JSON.stringify(data));

      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in report-problem-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
