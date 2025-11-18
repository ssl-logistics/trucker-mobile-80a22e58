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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse incoming JSON data
    const data = await req.json();
    
    // Log received data to console
    console.log('=== Received Order/Job Data ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Data:', JSON.stringify(data, null, 2));

    // Validate required fields
    const requiredFields = ['order_code', 'employer_name', 'job_type', 'transport_type', 
                           'origin_location', 'destination_location', 'price', 
                           'start_date', 'start_time'];
    
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing required fields',
          missing_fields: missingFields
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate job_type
    const validJobTypes = ['งานด่วน', 'งานรายวัน', 'งานสัญญาจ้าง'];
    if (!validJobTypes.includes(data.job_type)) {
      console.error('Invalid job_type:', data.job_type);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid job_type value',
          received_value: data.job_type,
          valid_values: validJobTypes,
          note: 'job_type must be one of the valid Thai values'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate transport_type
    const validTransportTypes = ['ขนส่งเที่ยวเดียว', 'ขนส่งหลายที่', 'ขนส่งขาเข้า', 'ขนส่งขาออก'];
    if (!validTransportTypes.includes(data.transport_type)) {
      console.error('Invalid transport_type:', data.transport_type);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid transport_type value',
          received_value: data.transport_type,
          valid_values: validTransportTypes,
          note: 'transport_type must be one of the valid Thai values'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prepare job data for insertion
    const jobData = {
      order_code: data.order_code,
      employer_name: data.employer_name,
      job_type: data.job_type,
      transport_type: data.transport_type,
      origin_location: data.origin_location,
      destination_location: data.destination_location,
      price: data.price,
      start_date: data.start_date,
      start_time: data.start_time,
      equipment_list: data.equipment_list || null,
      safety_equipment: data.safety_equipment || null,
      province: data.province || null,
      district: data.district || null,
      assigned_role: data.assigned_role || null,
      status: data.status || 'available',
      // International job fields
      empty_container_date: data.empty_container_date || null,
      destination_time: data.destination_time || null,
      container_number: data.container_number || null,
      seal_number: data.seal_number || null,
      container_checkpoint: data.container_checkpoint || null,
      container_checkpoint_code: data.container_checkpoint_code || null,
      // Pickup details
      origin_contact_person: data.origin_contact_person || null,
      origin_contact_role: data.origin_contact_role || null,
      origin_bill_of_lading: data.origin_bill_of_lading || null,
      origin_goods_type: data.origin_goods_type || null,
      origin_goods_quantity: data.origin_goods_quantity || null,
      origin_remarks: data.origin_remarks || null,
      // Delivery details
      destination_contact_person: data.destination_contact_person || null,
      destination_bill_of_lading: data.destination_bill_of_lading || null,
      destination_goods_type: data.destination_goods_type || null,
      destination_goods_quantity: data.destination_goods_quantity || null,
      destination_remarks: data.destination_remarks || null,
    };

    // Insert job into database
    const { data: insertedJob, error: insertError } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to insert job into database',
          error: insertError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Successfully inserted job:', insertedJob.id);
    console.log('================================');

    // Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Job created successfully',
        job_id: insertedJob.id,
        order_code: insertedJob.order_code,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
