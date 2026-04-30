// One-shot notifier for Booking jobs — fires right after the driver confirms
// empty container pickup. Tells the driver the CY closing date deadline
// (when the loaded container must be returned to the port). Sends a single
// in-app notification + push notification.
//
// Idempotent: dedupes by (user_id, reference_id) so re-submission is safe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatThaiDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatEnDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.user_id;
    const orderNumber: string | undefined = body.order_number;
    const containerNumber: string | undefined = body.container_number;
    const bookingNo: string | undefined = body.booking_no;
    const closingTime: string | undefined = body.closing_time;

    if (!userId || !orderNumber) {
      return new Response(
        JSON.stringify({ error: 'user_id and order_number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const referenceId = `booking_closing_date:${orderNumber}`;

    // Dedupe: skip if we already notified this driver for this job.
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('reference_id', referenceId)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ skipped: 'already notified', reference_id: referenceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const containerLabel = containerNumber ? ` (ตู้ ${containerNumber})` : '';
    const containerLabelEn = containerNumber ? ` (container ${containerNumber})` : '';
    const bookingLabel = bookingNo ? ` Booking ${bookingNo}` : '';

    const hasClosing = !!closingTime;
    const closingTh = hasClosing ? formatThaiDateTime(closingTime!) : '';
    const closingEn = hasClosing ? formatEnDateTime(closingTime!) : '';

    const titleTh = '⏰ กำหนดคืนตู้ลงท่า (Closing Date)';
    const titleEn = '⏰ CY Closing Date deadline';
    const descTh = hasClosing
      ? `งาน ${orderNumber}${bookingLabel}${containerLabel}: คุณต้องนำตู้คืนลงท่าให้เสร็จก่อน ${closingTh} ห้ามเกินวันและเวลาที่กำหนด`
      : `งาน ${orderNumber}${bookingLabel}${containerLabel}: กรุณานำตู้คืนลงท่าให้ทันกำหนด Closing Date ห้ามเกินวันที่ระบบกำหนด`;
    const descEn = hasClosing
      ? `Job ${orderNumber}${bookingLabel ? ` Booking ${bookingNo}` : ''}${containerLabelEn}: please return the loaded container to the port before ${closingEn}. Do not exceed the closing time.`
      : `Job ${orderNumber}${bookingLabel ? ` Booking ${bookingNo}` : ''}${containerLabelEn}: please return the loaded container to the port before the CY closing date. Do not exceed the deadline.`;

    const { error: insertErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title_th: titleTh,
      title_en: titleEn,
      description_th: descTh,
      description_en: descEn,
      notification_type: 'booking_closing_date',
      reference_id: referenceId,
      reference_type: 'job',
    });

    if (insertErr) {
      console.error('[notify-booking-closing-date] insert error', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fire-and-forget push.
    supabase.functions
      .invoke('send-push-notification', {
        body: {
          user_id: userId,
          title: titleTh,
          body: descTh,
          tag: referenceId,
          data: { reference_id: orderNumber, type: 'booking_closing_date' },
        },
      })
      .catch((e) => console.error('[notify-booking-closing-date] push error', e));

    return new Response(
      JSON.stringify({ success: true, reference_id: referenceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[notify-booking-closing-date] fatal', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
