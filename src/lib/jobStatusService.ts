import { supabase } from '@/integrations/supabase/client';

export type JobStatusType = 
  | 'empty_container_checked_in'
  | 'loaded_container_checked_in'
  | 'container_checked_in'
  | 'container_sop_completed'
  | 'loaded_container_confirmed'
  | 'pickup_checked_in'
  | 'pickup_sop_completed'
  | 'delivery_checked_in'
  | 'delivery_sop_completed'
  | 'delivery_confirmed'
  | 'container_return_checked_in'
  | 'container_return_confirmed';

const STATUS_LABELS: Record<JobStatusType, string> = {
  empty_container_checked_in: 'เช็คอินจุดรับตู้เปล่าสำเร็จ',
  loaded_container_checked_in: 'เช็คอินจุดรับตู้หนักสำเร็จ',
  container_checked_in: 'เช็คอินจุดรับตู้สำเร็จ',
  container_sop_completed: 'ยืนยันรับตู้เปล่าสำเร็จ',
  loaded_container_confirmed: 'ยืนยันรับตู้หนักสำเร็จ',
  pickup_checked_in: 'เช็คอินจุดรับสินค้าสำเร็จ',
  pickup_sop_completed: 'ดำเนินการจุดรับสินค้าสำเร็จ',
  delivery_checked_in: 'เช็คอินจุดส่งสินค้าสำเร็จ',
  delivery_sop_completed: 'ดำเนินการจุดส่งสินค้าสำเร็จ',
  delivery_confirmed: 'ยืนยันการจัดส่งสำเร็จ',
  container_return_checked_in: 'เช็คอินจุดคืนตู้สำเร็จ',
  container_return_confirmed: 'ยืนยันคืนตู้สำเร็จ',
};

const STATUS_NOTIFICATION_TITLES: Record<JobStatusType, { th: string; en: string }> = {
  empty_container_checked_in: { th: '📍 เช็คอินจุดรับตู้เปล่า', en: '📍 Empty Container Check-in' },
  loaded_container_checked_in: { th: '📍 เช็คอินจุดรับตู้หนัก', en: '📍 Loaded Container Check-in' },
  container_checked_in: { th: '📍 เช็คอินจุดรับตู้', en: '📍 Container Check-in' },
  container_sop_completed: { th: '✅ ยืนยันรับตู้เปล่าเสร็จ', en: '✅ Empty Container Confirmed' },
  loaded_container_confirmed: { th: '✅ ยืนยันรับตู้หนักเสร็จ', en: '✅ Loaded Container Confirmed' },
  pickup_checked_in: { th: '📍 เช็คอินจุดรับสินค้า', en: '📍 Pickup Check-in' },
  pickup_sop_completed: { th: '✅ ดำเนินการจุดรับสินค้าเสร็จ', en: '✅ Pickup SOP Completed' },
  delivery_checked_in: { th: '📍 เช็คอินจุดส่งสินค้า', en: '📍 Delivery Check-in' },
  delivery_sop_completed: { th: '✅ ดำเนินการจุดส่งสินค้าเสร็จ', en: '✅ Delivery SOP Completed' },
  delivery_confirmed: { th: '🎉 ยืนยันการจัดส่งสำเร็จ', en: '🎉 Delivery Confirmed' },
  container_return_checked_in: { th: '📍 เช็คอินจุดคืนตู้', en: '📍 Container Return Check-in' },
  container_return_confirmed: { th: '🎉 ยืนยันคืนตู้สำเร็จ', en: '🎉 Container Return Confirmed' },
};

interface SendJobStatusParams {
  jobId: string;
  orderCode: string;
  userId: string;
  status: JobStatusType;
  sequenceNumber?: number;
  destinationId?: string;
  containerNumber?: string;
  sealNumber?: string;
  containerNumber2?: string;
  sealNumber2?: string;
  // Optional driver info - if provided, skip Supabase lookup
  driverName?: string;
  driverPhone?: string;
}

export async function sendJobStatus({ 
  jobId, 
  orderCode, 
  userId, 
  status,
  sequenceNumber,
  destinationId,
  containerNumber,
  sealNumber,
  containerNumber2,
  sealNumber2,
  driverName,
  driverPhone
}: SendJobStatusParams): Promise<boolean> {
  try {
    let finalDriverName = driverName;
    let finalDriverPhone = driverPhone;

    // If driver info not provided, try to get from Supabase profiles
    if (!finalDriverName || !finalDriverPhone) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        finalDriverName = finalDriverName || profile.full_name;
        finalDriverPhone = finalDriverPhone || profile.phone_number;
      }
    }

    // If still no driver info, try to get from localStorage (for internal/external drivers)
    if (!finalDriverName || !finalDriverPhone) {
      try {
        const storedDriver = localStorage.getItem('auth_driver');
        if (storedDriver) {
          const driverData = JSON.parse(storedDriver);
          finalDriverName = finalDriverName || driverData.full_name || driverData.first_name + ' ' + driverData.last_name || '';
          finalDriverPhone = finalDriverPhone || driverData.phone || driverData.phone_number || '';
        }
      } catch (e) {
        console.error('Error parsing stored driver data:', e);
      }
    }

    if (!finalDriverName || !finalDriverPhone) {
      console.error('Could not get driver info from any source');
      return false;
    }

    const payload: any = {
      external_job_id: orderCode,
      status: STATUS_LABELS[status],
      driver_name: finalDriverName,
      driver_phone: finalDriverPhone,
    };

    // Add destination_id or sequence_number if provided
    if (destinationId) {
      payload.destination_id = destinationId;
    }
    if (sequenceNumber !== undefined) {
      payload.sequence_number = sequenceNumber;
    }
    // Add container info if provided (for inbound jobs)
    if (containerNumber) {
      payload.container_number = containerNumber;
    }
    if (sealNumber) {
      payload.seal_number = sealNumber;
    }
    if (containerNumber2) {
      payload.container_number_2 = containerNumber2;
    }
    if (sealNumber2) {
      payload.seal_number_2 = sealNumber2;
    }

    console.log('Sending job status update:', payload);

    const { data, error } = await supabase.functions.invoke('receive-job-status', {
      body: payload,
    });

    if (error) {
      console.error('Error sending job status:', error);
      return false;
    }

    console.log('Job status sent successfully:', data);

    // Create in-app notification and send push notification
    try {
      await createStatusNotification(userId, orderCode, status);
    } catch (notifError) {
      console.error('Failed to create status notification (non-blocking):', notifError);
    }

    return true;
  } catch (error) {
    console.error('Error in sendJobStatus:', error);
    return false;
  }
}

async function createStatusNotification(
  userId: string,
  orderCode: string,
  status: JobStatusType
): Promise<void> {
  const titles = STATUS_NOTIFICATION_TITLES[status];
  const descTh = `งาน ${orderCode}: ${STATUS_LABELS[status]}`;
  const descEn = `Job ${orderCode}: status updated`;

  // Use edge function (service role) to insert notification - bypasses RLS
  const { error } = await supabase.functions.invoke('get-notifications', {
    body: {
      action: 'create_status_notification',
      user_id: userId,
      title_th: titles.th,
      title_en: titles.en,
      description_th: descTh,
      description_en: descEn,
      notification_type: 'job_status',
      reference_type: 'job',
      order_code: orderCode,
      status,
    },
  });

  if (error) {
    console.error('Failed to create status notification:', error);
  }
}
