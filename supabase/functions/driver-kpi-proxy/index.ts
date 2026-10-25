// Proxies driver-kpi on the main server so the API key stays server-side.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const UPSTREAM = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/driver-kpi';
const ALLOWED = ['license_plate', 'driver_name', 'company_id', 'from', 'to', 'limit', 'offset'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const key = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!key) return json({ success: false, error: 'key not configured' }, 500);
    const url = new URL(req.url);
    const out = new URL(UPSTREAM);
    for (const k of ALLOWED) {
      const v = url.searchParams.get(k);
      if (v) out.searchParams.set(k, v.slice(0, 100));
    }
    if (!out.searchParams.get('license_plate') && !out.searchParams.get('driver_name') && !out.searchParams.get('company_id'))
      return json({ success: false, error: 'FILTER_REQUIRED' }, 400);
    const r = await fetch(out, { headers: { 'x-api-key': key } });
    return new Response(await r.text(), { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
