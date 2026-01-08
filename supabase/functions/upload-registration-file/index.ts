import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string;
    const path = formData.get('path') as string;

    console.log(`[upload-registration-file] Received request: bucket=${bucket}, path=${path}, file=${file?.name}, size=${file?.size}`);

    if (!file || !bucket || !path) {
      console.error('[upload-registration-file] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, bucket, path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate bucket name
    const allowedBuckets = ['avatars', 'vehicle-photos', 'driver-documents'];
    if (!allowedBuckets.includes(bucket)) {
      console.error(`[upload-registration-file] Invalid bucket: ${bucket}`);
      return new Response(
        JSON.stringify({ error: 'Invalid bucket name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}-${Date.now()}.${fileExt}`;

    console.log(`[upload-registration-file] Uploading to ${bucket}/${fileName}...`);

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[upload-registration-file] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);

    console.log(`[upload-registration-file] Success: ${publicUrl}`);

    return new Response(
      JSON.stringify({ url: publicUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[upload-registration-file] Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
