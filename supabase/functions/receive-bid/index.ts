import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    console.log('=== Received Bid from External Project ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Extract bid data
    const {
      bid_id,
      order_code,
      job_id: external_job_id,
      bid_amount,
      driver_info,
      vehicle_info,
      job_info,
      source_project,
    } = payload;

    // Validate required fields
    if (!order_code || !bid_amount || !driver_info) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing required fields: order_code, bid_amount, driver_info'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find the job by order_code
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('order_code', order_code)
      .single();

    if (jobError || !job) {
      console.error('Job not found for order_code:', order_code);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Job not found for the given order_code',
          order_code: order_code
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Found job:', job.id);

    // Check if driver already exists in external_user_mapping
    let driverMapping = null;
    if (driver_info?.id) {
      const { data: existingMapping } = await supabase
        .from('external_user_mapping')
        .select('*')
        .eq('external_user_id', driver_info.id)
        .single();

      if (existingMapping) {
        driverMapping = existingMapping;
        console.log('Found existing driver mapping:', driverMapping.id);
      } else {
        // Create new external user mapping for the driver
        const { data: newMapping, error: mappingError } = await supabase
          .from('external_user_mapping')
          .insert({
            external_user_id: driver_info.id,
            external_user_name: driver_info.full_name,
            external_user_avatar: driver_info.avatar_url,
          })
          .select()
          .single();

        if (!mappingError && newMapping) {
          driverMapping = newMapping;
          console.log('Created new driver mapping:', driverMapping.id);
        }
      }
    }

    // Store bid information (you might want to create a separate table for external bids)
    // For now, we'll log it and return success
    const bidRecord = {
      external_bid_id: bid_id,
      job_id: job.id,
      order_code: order_code,
      bid_amount: bid_amount,
      driver_info: driver_info,
      vehicle_info: vehicle_info,
      source_project: source_project,
      received_at: new Date().toISOString(),
    };

    console.log('Bid record to process:', JSON.stringify(bidRecord, null, 2));

    // TODO: You can implement additional logic here:
    // 1. Store the bid in a dedicated external_bids table
    // 2. Send notification to the job owner
    // 3. Update job status if needed
    // 4. Send push notification

    console.log('=== Bid received successfully ===');

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Bid received successfully',
        job_id: job.id,
        order_code: order_code,
        bid_amount: bid_amount,
        driver_mapping_id: driverMapping?.id || null,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error receiving bid:', error);
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
