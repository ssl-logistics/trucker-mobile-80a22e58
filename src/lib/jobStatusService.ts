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
  sequenceNumber?: number;
  destinationId?: string;
  containerNumber?: string;
  sealNumber?: string;
  containerNumber2?: string;
  sealNumber2?: string;
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
  sealNumber2
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

    const payload: any = {
      external_job_id: orderCode,
      status: STATUS_LABELS[status],
      driver_name: profile.full_name,
      driver_phone: profile.phone_number,
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
    return true;
  } catch (error) {
    console.error('Error in sendJobStatus:', error);
    return false;
  }
}
