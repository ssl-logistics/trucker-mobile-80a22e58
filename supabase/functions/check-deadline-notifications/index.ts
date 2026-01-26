import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Time threshold in minutes before deadline to send notification
const NOTIFICATION_THRESHOLD_MINUTES = 60; // 1 hour before deadline

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const thresholdTime = new Date(now.getTime() + NOTIFICATION_THRESHOLD_MINUTES * 60 * 1000);
    
    console.log(`[DeadlineCheck] Running at ${now.toISOString()}, threshold: ${thresholdTime.toISOString()}`);

    // Get all active job applications with job details
    const { data: applications, error: appError } = await supabase
      .from('job_applications')
      .select(`
        id,
        job_id,
        driver_id,
        status,
        checked_in_at,
        delivery_checked_in_at,
        jobs (
          id,
          order_code,
          origin_location,
          destination_location,
          start_date,
          start_time,
          destination_date,
          destination_time
        )
      `)
      .in('status', ['accepted', 'in_progress', 'waiting_container', 'picked_up', 'en_route']);

    if (appError) {
      console.error('[DeadlineCheck] Error fetching applications:', appError);
      throw appError;
    }

    console.log(`[DeadlineCheck] Found ${applications?.length || 0} active applications`);

    const notificationsSent: string[] = [];

    for (const app of applications || []) {
      const job = app.jobs as any;
      if (!job) continue;

      // Check pickup deadline
      if (!app.checked_in_at && job.start_date && job.start_time) {
        const pickupDeadline = parseDateTime(job.start_date, job.start_time);
        
        if (pickupDeadline && isApproachingDeadline(now, pickupDeadline, thresholdTime)) {
          console.log(`[DeadlineCheck] Pickup deadline approaching for job ${job.order_code}, driver ${app.driver_id}`);
          
          await sendDeadlineNotification(
            supabase,
            app.driver_id,
            job.order_code,
            job.id,
            'pickup',
            job.origin_location,
            pickupDeadline
          );
          
          notificationsSent.push(`pickup:${job.order_code}`);
        }
      }

      // Check delivery deadline
      if (!app.delivery_checked_in_at && job.destination_date && job.destination_time) {
        const deliveryDeadline = parseDateTime(job.destination_date, job.destination_time);
        
        if (deliveryDeadline && isApproachingDeadline(now, deliveryDeadline, thresholdTime)) {
          console.log(`[DeadlineCheck] Delivery deadline approaching for job ${job.order_code}, driver ${app.driver_id}`);
          
          await sendDeadlineNotification(
            supabase,
            app.driver_id,
            job.order_code,
            job.id,
            'delivery',
            job.destination_location,
            deliveryDeadline
          );
          
          notificationsSent.push(`delivery:${job.order_code}`);
        }
      }
    }

    console.log(`[DeadlineCheck] Sent ${notificationsSent.length} notifications:`, notificationsSent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: notificationsSent.length,
        details: notificationsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DeadlineCheck] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    // Format: "2024-01-15" and "09:00:00" or "09:00"
    const dateTime = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(dateTime.getTime())) return null;
    return dateTime;
  } catch {
    return null;
  }
}

function isApproachingDeadline(now: Date, deadline: Date, threshold: Date): boolean {
  // Deadline is between now and threshold (within the next hour)
  // Also check if deadline has just passed (within last 30 minutes) to catch overdue
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  return deadline >= thirtyMinutesAgo && deadline <= threshold;
}

async function sendDeadlineNotification(
  supabase: any,
  driverId: string,
  orderCode: string,
  jobId: string,
  type: 'pickup' | 'delivery',
  location: string,
  deadline: Date
) {
  const timeStr = deadline.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const dateStr = deadline.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

  const titleTh = type === 'pickup' 
    ? `⚠️ ใกล้ถึงเวลารับสินค้า`
    : `⚠️ ใกล้ถึงเวลาส่งสินค้า`;
  
  const titleEn = type === 'pickup'
    ? `⚠️ Pickup deadline approaching`
    : `⚠️ Delivery deadline approaching`;

  const descriptionTh = type === 'pickup'
    ? `งาน ${orderCode} กำหนดรับสินค้าเวลา ${timeStr} น. (${dateStr}) ที่ ${location} คุณยังไม่ได้เช็คอิน`
    : `งาน ${orderCode} กำหนดส่งสินค้าเวลา ${timeStr} น. (${dateStr}) ที่ ${location} คุณยังไม่ได้เช็คอิน`;

  const descriptionEn = type === 'pickup'
    ? `Job ${orderCode} pickup at ${timeStr} (${dateStr}) at ${location}. You haven't checked in yet.`
    : `Job ${orderCode} delivery at ${timeStr} (${dateStr}) at ${location}. You haven't checked in yet.`;

  // Create notification in database
  const { error: notifError } = await supabase
    .from('notifications')
    .insert({
      user_id: driverId,
      title_th: titleTh,
      title_en: titleEn,
      description_th: descriptionTh,
      description_en: descriptionEn,
      notification_type: 'deadline_reminder',
      reference_id: jobId,
      reference_type: 'job',
      is_read: false
    });

  if (notifError) {
    console.error('[DeadlineCheck] Error creating notification:', notifError);
  }

  // Send push notification
  try {
    const pushUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`;
    const response = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId: driverId,
        title: titleTh,
        body: descriptionTh,
        data: {
          type: 'deadline_reminder',
          jobId: jobId,
          orderCode: orderCode,
          checkpointType: type
        },
        url: `/job/${jobId}`
      })
    });

    if (!response.ok) {
      console.error('[DeadlineCheck] Push notification failed:', await response.text());
    } else {
      console.log('[DeadlineCheck] Push notification sent successfully');
    }
  } catch (pushError) {
    console.error('[DeadlineCheck] Error sending push:', pushError);
  }
}
