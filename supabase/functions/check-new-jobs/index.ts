import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const body = await req.json();
    const { driver_id, driver_type, user_id, action } = body;

    // Cleanup action
    if (action === 'cleanup_duplicates' || action === 'cleanup_all') {
      // Delete all notifications with null user_id (legacy broadcast)
      const { data: nullUserNotifs } = await supabase
        .from('notifications')
        .select('id')
        .is('user_id', null);

      let nullDeleted = 0;
      if (nullUserNotifs && nullUserNotifs.length > 0) {
        await supabase.from('notifications').delete().in('id', nullUserNotifs.map(n => n.id));
        nullDeleted = nullUserNotifs.length;
      }

      // Also cleanup duplicates
      const { data: allNotifs } = await supabase
        .from('notifications')
        .select('id, reference_id, notification_type, user_id, created_at')
        .in('notification_type', ['new_job', 'new_assigned_job'])
        .order('created_at', { ascending: true });

      const seen = new Set<string>();
      const toDelete: string[] = [];
      for (const n of (allNotifs || [])) {
        const key = `${n.user_id}_${n.reference_id}_${n.notification_type}`;
        if (seen.has(key)) {
          toDelete.push(n.id);
        } else {
          seen.add(key);
        }
      }

      if (toDelete.length > 0) {
        await supabase.from('notifications').delete().in('id', toDelete);
      }

      return new Response(
        JSON.stringify({ success: true, null_user_deleted: nullDeleted, duplicates_deleted: toDelete.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Deduplicate jobs by order_number before processing
    const seenOrderNumbers = new Set<string>();
    const uniqueJobs: any[] = [];
    for (const j of jobs) {
      const orderNum = j.order_number || j.order_code;
      if (orderNum && !seenOrderNumbers.has(orderNum)) {
        seenOrderNumbers.add(orderNum);
        uniqueJobs.push(j);
      }
    }
    jobs = uniqueJobs;

    console.log(`[check-new-jobs] Found ${jobs.length} unique jobs from external API`);

    // Filter out closed jobs and jobs with past pickup dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeJobs = jobs.filter((j: any) => {
      // Skip closed jobs
      if (j.status === 'closed') {
        console.log(`[check-new-jobs] Skipping closed job: ${j.order_number || j.order_code}`);
        return false;
      }

      // Skip jobs with past pickup dates
      const pickupDateStr = j.sender_pickup_date || j.pickup_date;
      if (pickupDateStr) {
        const pickupDate = new Date(pickupDateStr);
        pickupDate.setHours(0, 0, 0, 0);
        if (pickupDate < today) {
          console.log(`[check-new-jobs] Skipping job with past pickup date: ${j.order_number || j.order_code} (pickup: ${pickupDateStr})`);
          return false;
        }
      }

      return true;
    });

    console.log(`[check-new-jobs] After filtering: ${activeJobs.length} active jobs`);

    if (activeJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order numbers from active jobs
    const orderNumbers = activeJobs
      .map((j: any) => j.order_number || j.order_code)
      .filter(Boolean);

    if (orderNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which jobs already have notifications FOR THIS USER
    // Check both old 'new_assigned_job' and new 'new_job' types to avoid duplicates
    let existingQuery = supabase
      .from('notifications')
      .select('reference_id')
      .in('notification_type', ['new_job', 'new_assigned_job'])
      .in('reference_id', orderNumbers);

    // Filter by user_id so each driver gets their own notification
    if (user_id) {
      existingQuery = existingQuery.eq('user_id', user_id);
    } else {
      existingQuery = existingQuery.is('user_id', null);
    }

    const { data: existingNotifs } = await existingQuery;

    const existingOrderNumbers = new Set((existingNotifs || []).map(n => n.reference_id));

    // Filter only new jobs (use activeJobs, not jobs)
    const newJobs = activeJobs.filter((j: any) => {
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
      const transportCat = job.transport_category || '';
      const transportDir = job.transport_type || '';
      if (transportCat === 'international' || job.booking_no || job.bl_no) {
        if (job.bl_no) {
          jobLabel = 'งานขาเข้า (BL)';
        } else if (job.booking_no) {
          jobLabel = 'งานขาออก (Booking)';
        } else {
          jobLabel = 'งานระหว่างประเทศ';
        }
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

    // Insert all notifications at once, skip duplicates via DB unique index
    let insertedCount = 0;
    const { data: insertedData, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select('id');

    if (insertError) {
      // If unique constraint violation, try one by one to insert non-duplicates
      if (insertError.code === '23505') {
        console.log('[check-new-jobs] Bulk insert hit unique constraint, inserting one by one...');
        for (const notif of notifications) {
          const { error: singleErr } = await supabase
            .from('notifications')
            .insert(notif);
          if (singleErr) {
            if (singleErr.code === '23505') {
              console.log(`[check-new-jobs] Skipping duplicate for ${notif.reference_id}`);
            } else {
              console.error('[check-new-jobs] Error inserting notification:', singleErr);
            }
          } else {
            insertedCount++;
          }
        }
      } else {
        console.error('[check-new-jobs] Error inserting notifications:', insertError);
      }
    } else {
      insertedCount = insertedData?.length || notifications.length;
    }

    console.log(`[check-new-jobs] Created ${insertedCount} notifications (${notifications.length - insertedCount} skipped as duplicates)`);

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
