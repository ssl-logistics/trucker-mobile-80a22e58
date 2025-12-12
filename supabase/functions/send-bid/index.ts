import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendBidPayload {
  job_id: string;
  bid_amount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header to identify the driver
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: SendBidPayload = await req.json();

    console.log('=== Sending Bid to External System ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Driver ID:', user.id);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.job_id || !payload.bid_amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'job_id and bid_amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.bid_amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'bid_amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', payload.job_id)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get driver profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Driver profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save bid to local database
    const { data: savedBid, error: bidError } = await supabase
      .from('job_bids')
      .insert({
        job_id: payload.job_id,
        driver_id: user.id,
        bid_amount: payload.bid_amount,
        status: 'pending'
      })
      .select()
      .single();

    if (bidError) {
      console.error('Error saving bid:', bidError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save bid' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Bid saved locally:', savedBid.id);

    // Prepare payload for external system
    const externalPayload = {
      order_code: job.order_code,
      bid_id: savedBid.id,
      bid_amount: payload.bid_amount,
      driver_id: user.id,
      driver_name: profile.full_name,
      driver_phone: profile.phone_number,
      timestamp: new Date().toISOString()
    };

    // Forward bid to external system
    const externalUrl = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/receive-bid';
    console.log('Forwarding bid to external system:', externalUrl);
    console.log('External payload:', JSON.stringify(externalPayload, null, 2));
    
    try {
      const externalResponse = await fetch(externalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(externalPayload)
      });

      const externalResult = await externalResponse.text();
      console.log('External response status:', externalResponse.status);
      console.log('External response body:', externalResult);

      if (!externalResponse.ok) {
        console.warn('External system returned non-OK status, but bid is saved locally');
      }
    } catch (fetchError) {
      console.error('Error forwarding to external system:', fetchError);
      // Don't fail the request - bid is already saved locally
    }

    console.log('Bid sent successfully');
    console.log('================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bid submitted successfully',
        bid_id: savedBid.id,
        data: externalPayload
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing bid:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
