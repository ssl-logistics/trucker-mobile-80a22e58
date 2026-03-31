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
    const body = await req.json().catch(() => ({}));
    const { appType, listApps } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Mode: list all available app folders
    if (listApps) {
      const { data: rootData } = await supabaseAdmin.storage.from('apk-files').list('', {
        sortBy: { column: 'name', order: 'asc' },
      });

      // Collect folder names (entries without an id)
      const folders = (rootData || [])
        .filter(f => f.name && !f.name.startsWith('.') && !f.id)
        .map(f => f.name);

      // Also detect "apps" from root-level APK files by using filename (without extension) as app name
      const rootApkApps = new Set<string>();
      (rootData || []).forEach(f => {
        if (f.name && f.id && f.name.toLowerCase().endsWith('.apk')) {
          const appName = f.name.replace(/\.apk$/i, '');
          rootApkApps.add(appName);
        }
      });

      // Merge: folders + root APK app names (deduplicated)
      const allApps = [...new Set([...folders, ...rootApkApps])];
      allApps.sort((a, b) => a.localeCompare(b));

      // For each folder-based app, check if icon file exists
      const appDetails = await Promise.all(allApps.map(async (appName) => {
        let iconUrl: string | null = null;
        if (folders.includes(appName)) {
          const { data: folderFiles } = await supabaseAdmin.storage.from('apk-files').list(appName, {});
          const iconFile = (folderFiles || []).find(f =>
            f.name && f.id && /^icon\.(png|jpg|jpeg|svg|webp)$/i.test(f.name)
          );
          if (iconFile) {
            iconUrl = `${supabaseUrl}/storage/v1/object/public/apk-files/${appName}/${iconFile.name}`;
          }
        }
        return { name: appName, iconUrl };
      }));

      return new Response(JSON.stringify({ apps: appDetails.map(a => a.name), appDetails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: list files for a specific app
    const folder = appType || 'trucker';

    // List files in the app-specific subfolder
    const { data: folderData } = await supabaseAdmin.storage.from('apk-files').list(folder, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

    const files = (folderData || [])
      .filter(f => f.name && !f.name.startsWith('.') && f.id && f.name.toLowerCase().endsWith('.apk'))
      .map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        created_at: f.created_at || '',
        url: `${supabaseUrl}/storage/v1/object/public/apk-files/${folder}/${encodeURIComponent(f.name)}`,
        folder,
      }));

    // Also include root-level files that match this app's name exactly
    const { data: rootData } = await supabaseAdmin.storage.from('apk-files').list('', {
      sortBy: { column: 'created_at', order: 'desc' },
    });
    const rootFiles = (rootData || [])
      .filter(f => {
        if (!f.name || !f.id) return false;
        const lower = f.name.toLowerCase();
        if (!lower.endsWith('.apk')) return false;
        const fileAppName = f.name.replace(/\.apk$/i, '');
        return fileAppName === folder || lower.includes(folder.toLowerCase());
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
