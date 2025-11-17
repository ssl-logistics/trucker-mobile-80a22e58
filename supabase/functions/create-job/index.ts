import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DomesticJobData {
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list?: string;
  safety_equipment?: string;
  province?: string;
  district?: string;
}

interface InternationalJobData extends DomesticJobData {
  container_checkpoint: string;
  container_checkpoint_code: string;
  empty_container_date: string;
  container_number: string;
  seal_number: string;
  origin_contact_person: string;
  origin_contact_role: string;
  origin_bill_of_lading: string;
  origin_goods_type: string;
  origin_goods_quantity: string;
  origin_remarks?: string;
  destination_contact_person: string;
  destination_bill_of_lading: string;
  destination_goods_type: string;
  destination_goods_quantity: string;
  destination_time?: string;
  destination_remarks?: string;
}

interface CreateJobRequest {
  job_category: 'domestic' | 'international';
  job_data: DomesticJobData | InternationalJobData;
  assigned_role?: 'freelance' | 'company' | 'factory';
}

function validateDomesticJob(data: DomesticJobData): string | null {
  const required = [
    'order_code',
    'job_type',
    'employer_name',
    'transport_type',
    'origin_location',
    'destination_location',
    'price',
    'start_date',
    'start_time'
  ];

  for (const field of required) {
    if (!data[field as keyof DomesticJobData]) {
      return `Missing required field: ${field}`;
    }
  }

  if (typeof data.price !== 'number' || data.price <= 0) {
    return 'Price must be a positive number';
  }

  return null;
}

function validateInternationalJob(data: InternationalJobData): string | null {
  // First validate domestic job fields
  const domesticError = validateDomesticJob(data);
  if (domesticError) return domesticError;

  const additionalRequired = [
    'container_checkpoint',
    'container_checkpoint_code',
    'empty_container_date',
    'container_number',
    'seal_number',
    'origin_contact_person',
    'origin_contact_role',
    'origin_bill_of_lading',
    'origin_goods_type',
    'origin_goods_quantity',
    'destination_contact_person',
    'destination_bill_of_lading',
    'destination_goods_type',
    'destination_goods_quantity'
  ];

  for (const field of additionalRequired) {
    if (!data[field as keyof InternationalJobData]) {
      return `Missing required field: ${field}`;
    }
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Create Job API Called ===');
    console.log('Timestamp:', new Date().toISOString());

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const requestData: CreateJobRequest = await req.json();
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const { job_category, job_data, assigned_role } = requestData;

    // Validate job category
    if (!job_category || !['domestic', 'international'].includes(job_category)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid job_category. Must be either "domestic" or "international"'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate job data
    let validationError: string | null = null;
    if (job_category === 'domestic') {
      validationError = validateDomesticJob(job_data);
    } else {
      validationError = validateInternationalJob(job_data as InternationalJobData);
    }

    if (validationError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: validationError
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Prepare job record for insertion
    const jobRecord: any = {
      order_code: job_data.order_code,
      job_type: job_data.job_type,
      employer_name: job_data.employer_name,
      transport_type: job_data.transport_type,
      origin_location: job_data.origin_location,
      destination_location: job_data.destination_location,
      price: job_data.price,
      start_date: job_data.start_date,
      start_time: job_data.start_time,
      equipment_list: job_data.equipment_list || null,
      safety_equipment: job_data.safety_equipment || null,
      province: job_data.province || null,
      district: job_data.district || null,
      assigned_role: assigned_role || null,
      status: 'available'
    };

    // Add international job fields if applicable
    if (job_category === 'international') {
      const intData = job_data as InternationalJobData;
      jobRecord.container_checkpoint = intData.container_checkpoint;
      jobRecord.container_checkpoint_code = intData.container_checkpoint_code;
      jobRecord.empty_container_date = intData.empty_container_date;
      jobRecord.container_number = intData.container_number;
      jobRecord.seal_number = intData.seal_number;
      jobRecord.origin_contact_person = intData.origin_contact_person;
      jobRecord.origin_contact_role = intData.origin_contact_role;
      jobRecord.origin_bill_of_lading = intData.origin_bill_of_lading;
      jobRecord.origin_goods_type = intData.origin_goods_type;
      jobRecord.origin_goods_quantity = intData.origin_goods_quantity;
      jobRecord.origin_remarks = intData.origin_remarks || null;
      jobRecord.destination_contact_person = intData.destination_contact_person;
      jobRecord.destination_bill_of_lading = intData.destination_bill_of_lading;
      jobRecord.destination_goods_type = intData.destination_goods_type;
      jobRecord.destination_goods_quantity = intData.destination_goods_quantity;
      jobRecord.destination_time = intData.destination_time || null;
      jobRecord.destination_remarks = intData.destination_remarks || null;
    }

    console.log('Inserting job record:', JSON.stringify(jobRecord, null, 2));

    // Insert job into database
    const { data: insertedJob, error: insertError } = await supabase
      .from('jobs')
      .insert(jobRecord)
      .select('id')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: `Failed to create job: ${insertError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Job created successfully:', insertedJob.id);

    return new Response(
      JSON.stringify({
        status: 'success',
        jobId: insertedJob.id,
        message: 'Job created successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
