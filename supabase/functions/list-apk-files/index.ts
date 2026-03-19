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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Name patterns for matching root-level files to app types
    const namePatterns: Record<string, string[]> = {
      trucker: ['trucker'],
      dealer: ['dealer'],
      pos: ['pos'],
    };
    const patterns = namePatterns[folder] || [folder];

    // List files in the app-specific subfolder
    const { data: folderData } = await supabaseAdmin.storage.from('apk-files').list(folder, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

    const files = (folderData || [])
      .filter(f => f.name && !f.name.startsWith('.') && f.id)
      .map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        created_at: f.created_at || '',
        url: `${supabaseUrl}/storage/v1/object/public/apk-files/${folder}/${encodeURIComponent(f.name)}`,
        folder,
      }));

    // Also include root-level files that match this app's name pattern
    const { data: rootData } = await supabaseAdmin.storage.from('apk-files').list('', {
      sortBy: { column: 'created_at', order: 'desc' },
    });
    const rootFiles = (rootData || [])
      .filter(f => {
        if (!f.name || !f.id) return false;
        const lower = f.name.toLowerCase();
        if (!lower.endsWith('.apk')) return false;
        return patterns.some(p => lower.includes(p));
      })
      .map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        created_at: f.created_at || '',
        url: `${supabaseUrl}/storage/v1/object/public/apk-files/${encodeURIComponent(f.name)}`,
        folder: '',
      }));
    files.push(...rootFiles);
    files.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

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
