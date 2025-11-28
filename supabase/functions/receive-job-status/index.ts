import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobStatusPayload {
  external_job_id: string;
  status: string;
  driver_name: string;
  driver_phone: string;
  license_plate: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: JobStatusPayload = await req.json();

    console.log('=== Received Job Status Update ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const requiredFields = ['external_job_id', 'status', 'driver_name', 'driver_phone', 'license_plate'];
    const missingFields = requiredFields.filter(field => !payload[field as keyof JobStatusPayload]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the job status update for external integration
    console.log('Job Status Update:');
    console.log('- External Job ID:', payload.external_job_id);
    console.log('- Status:', payload.status);
    console.log('- Driver Name:', payload.driver_name);
    console.log('- Driver Phone:', payload.driver_phone);
    console.log('- License Plate:', payload.license_plate);

    // TODO: Forward to external system if needed
    // const externalResponse = await fetch('https://external-api.com/job-status', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload)
    // });

    console.log('Job status update processed successfully');
    console.log('================================');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Job status update received',
        data: payload
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing job status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
