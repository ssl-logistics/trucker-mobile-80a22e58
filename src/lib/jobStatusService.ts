import { supabase } from '@/integrations/supabase/client';

export type JobStatusType = 
  | 'container_checked_in'
  | 'container_sop_completed'
  | 'pickup_checked_in'
  | 'pickup_sop_completed'
  | 'delivery_checked_in'
  | 'delivery_sop_completed';

const STATUS_LABELS: Record<JobStatusType, string> = {
  container_checked_in: 'เช็คอินจุดรับตู้เปล่าสำเร็จ',
  container_sop_completed: 'ดำเนินการจุดรับตู้เปล่าสำเร็จ',
  pickup_checked_in: 'เช็คอินจุดรับสินค้าสำเร็จ',
  pickup_sop_completed: 'ดำเนินการจุดรับสินค้าสำเร็จ',
  delivery_checked_in: 'เช็คอินจุดส่งสินค้าสำเร็จ',
  delivery_sop_completed: 'ดำเนินการจุดส่งสินค้าสำเร็จ',
};

interface SendJobStatusParams {
  jobId: string;
  orderCode: string;
  userId: string;
  status: JobStatusType;
}

export async function sendJobStatus({ 
  jobId, 
  orderCode, 
  userId, 
  status 
}: SendJobStatusParams): Promise<boolean> {
  try {
    // Get driver profile info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching driver profile:', profileError);
      return false;
    }

    const payload = {
      external_job_id: orderCode,
      status: STATUS_LABELS[status],
      driver_name: profile.full_name,
      driver_phone: profile.phone_number,
    };

    console.log('Sending job status update:', payload);

    const { data, error } = await supabase.functions.invoke('receive-job-status', {
      body: payload,
    });

    if (error) {
      console.error('Error sending job status:', error);
      return false;
    }

    console.log('Job status sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error in sendJobStatus:', error);
    return false;
  }
}
