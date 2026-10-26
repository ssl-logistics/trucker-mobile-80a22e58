// Proxies driver-cod-clear on the main server: its CORS blocks x-api-key from the browser.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const UPSTREAM = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/driver-cod-clear';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const key = Deno.env.get('EXPRESS_RENT_API_KEY');
    if (!key) return json({ success: false, error: 'key not configured' }, 500);
    const url = new URL(req.url);
    const out = new URL(UPSTREAM);
    if (req.method === 'GET') {
      const on = url.searchParams.get('order_number');
      const id = url.searchParams.get('order_id');
      if (!on && !id) return json({ success: false, error: 'order_number or order_id required' }, 400);
      if (on) out.searchParams.set('order_number', on.slice(0, 100));
      else out.searchParams.set('order_id', id!.slice(0, 100));
    } else if (req.method !== 'POST') {
      return json({ success: false, error: 'method not allowed' }, 405);
    }
    const body = req.method === 'POST' ? await req.text() : undefined;
    const r = await fetch(out, {
      method: req.method,
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body,
    });
    const text = await r.text();
    if (r.status >= 400) console.log('upstream rejected', req.method, r.status, text.slice(0, 1000), body?.slice(0, 500));
    return new Response(text, { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
