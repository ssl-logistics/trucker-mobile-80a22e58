// One-shot notifier — fired by the client right after the driver confirms
// container pickup on a BL job. Sends a single in-app + push notification
// telling the driver they must return the empty container within
// `container_free_days` days. The countdown banner on the job page handles
// the live ticking; this function only emits the initial heads-up.
//
// Idempotent: dedupe by (user_id, reference_id) so re-submission is safe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.user_id;
    const orderNumber: string | undefined = body.order_number;
    const containerNumber: string | undefined = body.container_number;
    const freeDaysRaw = body.container_free_days;
    const parsedFreeDays = Number(freeDaysRaw);
    // Default to 2 days if office hasn't configured container_free_days.
    const freeDays = Number.isFinite(parsedFreeDays) && parsedFreeDays > 0 ? parsedFreeDays : 2;

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

    const referenceId = `container_return_deadline:${orderNumber}`;

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
    const titleTh = '⏰ กำหนดคืนตู้คอนเทนเนอร์';
    const titleEn = '⏰ Container return deadline';
    const descTh = `งาน ${orderNumber}${containerLabel}: คุณต้องคืนตู้เปล่าภายใน ${freeDays} วัน นับจากเวลาที่รับตู้`;
    const descEn = `Job ${orderNumber}${containerLabel}: please return the empty container within ${freeDays} day(s) of pickup.`;

    const { error: insertErr } = await supabase.from('notifications').insert({
      user_id: userId,
      title_th: titleTh,
      title_en: titleEn,
      description_th: descTh,
      description_en: descEn,
      notification_type: 'container_return_deadline',
      reference_id: referenceId,
      reference_type: 'job',
    });

    if (insertErr) {
      console.error('[notify-container-return-deadline] insert error', insertErr);
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
          data: { reference_id: orderNumber, type: 'container_return_deadline' },
        },
      })
      .catch((e) => console.error('[notify-container-return-deadline] push error', e));

    return new Response(
      JSON.stringify({ success: true, reference_id: referenceId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[notify-container-return-deadline] fatal', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
