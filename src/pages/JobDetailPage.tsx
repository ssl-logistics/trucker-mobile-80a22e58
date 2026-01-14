import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import DomesticJobDetail from '@/components/job-detail/DomesticJobDetail';
import InternationalJobDetail from '@/components/job-detail/InternationalJobDetail';

// Interface matching what the detail components expect
interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  origin_address: string | null;
  origin_company_name: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  empty_container_date: string | null;
  container_number: string | null;
  container_number_2: string | null;
  seal_number: string | null;
  seal_number_2: string | null;
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_bill_of_lading: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_contact_person: string | null;
  destination_bill_of_lading: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_time: string | null;
  destination_date: string | null;
  destination_remarks: string | null;
  tax_id: string | null;
}

interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  container_checked_in_at: string | null;
  container_sop_completed_at: string | null;
  status: string;
}

// Interface for API response
interface AcceptedJobAPI {
  id: string;
  order_number: string;
  transport_type_id: string;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_latitude: number;
  sender_longitude: number;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_contact_name: string;
  sender_contact_phone: string;
  destination_name: string;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_province: string;
  destination_district: string;
  destination_delivery_date: string;
  destination_delivery_time: string;
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_company_name: string | null;
  product_name: string | null;
  product_type: string | null;
  product_category: string | null;
  product_weight: number | null;
  product_weight_value: number | null;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string | null;
  vehicle_category: string | null;
  transport_price: number;
  driver_name: string;
  driver_phone: string;
  license_plate: string;
  freelance_bidder_id: string;
  freelance_bidder_name: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && jobId) {
      loadJobDetail();
    }
  }, [jobId, user, location.key]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);

    try {
      // Fetch only from external API - no local database
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      console.log('External API response:', result);

      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: AcceptedJobAPI) => j.order_number === jobId);

        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            job_type: 'domestic',
            employer_name: foundJob.sender_name,
            transport_type: 'เที่ยวเดียว',
            origin_location: `${foundJob.sender_district}, ${foundJob.sender_province}`,
            origin_address: foundJob.sender_address,
            origin_company_name: foundJob.sender_name,
            destination_location: `${foundJob.destination_district}, ${foundJob.destination_province}`,
            destination_address: foundJob.destination_address,
            destination_company_name: foundJob.destination_company_name,
            price: foundJob.transport_price,
            start_date: foundJob.sender_pickup_date,
            start_time: foundJob.sender_pickup_time,
            equipment_list: null,
            safety_equipment: null,
            container_checkpoint: null,
            container_checkpoint_code: null,
            empty_container_date: null,
            container_number: null,
            container_number_2: null,
            seal_number: null,
            seal_number_2: null,
            origin_contact_person: foundJob.sender_contact_name,
            origin_contact_role: foundJob.sender_contact_phone,
            origin_bill_of_lading: null,
            origin_goods_type: foundJob.product_name,
            origin_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            origin_remarks: foundJob.remarks,
            destination_contact_person: foundJob.destination_contact_name,
            destination_bill_of_lading: null,
            destination_goods_type: foundJob.product_name,
            destination_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            destination_time: foundJob.destination_delivery_time,
            destination_date: foundJob.destination_delivery_date,
            destination_remarks: foundJob.remarks,
            tax_id: null,
          };

          setJob(mappedJob);

          // Create job application based on status from API
          // Note: 'delivered' status means arrived at destination but NOT POD completed
          // Only 'completed' status means POD is done
          const jobApplicationData: JobApplication = {
            checked_in_at: null,
            sop_completed_at: null,
            job_started_at: foundJob.status === 'in_progress' ? new Date().toISOString() : null,
            delivery_checked_in_at: foundJob.status === 'delivered' || foundJob.status === 'completed' ? new Date().toISOString() : null,
            delivery_sop_completed_at: foundJob.status === 'completed' ? new Date().toISOString() : null,
            container_checked_in_at: null,
            container_sop_completed_at: null,
            status: foundJob.status,
          };

          setJobApplication(jobApplicationData);
        } else {
          toast({
            title: t('jobDetail.error'),
            description: t('jobDetail.notFound'),
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: t('jobDetail.error'),
          description: t('jobDetail.notFound'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('jobDetail.error'),
        description: t('jobDetail.errorLoadDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-muted-foreground">{t('jobDetail.notFound')}</p>
        </div>
      </div>
    );
  }

  // Determine if domestic or international
  const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');

  return isDomestic ? (
    <DomesticJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={loadJobDetail}
    />
  ) : isInternational ? (
    <InternationalJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={loadJobDetail}
    />
  ) : (
    // Default to DomesticJobDetail if transport type is unknown
    <DomesticJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={loadJobDetail}
    />
  );
}
