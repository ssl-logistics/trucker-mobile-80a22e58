import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing jobId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Job fetch error:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has access to this job
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .select('*')
      .eq('job_id', jobId)
      .eq('driver_id', user.id)
      .maybeSingle();

    if (appError) {
      console.error('Application fetch error:', appError);
      return new Response(
        JSON.stringify({ error: 'Error checking job access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!application) {
      return new Response(
        JSON.stringify({ error: 'Access denied - you have not applied to this job' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return different data based on action
    if (action === 'pickup') {
      // Return pickup point details
      const pickupDetails = {
        location: job.origin_location,
        latitude: job.origin_latitude,
        longitude: job.origin_longitude,
        contactPerson: job.origin_contact_person,
        contactRole: job.origin_contact_role,
        goodsType: job.origin_goods_type,
        goodsQuantity: job.origin_goods_quantity,
        billOfLading: job.origin_bill_of_lading,
        remarks: job.origin_remarks,
        date: job.start_date,
        time: job.start_time,
        orderCode: job.order_code
      };

      return new Response(
        JSON.stringify(pickupDetails),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'delivery') {
      // Return delivery point details
      const deliveryDetails = {
        location: job.destination_location,
        latitude: job.destination_latitude,
        longitude: job.destination_longitude,
        contactPerson: job.destination_contact_person,
        goodsType: job.destination_goods_type,
        goodsQuantity: job.destination_goods_quantity,
        billOfLading: job.destination_bill_of_lading,
        remarks: job.destination_remarks,
        time: job.destination_time,
        orderCode: job.order_code
      };

      return new Response(
        JSON.stringify(deliveryDetails),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'details' || !action) {
      // Return full job details with both pickup and delivery
      const fullDetails = {
        jobId: job.id,
        orderCode: job.order_code,
        employerName: job.employer_name,
        jobType: job.job_type,
        transportType: job.transport_type,
        price: job.price,
        status: job.status,
        startDate: job.start_date,
        pickup: {
          location: job.origin_location,
          latitude: job.origin_latitude,
          longitude: job.origin_longitude,
          contactPerson: job.origin_contact_person,
          contactRole: job.origin_contact_role,
          goodsType: job.origin_goods_type,
          goodsQuantity: job.origin_goods_quantity,
          billOfLading: job.origin_bill_of_lading,
          remarks: job.origin_remarks,
          time: job.start_time
        },
        delivery: {
          location: job.destination_location,
          latitude: job.destination_latitude,
          longitude: job.destination_longitude,
          contactPerson: job.destination_contact_person,
          goodsType: job.destination_goods_type,
          goodsQuantity: job.destination_goods_quantity,
          billOfLading: job.destination_bill_of_lading,
          remarks: job.destination_remarks,
          time: job.destination_time
        },
        containerCheckpoint: job.container_checkpoint ? {
          location: job.container_checkpoint,
          code: job.container_checkpoint_code,
          latitude: job.container_checkpoint_latitude,
          longitude: job.container_checkpoint_longitude
        } : null,
        containerInfo: job.transport_type === 'international' ? {
          containerNumber: job.container_number,
          sealNumber: job.seal_number,
          emptyContainerDate: job.empty_container_date
        } : null,
        applicationStatus: application.status,
        checkedInAt: application.checked_in_at,
        sopCompletedAt: application.sop_completed_at,
        containerCheckedInAt: application.container_checked_in_at,
        containerSopCompletedAt: application.container_sop_completed_at,
        deliveryCheckedInAt: application.delivery_checked_in_at,
        deliverySopCompletedAt: application.delivery_sop_completed_at,
        jobStartedAt: application.job_started_at,
        paymentMethod: application.payment_method,
        paymentCompletedAt: application.payment_completed_at
      };

      return new Response(
        JSON.stringify(fullDetails),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action parameter. Use: details, pickup, or delivery' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in job-api function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
