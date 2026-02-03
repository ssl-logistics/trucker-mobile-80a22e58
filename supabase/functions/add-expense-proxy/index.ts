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
    // Get API key from environment
    const apiKey = Deno.env.get('EXPRESS_RENT_API_KEY');
    
    if (!apiKey) {
      console.error('EXPRESS_RENT_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const body = await req.json();
    const { 
      order_number, 
      driver_id, 
      driver_type, 
      expense_type, 
      amount, 
      receipt_photo_url,
      receipt_photo_urls,
      notes,
      ocr_data
    } = body;

    // Validate required fields
    if (!order_number) {
      return new Response(
        JSON.stringify({ error: 'order_number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!driver_id) {
      return new Response(
        JSON.stringify({ error: 'driver_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!driver_type || !['internal', 'external'].includes(driver_type)) {
      return new Response(
        JSON.stringify({ error: 'driver_type must be "internal" or "external"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!expense_type) {
      return new Response(
        JSON.stringify({ error: 'expense_type is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return new Response(
        JSON.stringify({ error: 'amount is required and must be a number' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Adding expense: order_number=${order_number}, driver_id=${driver_id}, expense_type=${expense_type}, amount=${amount}`);
    if (ocr_data) {
      console.log('OCR data included:', JSON.stringify(ocr_data));
    }

    // Forward the request to the external API
    const externalUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/transport-expenses`;
    
    const response = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        order_number,
        driver_id,
        driver_type,
        expense_type,
        amount: Number(amount),
        receipt_photo_url,
        receipt_photo_urls,
        notes,
        ocr_data,
      }),
    });

    if (!response.ok) {
      console.error('External API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to add expense in external API', details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log('Successfully added expense:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in add-expense-proxy:', error);
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
