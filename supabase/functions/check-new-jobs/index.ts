import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
const EXTERNAL_API_KEY = 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { driver_id, driver_type, user_id } = await req.json();

    if (!driver_id || !driver_type) {
      return new Response(
        JSON.stringify({ error: 'driver_id and driver_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-new-jobs] Checking for driver: ${driver_id}, type: ${driver_type}`);

    // Fetch jobs from external API based on driver type
    let jobs: any[] = [];

    if (driver_type === 'internal' || driver_type === 'external') {
      // Fetch pending (newly assigned) jobs
      const params = new URLSearchParams({
        driver_id,
        driver_type,
        status: 'pending',
        limit: '20',
      });

      const response = await fetch(`${EXTERNAL_API_URL}/get-driver-assigned-jobs?${params}`, {
        headers: { 'x-api-key': EXTERNAL_API_KEY, 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        jobs = data?.data || [];
        console.log(`[check-new-jobs] Pending jobs: ${jobs.length}`);
      } else {
        const errText = await response.text();
        console.log(`[check-new-jobs] Pending fetch failed: ${response.status} - ${errText}`);
      }

      // Also fetch in_progress jobs (might be newly assigned)
      const params2 = new URLSearchParams({
        driver_id,
        driver_type,
        status: 'in_progress',
        limit: '20',
      });

      const response2 = await fetch(`${EXTERNAL_API_URL}/get-driver-assigned-jobs?${params2}`, {
        headers: { 'x-api-key': EXTERNAL_API_KEY, 'Content-Type': 'application/json' },
      });

      if (response2.ok) {
        const data2 = await response2.json();
        const inProgressJobs = data2?.data || [];
        console.log(`[check-new-jobs] In-progress jobs: ${inProgressJobs.length}`, JSON.stringify(data2).substring(0, 200));
        jobs = [...jobs, ...inProgressJobs];
      } else {
        const errText2 = await response2.text();
        console.log(`[check-new-jobs] In-progress fetch failed: ${response2.status} - ${errText2}`);
      }
    } else if (driver_type === 'freelance') {
      // Fetch freelance accepted jobs
      const params = new URLSearchParams({ freelance_driver_id: driver_id });
      const response = await fetch(`${EXTERNAL_API_URL}/get-freelance-accepted-jobs?${params}`, {
        headers: { 'x-api-key': EXTERNAL_API_KEY, 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        jobs = data?.data || [];
      }

      // Also check factory-assigned jobs
      const params2 = new URLSearchParams({ freelance_driver_id: driver_id, limit: '20' });
      const response2 = await fetch(`${EXTERNAL_API_URL}/get-factory-assigned-jobs?${params2}`, {
        headers: { 'x-api-key': EXTERNAL_API_KEY, 'Content-Type': 'application/json' },
      });

      if (response2.ok) {
        const data2 = await response2.json();
        const factoryJobs = data2?.data || [];
        jobs = [...jobs, ...factoryJobs];
      }
    }

    console.log(`[check-new-jobs] Found ${jobs.length} jobs from external API`);

    if (jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order numbers from jobs
    const orderNumbers = jobs
      .map((j: any) => j.order_number || j.order_code)
      .filter(Boolean);

    if (orderNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which jobs already have notifications (use reference_id to track by order_number)
    // Check both old 'new_assigned_job' and new 'new_job' types to avoid duplicates
    const { data: existingNotifs } = await supabase
      .from('notifications')
      .select('reference_id')
      .in('notification_type', ['new_job', 'new_assigned_job'])
      .in('reference_id', orderNumbers);

    const existingOrderNumbers = new Set((existingNotifs || []).map(n => n.reference_id));

    // Filter only new jobs
    const newJobs = jobs.filter((j: any) => {
      const orderNum = j.order_number || j.order_code;
      return orderNum && !existingOrderNumbers.has(orderNum);
    });

    console.log(`[check-new-jobs] ${newJobs.length} new jobs to notify`);

    if (newJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notifications for new jobs
    const notifications = newJobs.map((job: any) => {
      const origin = job.sender_name || job.sender_address || job.origin_location || 'ต้นทาง';
      const dest = job.destination_name || job.destination_address || job.destination_location || 'ปลายทาง';
      const price = job.transport_price || job.price || 0;
      
      // Use transport_type field to determine job label (matching receive function logic)
      const transportType = job.transport_type || job.transport_category || '';
      const hasMultiDest = job.destinations && job.destinations.length > 0;

      let jobLabel = 'งานใหม่';
      if (transportType === 'ขนส่งระหว่างประเทศ' || transportType === 'international') {
        jobLabel = 'งานระหว่างประเทศ';
      } else if (transportType === 'ขนส่งหลายที่' || hasMultiDest) {
        jobLabel = 'งานส่งหลายที่';
      } else if (transportType === 'ขนส่งเที่ยวเดียว') {
        jobLabel = 'งานเที่ยวเดียว';
      }

      const senderProvince = job.sender_province || '';
      const destProvince = job.destination_province || '';
      const routeDesc = senderProvince && destProvince
        ? `${senderProvince} → ${destProvince}`
        : `${origin} → ${dest}`;

      return {
        user_id: user_id || null,
        title_th: `📦 ${jobLabel}เข้ามาแล้ว!`,
        title_en: `📦 New ${jobLabel}!`,
        title_ko: `📦 새 작업이 있습니다!`,
        title_zh: `📦 新工作已到达！`,
        description_th: `${routeDesc}${price > 0 ? ` | ฿${Number(price).toLocaleString()}` : ''}`,
        description_en: `${routeDesc}${price > 0 ? ` | ฿${Number(price).toLocaleString()}` : ''}`,
        description_ko: `${routeDesc}${price > 0 ? ` | ฿${Number(price).toLocaleString()}` : ''}`,
        description_zh: `${routeDesc}${price > 0 ? ` | ฿${Number(price).toLocaleString()}` : ''}`,
        notification_type: 'new_job',
        reference_id: job.order_number || job.order_code,
        reference_type: 'job',
        is_read: false,
      };
    });

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('[check-new-jobs] Error inserting notifications:', insertError);
    } else {
      console.log(`[check-new-jobs] Created ${notifications.length} notifications`);
    }

    // Send push notifications
    if (user_id && notifications.length > 0) {
      try {
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('user_id')
          .eq('user_id', user_id);

        if (subscriptions && subscriptions.length > 0) {
          const firstJob = newJobs[0];
          const pushTitle = notifications[0].title_th;
          const pushBody = notifications.length === 1
            ? notifications[0].description_th
            : `คุณมี ${notifications.length} งานใหม่`;

          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              user_ids: [user_id],
              title: pushTitle,
              body: pushBody,
              data: {
                type: 'new_assigned_job',
                order_number: firstJob.order_number || firstJob.order_code,
                url: '/home',
              },
            }),
          });
          console.log('[check-new-jobs] Push notification sent');
        }
      } catch (pushErr) {
        console.error('[check-new-jobs] Push error:', pushErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_notifications: notifications.length,
        order_numbers: newJobs.map((j: any) => j.order_number || j.order_code),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[check-new-jobs] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
