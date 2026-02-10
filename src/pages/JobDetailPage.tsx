import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDriverAssignedJobs } from '@/lib/externalApi';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { toast } from '@/hooks/use-toast';
import DomesticJobDetail from '@/components/job-detail/DomesticJobDetail';
import InternationalJobDetail from '@/components/job-detail/InternationalJobDetail';

// Interface matching what the detail components expect
interface JobDestination {
  id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
}

interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  origin_address: string | null;
  origin_company_name: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  origin_contact_phone: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_contact_phone: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  container_checkpoint_time: string | null;
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
  booking_number?: string | null;
  booking_no?: string | null;
  bl_no?: string | null;
  destinations?: JobDestination[];
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
  const navigate = useNavigate();
  const { user, userType } = useAuth();
  const { t } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);

  // Use checkin status hook to get real-time status from API
  const { 
    pickupCheckedIn, 
    deliveryCheckedIn, 
    containerCheckedIn, 
    emptyContainerCheckedIn,
    loading: checkinLoading,
    refetch: refetchCheckinStatus 
  } = useCheckinStatus(jobId, user?.id);

  useEffect(() => {
    if (user && jobId) {
      loadJobDetail();
    }
  }, [jobId, user, location.key, userType]);

  // Update jobApplication when checkin status changes from API
  useEffect(() => {
    if (!checkinLoading && jobApplication) {
      setJobApplication(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          checked_in_at: pickupCheckedIn ? (prev.checked_in_at || new Date().toISOString()) : null,
          delivery_checked_in_at: deliveryCheckedIn ? (prev.delivery_checked_in_at || new Date().toISOString()) : null,
          container_checked_in_at: (containerCheckedIn || emptyContainerCheckedIn) ? (prev.container_checked_in_at || new Date().toISOString()) : null,
        };
      });
    }
  }, [pickupCheckedIn, deliveryCheckedIn, containerCheckedIn, emptyContainerCheckedIn, checkinLoading]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);

    try {
      let response: Response;
      
      // Use different API based on driver type
      if (isInternalDriver || isExternalDriver) {
        // Internal/External drivers use get-driver-assigned-jobs API
        const driverType = isInternalDriver ? 'internal' : 'external';
        // Fetch jobs with multiple statuses to find jobs at any stage
        // Always include 'completed' so data persists after POD submission
        const fetches = [
          getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
          getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
          getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
          getDriverAssignedJobs(user.id, driverType, 50, 'completed'),
        ];
        const results = await Promise.all(fetches);
        
        // Combine the data from all statuses
        const combinedData = results.flatMap(r => (r.data as any)?.data || []);
        
        console.log('[JobDetailPage] Combined data count:', combinedData.length, 'Looking for:', jobId);
        
        // Create a merged response object
        const mergedResult = {
          success: true,
          data: combinedData,
          pagination: {
            limit: 100,
            offset: 0,
            total: combinedData.length,
          }
        };
        
        // Convert mergedResult to Response-like object
        const mockResponse = {
          ok: true,
          json: async () => mergedResult,
        } as Response;
        response = mockResponse;
      } else {
        // Freelance drivers use get-freelance-accepted-jobs API
        response = await fetch(
          `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
            },
          }
        );
      }

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      console.log('Job API response:', result, 'userType:', userType);

      if (result.success && result.data) {
        // Find the specific job by order_number (fallback: use navigation state if API list no longer includes it)
        const stateJob = (location.state as any)?.job || (location.state as any)?.jobData;
        const apiData = Array.isArray(result.data) ? result.data : [];

        console.log('[JobDetailPage] Looking for jobId:', jobId, 'in', apiData.length, 'API jobs, stateJob:', !!stateJob, stateJob?.order_number);

        const foundJob =
          apiData.find((j: any) => j.order_number === jobId || j.order_code === jobId) ??
          (stateJob && (stateJob.order_number === jobId || stateJob.order_code === jobId) ? stateJob : null) ??
          (stateJob ? stateJob : null); // Final fallback: use stateJob regardless of ID match (user navigated here intentionally)

        if (foundJob) {
          // Map API response to JobDetail interface
          // Handle different field names from different APIs
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number || foundJob.order_code || jobId!,
            job_type: (foundJob.booking_no || foundJob.bl_no) ? 'international' : (foundJob.job_type || foundJob.transport_category || 'domestic'),
            employer_name: foundJob.factory_name || foundJob.sender_name || foundJob.employer_name || '',
            transport_type: foundJob.transport_mode || foundJob.transport_type || 'เที่ยวเดียว',
            origin_location: foundJob.sender_district && foundJob.sender_province 
              ? `${foundJob.sender_district}, ${foundJob.sender_province}` 
              : (foundJob.sender_address || foundJob.origin_location || foundJob.origin_address || ''),
            origin_address: foundJob.sender_address || foundJob.origin_address || null,
            origin_company_name: foundJob.sender_name || foundJob.origin_company_name || null,
            origin_latitude: foundJob.sender_latitude || foundJob.origin_latitude || null,
            origin_longitude: foundJob.sender_longitude || foundJob.origin_longitude || null,
            origin_contact_phone: foundJob.sender_contact_phone || foundJob.origin_contact_phone || null,
            destination_location: foundJob.destination_district && foundJob.destination_province 
              ? `${foundJob.destination_district}, ${foundJob.destination_province}` 
              : (foundJob.destination_address || foundJob.destination_location || ''),
            destination_address: foundJob.destination_address || null,
            destination_company_name: foundJob.destination_company_name || foundJob.destination_name || null,
            destination_latitude: foundJob.destination_latitude || null,
            destination_longitude: foundJob.destination_longitude || null,
            destination_contact_phone: foundJob.destination_contact_phone || null,
            price: foundJob.transport_price ?? foundJob.price ?? 0,
            start_date: foundJob.sender_pickup_date || foundJob.start_date || '',
            start_time: foundJob.sender_pickup_time || foundJob.start_time || '',
            equipment_list: foundJob.vehicle_type || foundJob.equipment_list || null,
            safety_equipment: null,
            container_checkpoint: foundJob.container_checkpoint || null,
            container_checkpoint_code: foundJob.container_checkpoint_code || null,
            empty_container_date: foundJob.empty_container_date || null,
            container_number: foundJob.container_number || null,
            container_number_2: foundJob.container_number_2 || null,
            seal_number: foundJob.seal_number || null,
            seal_number_2: foundJob.seal_number_2 || null,
            origin_contact_person: foundJob.sender_contact_name,
            origin_contact_role: null,
            origin_bill_of_lading: foundJob.bill_of_lading || null,
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
            container_checkpoint_time: foundJob.container_checkpoint_time || foundJob.eta_date || null,
            booking_number: foundJob.booking_number || null,
            booking_no: foundJob.booking_no || null,
            bl_no: foundJob.bl_no || null,
            // Map destinations array from API
            destinations: Array.isArray(foundJob.destinations) && foundJob.destinations.length > 0
              ? foundJob.destinations.map((d: any) => ({
                  id: d.id || `dest-${d.sequence_number}`,
                  sequence_number: d.sequence_number || 1,
                  company_name: d.company_name || null,
                  contact_name: d.contact_name || null,
                  contact_phone: d.contact_phone || null,
                  address: d.address || null,
                  province: d.province || null,
                  district: d.district || null,
                  delivery_date: d.delivery_date || null,
                  delivery_time: d.delivery_time || null,
                  notes: d.notes || null,
                  checked_in_at: null,
                  sop_completed_at: null,
                }))
              : undefined,
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
          // Not found in transport jobs, try Bid Jobs (list-tickets API)
          console.log('Job not found in transport jobs, trying bid jobs for:', jobId);
          const bidJobFound = await loadBidJobDetail();
          
          if (!bidJobFound) {
            // Not in accepted jobs list. Try local DB and redirect.
            try {
              const { data: localJob, error: localJobError } = await supabase
                .from('jobs')
                .select('id, order_code, status')
                .or(`id.eq.${jobId},order_code.eq.${jobId}`)
                .maybeSingle();

              if (!localJobError && localJob?.order_code) {
                if (localJob.status === 'open_for_bidding') {
                  navigate(`/bidding/${localJob.id}`, { replace: true });
                  return;
                }

                navigate('/home', { state: { openJobOrderCode: localJob.order_code }, replace: true });
                return;
              }
            } catch (e) {
              console.error('Local job redirect failed:', e);
            }

            toast({
              title: t('jobDetail.error'),
              description: t('jobDetail.notFound'),
              variant: 'destructive',
            });
          }
        }
      } else {
        // External API did not return data. Try bid jobs first, then local DB.
        console.log('Transport API returned no data, trying bid jobs');
        const bidJobFound = await loadBidJobDetail();
        
        if (!bidJobFound) {
          try {
            const { data: localJob, error: localJobError } = await supabase
              .from('jobs')
              .select('id, order_code, status')
              .or(`id.eq.${jobId},order_code.eq.${jobId}`)
              .maybeSingle();

            if (!localJobError && localJob?.order_code) {
              if (localJob.status === 'open_for_bidding') {
                navigate(`/bidding/${localJob.id}`, { replace: true });
                return;
              }

              navigate('/home', { state: { openJobOrderCode: localJob.order_code }, replace: true });
              return;
            }
          } catch (e) {
            console.error('Local job redirect failed:', e);
          }

          toast({
            title: t('jobDetail.error'),
            description: t('jobDetail.notFound'),
            variant: 'destructive',
          });
        }
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

  // Load bid job details from list-tickets API
  const loadBidJobDetail = async (): Promise<boolean> => {
    if (!user || !jobId) return false;

    try {
      const bidResponse = await supabase.functions.invoke('list-tickets', {
        body: {
          freelance_driver_id: user.id,
          bids_status: 'accepted',
        },
      });

      if (bidResponse.data) {
        const tickets = bidResponse.data.data || bidResponse.data.tickets || [];
        
        // Find ticket by ticket_number
        const foundTicket = tickets.find((ticket: any) => {
          const ticketNumber = ticket.ticket_number || ticket.order_code || ticket.post_code;
          return ticketNumber === jobId;
        });

        if (foundTicket) {
          // Check if current user has an accepted bid
          const userAcceptedBid = foundTicket.bids?.find((b: any) => 
            b.status === 'accepted' && b.contractor_id === user.id
          );

          if (!userAcceptedBid) {
            console.log('User does not have an accepted bid on this ticket');
            return false;
          }

          console.log('Found bid job:', foundTicket);

          // Map ticket to JobDetail
          const customer = foundTicket.customer || {};
          const creator = foundTicket.creator || {};
          const route = foundTicket.route || {};
          const originDistrict = route.origin_district || {};
          const destDistrict = route.destination_district || {};

          const mappedJob: JobDetail = {
            id: foundTicket.id,
            order_code: foundTicket.ticket_number,
            job_type: 'domestic',
            employer_name: customer.company_name || customer.full_name || creator.company_name || creator.full_name || '',
            transport_type: 'เที่ยวเดียว',
            origin_location: originDistrict.name && originDistrict.province?.name
              ? `${originDistrict.name}, ${originDistrict.province.name}`
              : '',
            origin_address: null,
            origin_company_name: customer.company_name || customer.full_name || '',
            origin_latitude: route.origin_latitude || null,
            origin_longitude: route.origin_longitude || null,
            origin_contact_phone: customer.phone || null,
            destination_location: destDistrict.name && destDistrict.province?.name
              ? `${destDistrict.name}, ${destDistrict.province.name}`
              : '',
            destination_address: null,
            destination_company_name: null,
            destination_latitude: route.destination_latitude || null,
            destination_longitude: route.destination_longitude || null,
            destination_contact_phone: null,
            price: userAcceptedBid.bid_price || foundTicket.price || 0,
            start_date: foundTicket.pickup_date || foundTicket.created_at?.split('T')[0] || '',
            start_time: '08:00:00',
            equipment_list: foundTicket.vehicle_type?.name || null,
            safety_equipment: null,
            container_checkpoint: null,
            container_checkpoint_code: null,
            container_checkpoint_time: null,
            empty_container_date: null,
            container_number: null,
            container_number_2: null,
            seal_number: null,
            seal_number_2: null,
            origin_contact_person: customer.full_name || null,
            origin_contact_role: null,
            origin_bill_of_lading: null,
            origin_goods_type: foundTicket.product || null,
            origin_goods_quantity: foundTicket.weight_tons ? `${foundTicket.weight_tons} ตัน` : null,
            origin_remarks: foundTicket.notes || null,
            destination_contact_person: null,
            destination_bill_of_lading: null,
            destination_goods_type: foundTicket.product || null,
            destination_goods_quantity: foundTicket.weight_tons ? `${foundTicket.weight_tons} ตัน` : null,
            destination_time: null,
            destination_date: null,
            destination_remarks: foundTicket.notes || null,
            tax_id: null,
          };

          setJob(mappedJob);

          // Create job application based on ticket status
          const ticketStatus = (foundTicket.status || '').toLowerCase();
          const jobApplicationData: JobApplication = {
            checked_in_at: null,
            sop_completed_at: null,
            job_started_at: ['in_progress', 'in_transit', 'completed', 'delivered'].includes(ticketStatus) ? new Date().toISOString() : null,
            delivery_checked_in_at: ['delivered', 'completed'].includes(ticketStatus) ? new Date().toISOString() : null,
            delivery_sop_completed_at: ticketStatus === 'completed' ? new Date().toISOString() : null,
            container_checked_in_at: null,
            container_sop_completed_at: null,
            status: foundTicket.status,
          };

          setJobApplication(jobApplicationData);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error loading bid job detail:', error);
      return false;
    }
  };

  if (loading) {
    // Don't render a full-page loader - the Suspense boundary already handles initial loading
    // Only show inline skeleton or nothing to prevent duplicate loaders
    return null;
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

  const handleUpdate = () => {
    loadJobDetail();
    refetchCheckinStatus();
  };

  return isDomestic ? (
    <DomesticJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={handleUpdate}
    />
  ) : isInternational ? (
    <InternationalJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={handleUpdate}
    />
  ) : (
    // Default to DomesticJobDetail if transport type is unknown
    <DomesticJobDetail 
      job={job} 
      jobApplication={jobApplication} 
      userId={user.id}
      onUpdate={handleUpdate}
    />
  );
}
