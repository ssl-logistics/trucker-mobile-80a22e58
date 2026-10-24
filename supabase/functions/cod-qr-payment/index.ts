import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SHOP_ID = '581c4aa6-cd23-432d-a60e-748111e0514a';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), amount: z.number().positive().max(1_000_000) }),
  z.object({ action: z.literal('status'), payment_id: z.string().min(1).max(100) }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SAHAPHAN_PAYMENT_API_URL');
  const id = Deno.env.get('SAHAPHAN_CLIENT_ID');
  const secret = Deno.env.get('SAHAPHAN_CLIENT_SECRET');
  if (!url || !id || !secret) return json({ success: false, error: 'payment not configured' }, 500);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400);
  const p = parsed.data;
  const payload = p.action === 'create'
    ? { action: 'create_and_process', mode: 'live', amount: Math.round(p.amount * 100) / 100, payment_method: 'qr_code', qr_provider: 'bot_qr', shop_id: SHOP_ID }
    : { action: 'status', mode: 'live', payment_id: p.payment_id };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: any; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    const out = {
      success: r.ok && data?.success !== false,
      http_status: r.status,
      payment_id: data?.payment_id ?? data?.data?.payment_id ?? p.action === 'status' && p.payment_id || null,
      status: data?.status ?? data?.data?.status ?? null,
      qr_code: data?.qr_code ?? data?.data?.qr_code ?? null,
      error: r.ok ? undefined : (data?.error?.message || data?.error || data?.message || 'error'),
      request_id: data?.request_id,
    };
    return json(out, r.ok ? 200 : r.status);
  } catch (e) {
    return json({ success: false, error: 'network', detail: String(e) }, 502);
  }
});
