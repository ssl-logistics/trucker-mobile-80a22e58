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
    const { appType } = await req.json().catch(() => ({}));
    const folder = appType || 'trucker';

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabaseAdmin.storage.from('apk-files').list(folder, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) throw error;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const files = (data || [])
      .filter(f => f.name && !f.name.startsWith('.') && f.id)
      .map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        created_at: f.created_at || '',
        url: `${supabaseUrl}/storage/v1/object/public/apk-files/${folder}/${encodeURIComponent(f.name)}`,
      }));

    return new Response(JSON.stringify({ files }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, files: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
