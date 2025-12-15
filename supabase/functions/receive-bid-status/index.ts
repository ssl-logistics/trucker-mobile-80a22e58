import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BidStatusPayload {
  bid_id?: string;
  order_code?: string;
  status: 'accepted' | 'rejected' | 'won' | 'lost' | 'pending';
  message?: string;
  updated_at?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BidStatusPayload = await req.json();
    
    console.log('=== Received Bid Status Update ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    if (!payload.status) {
      console.error('Missing required field: status');
      return new Response(
        JSON.stringify({ error: 'Missing required field: status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Need either bid_id or order_code to find the bid
    if (!payload.bid_id && !payload.order_code) {
      console.error('Missing identifier: need either bid_id or order_code');
      return new Response(
        JSON.stringify({ error: 'Missing identifier: need either bid_id or order_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status value
    const validStatuses = ['accepted', 'rejected', 'won', 'lost', 'pending'];
    if (!validStatuses.includes(payload.status)) {
      console.error('Invalid status value:', payload.status);
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let bidId = payload.bid_id;

    // If order_code is provided, find the bid(s) for that job
    if (!bidId && payload.order_code) {
      // First find the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('order_code', payload.order_code)
        .single();

      if (jobError || !job) {
        console.error('Job not found for order_code:', payload.order_code);
        return new Response(
          JSON.stringify({ error: `Job not found for order_code: ${payload.order_code}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the most recent pending bid for this job
      const { data: bids, error: bidsError } = await supabase
        .from('job_bids')
        .select('id')
        .eq('job_id', job.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (bidsError || !bids || bids.length === 0) {
        console.error('No pending bids found for job:', job.id);
        return new Response(
          JSON.stringify({ error: 'No pending bids found for this job' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      bidId = bids[0].id;
    }

    // Update the bid status
    const { data: updatedBid, error: updateError } = await supabase
      .from('job_bids')
      .update({ 
        status: payload.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', bidId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bid status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update bid status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated bid status:', updatedBid);

    // If bid is accepted/won, update the job status
    if (payload.status === 'accepted' || payload.status === 'won') {
      const { error: jobUpdateError } = await supabase
        .from('jobs')
        .update({ status: 'assigned' })
        .eq('id', updatedBid.job_id);

      if (jobUpdateError) {
        console.warn('Warning: Failed to update job status:', jobUpdateError);
      } else {
        console.log('Job status updated to assigned');
      }

      // Create job application for the winning driver
      const { error: applicationError } = await supabase
        .from('job_applications')
        .upsert({
          job_id: updatedBid.job_id,
          driver_id: updatedBid.driver_id,
          status: 'accepted',
          applied_at: new Date().toISOString()
        }, {
          onConflict: 'job_id,driver_id'
        });

      if (applicationError) {
        console.warn('Warning: Failed to create job application:', applicationError);
      } else {
        console.log('Job application created for driver');
      }
    }

    console.log('================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bid status updated to ${payload.status}`,
        bid: updatedBid
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
