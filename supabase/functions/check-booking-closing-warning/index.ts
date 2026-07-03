// Cron-invoked edge function: scans Booking (outbound) jobs where the driver
// has picked up the empty container but hasn't returned the loaded container
// yet, and sends a one-shot warning when <= 6 hours remain before the CY
// closing_time deadline.
//
// Dedupes per (user_id, reference_id) so it fires exactly once per job.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
const EXTERNAL_API_KEY = Deno.env.get('EXTERNAL_API_KEY') || 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const WARN_BEFORE_HOURS = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
      console.error('[BookingClosingWarning] external API error', res.status, txt);
      return new Response(JSON.stringify({ error: 'external API failed', status: res.status }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json();
    const checkins: any[] = json?.data || json || [];

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
      const anyRow = group[0];
      const job = anyRow.transport_orders || {};

      // Booking (outbound) only — must have booking_no
      const bookingNo = job.booking_no || job.bookingNo;
      if (!bookingNo) continue;

      // Must have picked up empty container (or done any pickup) and NOT
      // returned loaded container yet.
      const hasPickup = group.some((c) =>
        ['empty_container_pickup', 'container_pickup', 'pickup_checked_in'].includes(c.checkin_type),
      );
      const returned = group.some((c) =>
        ['container_return_confirmed', 'delivery_confirmed', 'pod_uploaded'].includes(c.checkin_type),
      );
      if (!hasPickup || returned) continue;

      const closingRaw = job.closing_time || job.closingTime || job.closing_date;
      if (!closingRaw) continue;
      const closingMs = new Date(closingRaw).getTime();
      if (!Number.isFinite(closingMs) || !closingMs) continue;

      const hoursRemaining = (closingMs - now) / 3_600_000;
      // Only fire once, when entering the warn window (still positive).
      if (hoursRemaining > WARN_BEFORE_HOURS || hoursRemaining <= 0) continue;

      const driverId =
        anyRow.freelance_driver_id ||
        anyRow.internal_driver_id ||
        anyRow.external_driver_id;
      if (!driverId) continue;

      const referenceId = `booking_closing_warning:${orderNumber}`;

      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', driverId)
        .eq('reference_id', referenceId)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const hoursDisplay = Math.max(1, Math.floor(hoursRemaining));
      const closingLocal = new Date(closingMs).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const titleTh = '⚠️ ใกล้ถึงเวลา Closing Time';
      const titleEn = '⚠️ Booking closing time approaching';
      const descTh = `งาน ${orderNumber}: เหลือเวลา ~${hoursDisplay} ชม. ก่อนปิดรับตู้ (${closingLocal}) กรุณารีบคืนตู้`;
      const descEn = `Job ${orderNumber}: ~${hoursDisplay}h left before CY closing (${closingLocal}). Please return container ASAP.`;

      const { error: insertErr } = await supabase.from('notifications').insert({
        user_id: driverId,
        title_th: titleTh,
        title_en: titleEn,
        description_th: descTh,
        description_en: descEn,
        notification_type: 'booking_closing_warning',
        reference_id: referenceId,
        reference_type: 'job',
      });

      if (insertErr) {
        console.error('[BookingClosingWarning] insert error', insertErr);
        continue;
      }

      supabase.functions
        .invoke('send-push-notification', {
          body: {
            user_id: driverId,
            title: titleTh,
            body: descTh,
            tag: referenceId,
            data: { reference_id: orderNumber, type: 'booking_closing_warning' },
          },
        })
        .catch((e) => console.error('[BookingClosingWarning] push error', e));

      sent.push(orderNumber);
    }

    console.log(`[BookingClosingWarning] notified ${sent.length}`, sent);
    return new Response(JSON.stringify({ success: true, notified: sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[BookingClosingWarning] fatal', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
