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

    const { bid_id, job_id, driver_id, bid_amount } = await req.json();

    console.log('=== Sending Bid to External Project ===');
    console.log('bid_id:', bid_id);
    console.log('job_id:', job_id);
    console.log('driver_id:', driver_id);
    console.log('bid_amount:', bid_amount);

    // Validate required fields
    if (!job_id || !driver_id || !bid_amount) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing required fields: job_id, driver_id, bid_amount'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Job not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get driver profile
    const { data: driver, error: driverError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driver_id)
      .single();

    if (driverError || !driver) {
      console.error('Driver not found:', driverError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Driver not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get driver's vehicle info
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('driver_id', driver_id)
      .single();

    // Get active external project config
    const { data: externalConfig, error: configError } = await supabase
      .from('external_chat_config')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (configError || !externalConfig) {
      console.error('No active external config found:', configError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'No active external project configuration found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build the bid payload to send to external project
    const bidPayload = {
      bid_id: bid_id,
      order_code: job.order_code,
      job_id: job_id,
      bid_amount: bid_amount,
      driver_info: {
        id: driver.id,
        full_name: driver.full_name,
        phone_number: driver.phone_number,
        avatar_url: driver.avatar_url,
      },
      vehicle_info: vehicle ? {
        plate_number: vehicle.plate_number,
        plate_province: vehicle.plate_province,
        vehicle_type: vehicle.vehicle_type,
        vehicle_brand: vehicle.vehicle_brand,
        vehicle_color: vehicle.vehicle_color,
        load_capacity: vehicle.load_capacity,
        container_types: vehicle.container_types,
      } : null,
      job_info: {
        order_code: job.order_code,
        employer_name: job.employer_name,
        job_type: job.job_type,
        transport_type: job.transport_type,
        origin_location: job.origin_location,
        destination_location: job.destination_location,
        start_date: job.start_date,
        start_time: job.start_time,
        original_price: job.price,
      },
      source_project: {
        project_id: Deno.env.get('SUPABASE_URL')?.split('//')[1]?.split('.')[0] || 'unknown',
        timestamp: new Date().toISOString(),
      }
    };

    console.log('Sending bid payload:', JSON.stringify(bidPayload, null, 2));

    // Construct the target URL for receiving bids
    // Replace 'receive-chat-message' with 'receive-bid' in the target URL
    const targetUrl = externalConfig.target_url.replace('receive-chat-message', 'receive-bid');
    
    console.log('Target URL:', targetUrl);

    // Send bid to external project
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${externalConfig.api_key}`,
      },
      body: JSON.stringify(bidPayload),
    });

    const responseText = await response.text();
    console.log('External response status:', response.status);
    console.log('External response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      console.error('Failed to send bid to external project');
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to send bid to external project',
          external_status: response.status,
          external_response: responseData
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('=== Bid sent successfully ===');

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Bid sent to external project successfully',
        bid_id: bid_id,
        order_code: job.order_code,
        external_response: responseData,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error sending bid:', error);
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
