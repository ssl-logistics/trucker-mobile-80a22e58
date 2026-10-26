import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SHOP_ID = Deno.env.get('SAHAPHAN_SHOP_ID') || '24257929-346e-415c-a6e0-e64f90d78266'; // Test shop by default
const API_URL = 'https://qbamcmcbmmmsdkzebtbw.supabase.co/functions/v1/public-payment-api';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), amount: z.number().positive().max(1_000_000), reference: z.string().max(100).optional(), qr_provider: z.enum(['thai_qr', 'bot_qr']).optional() }),
  z.object({ action: z.literal('status'), payment_id: z.string().min(1).max(100) }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = API_URL;
  const id = Deno.env.get('SAHAPHAN_CLIENT_ID');
  const secret = Deno.env.get('SAHAPHAN_CLIENT_SECRET');
  if (!id || !secret) return json({ success: false, error: 'payment not configured' }, 500);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400);
  const p = parsed.data;
  const payload = p.action === 'create'
    ? { action: 'create_and_process', amount: Math.round(p.amount * 100) / 100, payment_method: 'qr_code', qr_provider: p.qr_provider ?? 'bot_qr', shop_id: SHOP_ID, description: 'COD', reference: p.reference }
    : { action: 'status', payment_id: p.payment_id };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: any; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 500) }; }
    const qr = data?.qr_code ?? data?.data?.qr_code;
    const out = {
      success: r.ok && data?.success !== false,
      http_status: r.status,
      payment_id: data?.payment_id ?? data?.data?.payment_id ?? (p.action === 'status' ? p.payment_id : null),
      status: data?.status ?? data?.data?.status ?? null,
      qr_image_url: typeof qr === 'object' ? qr?.qr_image_url ?? null : null,
      qr_raw_data: typeof qr === 'object' ? qr?.qr_raw_data ?? null : (typeof qr === 'string' ? qr : null),
      expires_at: (typeof qr === 'object' ? qr?.expires_at : null) ?? data?.expires_at ?? null,
      error: r.ok ? undefined : (data?.error?.message || data?.error || data?.message || 'error'),
      request_id: data?.request_id,
      detail: r.ok ? undefined : (data?.details ?? data?.error?.details ?? data),
    };
    return json(out, r.ok ? 200 : r.status);
  } catch (e) {
    return json({ success: false, error: 'network', detail: String(e) }, 502);
  }
});
