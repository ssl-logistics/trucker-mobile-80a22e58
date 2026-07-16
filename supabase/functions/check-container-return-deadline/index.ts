// Cron-invoked edge function: scans for international (BL) jobs where the
// driver has done container_pickup but not yet container_return_confirmed,
// and warns the driver 24h before the 48h return deadline expires.
//
// Sends 1 push + 1 in-app notification per job (deduped via reference_id).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
const EXTERNAL_API_KEY = Deno.env.get('EXTERNAL_API_KEY') || 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const DEFAULT_RETURN_WINDOW_HOURS = 48; // fallback if container_free_days missing
// Two-stage warnings: 24h heads-up + 6h urgent reminder. Each stage has its
// own reference_id so both fire exactly once per job.
const WARN_STAGES: Array<{ hours: number; suffix: string; urgent: boolean }> = [
  { hours: 24, suffix: '', urgent: false },
  { hours: 6, suffix: ':6h', urgent: true },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pull all checkins (server-side filter would be ideal; for now fetch all)
    const res = await fetch(
      `${EXTERNAL_API_URL}/get-driver-checkins?order_number=all`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-api-key': EXTERNAL_API_KEY,
        },
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error('[ContainerReturnDeadline] external API error', res.status, txt);
      return new Response(JSON.stringify({ error: 'external API failed', status: res.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json();
    const checkins: any[] = json?.data || json || [];
    console.log(`[ContainerReturnDeadline] fetched ${checkins.length} checkins`);

    // Group by order_number
    const byOrder: Record<string, any[]> = {};
    for (const c of checkins) {
      const order = c.transport_orders?.order_number || c.order_number;
      if (!order) continue;
      (byOrder[order] ||= []).push(c);
    }

    const now = Date.now();
    const sent: string[] = [];

    for (const [orderNumber, group] of Object.entries(byOrder)) {
      const pickup = group.find((c) => c.checkin_type === 'container_pickup');
      const returned = group.find((c) => c.checkin_type === 'container_return_confirmed');
      if (!pickup || returned) continue;

      const pickupAt = new Date(pickup.checked_in_at || pickup.created_at).getTime();
      if (!pickupAt) continue;

      // Read container_free_days from the related job (set by office web).
      const job = pickup.transport_orders || {};
      const freeDaysRaw =
        job.container_free_days ??
        job.free_days ??
        pickup.container_free_days;
      const freeDays = Number(freeDaysRaw);
      const windowHours = Number.isFinite(freeDays) && freeDays > 0
        ? freeDays * 24
        : DEFAULT_RETURN_WINDOW_HOURS;

      const deadline = pickupAt + windowHours * 3600 * 1000;
      const hoursRemaining = (deadline - now) / 3600000;

      // Resolve driver_id (freelance only — internal/external have no in-app account)
      const driverId =
        pickup.freelance_driver_id ||
        pickup.internal_driver_id ||
        pickup.external_driver_id;
      if (!driverId) continue;

      // Fire the tightest applicable stage this run. Each stage dedupes on
      // its own reference_id, so 24h and 6h each fire exactly once per job.
      for (const stage of WARN_STAGES) {
        if (hoursRemaining > stage.hours) continue;

        const referenceId = `container_return_deadline:${orderNumber}${stage.suffix}`;

        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', driverId)
          .eq('reference_id', referenceId)
          .limit(1);
        if (existing && existing.length > 0) continue;

        const overdue = hoursRemaining <= 0;
        const hoursDisplay = overdue
          ? Math.ceil(-hoursRemaining)
          : Math.max(1, Math.floor(hoursRemaining));

        const urgent = stage.urgent && !overdue;

        const titleTh = overdue
          ? '⚠️ เลยกำหนดคืนตู้คอนเทนเนอร์'
          : urgent
          ? '⚠️ ใกล้ครบกำหนดคืนตู้ (เหลือ ~6 ชม.)'
          : '⏰ ใกล้ครบกำหนดคืนตู้คอนเทนเนอร์';
        const titleEn = overdue
          ? '⚠️ Container return overdue'
          : urgent
          ? '⚠️ Container return due in ~6h'
          : '⏰ Container return deadline approaching';
        const descTh = overdue
          ? `งาน ${orderNumber}: เลยกำหนดคืนตู้เปล่ามาแล้ว ${hoursDisplay} ชั่วโมง กรุณาคืนตู้โดยด่วน`
          : `งาน ${orderNumber}: ต้องคืนตู้เปล่าภายใน ${hoursDisplay} ชั่วโมง (กำหนด ${windowHours} ชม. หลังรับตู้)`;
        const descEn = overdue
          ? `Job ${orderNumber}: container return is overdue by ${hoursDisplay}h. Please return ASAP.`
          : `Job ${orderNumber}: please return the empty container within ${hoursDisplay}h (${windowHours}h after pickup).`;

        const { error: insertErr } = await supabase.from('notifications').insert({
          user_id: driverId,
          title_th: titleTh,
          title_en: titleEn,
          description_th: descTh,
          description_en: descEn,
          notification_type: 'container_return_deadline',
          reference_id: referenceId,
          reference_type: 'job',
        });

        if (insertErr) {
          console.error('[ContainerReturnDeadline] insert error', insertErr);
          continue;
        }

        supabase.functions
          .invoke('send-push-notification', {
            body: {
              user_id: driverId,
              title: titleTh,
              body: descTh,
              tag: referenceId,
              data: { reference_id: orderNumber, type: 'container_return_deadline' },
            },
          })
          .catch((e) => console.error('[ContainerReturnDeadline] push error', e));

        sent.push(`${orderNumber}${stage.suffix}`);
        break; // fire only the tightest stage per run
      }
    }


    console.log(`[ContainerReturnDeadline] notified ${sent.length} drivers`, sent);
    return new Response(JSON.stringify({ success: true, notified: sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ContainerReturnDeadline] fatal', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
