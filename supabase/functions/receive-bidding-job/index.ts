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

    const data = await req.json();
    
    console.log('=== Received Bidding Job Data ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Data:', JSON.stringify(data, null, 2));

    // Mapping for job_type
    const jobTypeMapping: Record<string, string> = {
      'urgent': 'งานด่วน',
      'daily': 'งานรายวัน',
      'contract': 'งานสัญญาจ้าง',
      'domestic': 'งานรายวัน',
      'bidding': 'งานสัญญาจ้าง', // bidding jobs map to contract type
      'งานด่วน': 'งานด่วน',
      'งานรายวัน': 'งานรายวัน',
      'งานสัญญาจ้าง': 'งานสัญญาจ้าง'
    };

    // Mapping for transport_type
    const transportTypeMapping: Record<string, string> = {
      'single': 'ขนส่งเที่ยวเดียว',
      'single_trip': 'ขนส่งเที่ยวเดียว',
      'one_way': 'ขนส่งเที่ยวเดียว',
      'round_trip': 'ขนส่งเที่ยวเดียว',
      'contract': 'ขนส่งเที่ยวเดียว', // contract transport type maps to single trip
      'multi': 'ขนส่งหลายที่',
      'multiple': 'ขนส่งหลายที่',
      'multi_stop': 'ขนส่งหลายที่',
      'import': 'ขนส่งขาเข้า',
      'inbound': 'ขนส่งขาเข้า',
      'export': 'ขนส่งขาออก',
      'outbound': 'ขนส่งขาออก',
      'ขนส่งเที่ยวเดียว': 'ขนส่งเที่ยวเดียว',
      'ขนส่งหลายที่': 'ขนส่งหลายที่',
      'ขนส่งขาเข้า': 'ขนส่งขาเข้า',
      'ขนส่งขาออก': 'ขนส่งขาออก'
    };

    // Auto-convert job_type if provided
    if (data.job_type) {
      const mappedJobType = jobTypeMapping[data.job_type.toLowerCase()];
      if (mappedJobType) {
        console.log(`Mapped job_type: ${data.job_type} -> ${mappedJobType}`);
        data.job_type = mappedJobType;
      }
    }

    // Auto-convert transport_type if provided
    if (data.transport_type) {
      const mappedTransportType = transportTypeMapping[data.transport_type.toLowerCase()];
      if (mappedTransportType) {
        console.log(`Mapped transport_type: ${data.transport_type} -> ${mappedTransportType}`);
        data.transport_type = mappedTransportType;
      }
    }

    // Validate required fields
    const requiredFields = ['order_code', 'employer_name', 'job_type', 'transport_type', 
                           'origin_location', 'destination_location', 'start_date', 'start_time'];
    
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
          valid_values: validJobTypes
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
          valid_values: validTransportTypes
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Helper function to convert array to comma-separated string
    const arrayToString = (value: any): string | null => {
      if (!value) return null;
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    };

    // Prepare job data - bidding jobs have status 'available' and price can be 0 (driver will bid)
    const jobData = {
      order_code: data.order_code,
      employer_name: data.employer_name,
      job_type: data.job_type,
      transport_type: data.transport_type,
      origin_location: data.origin_location,
      destination_location: data.destination_location,
      price: data.price || 0, // Price can be 0 for bidding jobs
      start_date: data.start_date,
      start_time: data.start_time,
      equipment_list: arrayToString(data.equipment_list),
      safety_equipment: arrayToString(data.safety_equipment),
      province: data.province || null,
      district: data.district || null,
      assigned_role: data.assigned_role || 'freelance',
      status: 'available', // Always available for bidding
      origin_latitude: data.origin_latitude || null,
      origin_longitude: data.origin_longitude || null,
      destination_latitude: data.destination_latitude || null,
      destination_longitude: data.destination_longitude || null,
      container_checkpoint_latitude: data.container_checkpoint_latitude || null,
      container_checkpoint_longitude: data.container_checkpoint_longitude || null,
      empty_container_date: data.empty_container_date || null,
      destination_date: data.destination_date || null,
      destination_time: data.destination_time || null,
      container_number: data.container_number || null,
      seal_number: data.seal_number || null,
      container_checkpoint: data.container_checkpoint || null,
      container_checkpoint_code: data.container_checkpoint_code || null,
      origin_contact_person: data.origin_contact_person || null,
      origin_contact_role: data.origin_contact_role || null,
      origin_bill_of_lading: data.origin_bill_of_lading || null,
      origin_goods_type: data.origin_goods_type || null,
      origin_goods_quantity: data.origin_goods_quantity || null,
      origin_remarks: data.origin_remarks || null,
      origin_address: data.origin_address || null,
      destination_contact_person: data.destination_contact_person || null,
      destination_bill_of_lading: data.destination_bill_of_lading || null,
      destination_goods_type: data.destination_goods_type || null,
      destination_goods_quantity: data.destination_goods_quantity || null,
      destination_remarks: data.destination_remarks || null,
      destination_address: data.destination_address || null,
      origin_company_name: data.origin_company_name || null,
      destination_company_name: data.destination_company_name || null,
    };

    // Upsert job into database
    const { data: upsertedJob, error: upsertError } = await supabase
      .from('jobs')
      .upsert(jobData, { 
        onConflict: 'order_code',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Database upsert error:', upsertError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to upsert job into database',
          error: upsertError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Successfully upserted bidding job:', upsertedJob.id);

    // Handle multiple destinations if provided
    let destinationsInserted = 0;
    if (data.destinations && Array.isArray(data.destinations) && data.destinations.length > 0) {
      console.log(`Processing ${data.destinations.length} destinations...`);
      
      const { error: deleteError } = await supabase
        .from('job_destinations')
        .delete()
        .eq('job_id', upsertedJob.id);
      
      if (deleteError) {
        console.error('Error deleting old destinations:', deleteError);
      }
      
      const destinationsData = data.destinations.map((dest: any) => ({
        job_id: upsertedJob.id,
        sequence_number: dest.sequence_number || 1,
        company_name: dest.company_name || null,
        contact_name: dest.contact_name || null,
        contact_phone: dest.contact_phone || null,
        address: dest.address || null,
        province: dest.province || null,
        district: dest.district || null,
        latitude: dest.latitude || null,
        longitude: dest.longitude || null,
        delivery_date: dest.delivery_date || null,
        delivery_time: dest.delivery_time || null,
        notes: dest.notes || null,
      }));
      
      const { data: insertedDestinations, error: destError } = await supabase
        .from('job_destinations')
        .insert(destinationsData)
        .select();
      
      if (destError) {
        console.error('Error inserting destinations:', destError);
      } else {
        destinationsInserted = insertedDestinations?.length || 0;
        console.log(`Successfully inserted ${destinationsInserted} destinations`);
      }
    }
    
    console.log('================================');

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Bidding job created successfully',
        job_id: upsertedJob.id,
        order_code: upsertedJob.order_code,
        destinations_count: destinationsInserted,
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
