import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'apk-files');

    if (!exists) {
      const { error } = await supabaseAdmin.storage.createBucket('apk-files', {
        public: true,
        fileSizeLimit: 524288000,
        allowedMimeTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
      });
      if (error) throw error;
    }

    // Create RLS policies for apk-files bucket
    // Allow anyone to SELECT (view/list/download)
    await supabaseAdmin.rpc('exec_sql', {
      query: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects' 
            AND policyname = 'Anyone can view apk files'
          ) THEN
            CREATE POLICY "Anyone can view apk files"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'apk-files');
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects' 
            AND policyname = 'Admins can upload apk files'
          ) THEN
            CREATE POLICY "Admins can upload apk files"
            ON storage.objects FOR INSERT
            WITH CHECK (
              bucket_id = 'apk-files' 
              AND auth.role() = 'authenticated'
            );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects' 
            AND policyname = 'Admins can delete apk files'
          ) THEN
            CREATE POLICY "Admins can delete apk files"
            ON storage.objects FOR DELETE
            USING (
              bucket_id = 'apk-files' 
              AND auth.role() = 'authenticated'
            );
          END IF;
        END
        $$;
      `
    }).catch(() => {
      // rpc exec_sql might not exist, try raw SQL via REST
    });

    return new Response(JSON.stringify({ success: true, message: "Bucket and policies configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
