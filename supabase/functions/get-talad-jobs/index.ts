import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TALAD_API_URL = 'https://dqjxjqtlpicpfahiksoy.supabase.co/functions/v1/talad-push-job';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TALAD_API_KEY') ?? '';
    if (!apiKey) {
      console.error('[get-talad-jobs] TALAD_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'TALAD_API_KEY not configured', jobs: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    console.log('[get-talad-jobs] Fetching talad jobs', JSON.stringify(body));

    const response = await fetch(TALAD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body ?? {}),
    });

    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!response.ok) {
      console.error(`[get-talad-jobs] Upstream error ${response.status}:`, text.slice(0, 500));
      return new Response(JSON.stringify({ error: `Upstream error ${response.status}`, jobs: [] }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jobs = Array.isArray(data?.jobs) ? data.jobs : (Array.isArray(data?.data) ? data.data : []);
    console.log(`[get-talad-jobs] Received ${jobs.length} jobs`);

    return new Response(JSON.stringify({ ok: true, count: jobs.length, jobs }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[get-talad-jobs] Error:', message);
    return new Response(JSON.stringify({ error: message, jobs: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
