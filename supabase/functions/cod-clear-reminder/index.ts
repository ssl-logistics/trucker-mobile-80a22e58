// Cron-invoked at 05:00 and 05:30 Bangkok time. Finds drivers with closed
// COD orders still pending clearance and sends push + in-app reminders.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
// Same key the app uses for driver-checkin.
const EXTERNAL_API_KEY = Deno.env.get('EXPRESS_RENT_API_KEY') || Deno.env.get('EXTERNAL_API_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'x-api-key': EXTERNAL_API_KEY };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const res = await fetch(`${EXTERNAL_API_URL}/get-driver-checkins?order_number=all&limit=20000`, { headers: H });
    if (!res.ok) throw new Error(`checkins ${res.status}`);
    const json = await res.json();
    const checkins: any[] = json?.data || [];
    const cutoff = Date.now() - 30 * 86400000;

    // order -> driver
    const orderDriver = new Map<string, string>();
    for (const c of checkins) {
      const isCod = c?.checkin_type === 'payment' || String(c?.payment_method || '').toLowerCase() === 'cod'
        || (Array.isArray(c?.cod_proof_urls) && c.cod_proof_urls.length > 0);
      if (!isCod) continue;
      const t = new Date(c.checked_in_at || c.created_at || 0).getTime();
      if (t && t < cutoff) continue;
      const num = c.transport_orders?.order_number || c.order_number;
      const on = num ? `order_number=${encodeURIComponent(num)}` : (c.transport_order_id ? `order_id=${encodeURIComponent(c.transport_order_id)}` : '');
      const d = c.freelance_driver_id || c.internal_driver_id || c.external_driver_id || c.driver_id;
      if (on && d) orderDriver.set(on, d);
    }

    const pendingByDriver = new Map<string, { count: number; total: number }>();
    const orders = [...orderDriver.keys()];
    for (let i = 0; i < orders.length; i += 5) {
      await Promise.all(orders.slice(i, i + 5).map(async (on) => {
        try {
          const r = await fetch(`${EXTERNAL_API_URL}/driver-cod-clear?${on}`, { headers: H });
          if (!r.ok) return;
          const d = (await r.json())?.data;
          if (d?.status !== 'pending' || (d.order_status && !['closed','completed','delivered'].includes(String(d.order_status).toLowerCase()))) return;
          const drv = orderDriver.get(on)!;
          const cur = pendingByDriver.get(drv) || { count: 0, total: 0 };
          cur.count++; cur.total += Number(d.expected_total) || 0;
          pendingByDriver.set(drv, cur);
        } catch { /* skip */ }
      }));
    }

    const slot = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16); // Bangkok yyyy-mm-ddThh:mm
    const sent: string[] = [];
    for (const [driverId, { count, total }] of pendingByDriver) {
      const amt = total.toLocaleString('en-US');
      const referenceId = `cod_clear:${slot}`;
      const { data: ex } = await supabase.from('notifications').select('id').eq('user_id', driverId).eq('reference_id', referenceId).limit(1);
      if (ex?.length) continue;
      const row = {
        user_id: driverId,
        title_th: '💰 มียอด COD ค้างเคลียร์',
        title_en: '💰 COD waiting to be cleared',
        title_zh: '💰 有待结清的货款',
        title_ko: '💰 정산 대기 중인 COD',
        description_th: `คุณมี ${count} งานค้างเคลียร์ยอด รวม ฿${amt} กรุณาเคลียร์ยอด`,
        description_en: `You have ${count} job(s) with ฿${amt} COD to clear. Please clear it.`,
        description_zh: `您有 ${count} 个订单待结清，共 ฿${amt}，请尽快结清。`,
        description_ko: `정산할 작업 ${count}건, 총 ฿${amt}입니다. 정산해 주세요.`,
        notification_type: 'cod_clear',
        reference_id: referenceId,
        reference_type: 'cod_clear',
      };
      const { error } = await supabase.from('notifications').insert(row);
      if (error) { console.error('[CodClearReminder] insert', error); continue; }
      supabase.functions.invoke('send-push-notification', {
        body: { user_id: driverId, title: row.title_th, body: row.description_th, tag: referenceId, data: { type: 'cod_clear', url: '/cod-clear' } },
      }).catch((e) => console.error('[CodClearReminder] push', e));
      sent.push(driverId);
    }
    return new Response(JSON.stringify({ success: true, checked: orders.length, notified: sent.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[CodClearReminder] fatal', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
