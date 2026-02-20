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
  latitude: number | null;
  longitude: number | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
}

interface JobOrigin {
  id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  notes: string | null;
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
  empty_pickup_address?: string | null;
  empty_pickup_phone?: string | null;
  empty_pickup_date?: string | null;
  empty_pickup_time?: string | null;
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
  origins?: JobOrigin[];
  // Container return info for international jobs
  container_return_location?: string | null;
  container_return_address?: string | null;
  container_return_latitude?: number | null;
  container_return_longitude?: number | null;
  container_return_phone?: string | null;
  container_return_date?: string | null;
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
    containerPickupCheckedIn,
    containerReturnCheckedIn,
    containerReturnConfirmed,
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
          container_checked_in_at: (containerPickupCheckedIn || containerReturnCheckedIn) ? (prev.container_checked_in_at || new Date().toISOString()) : null,
        };
      });
    }
  }, [pickupCheckedIn, deliveryCheckedIn, containerPickupCheckedIn, containerReturnCheckedIn, checkinLoading]);

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

      // Helper: map a transport API job to JobDetail and set state
      const mapAndSetTransportJob = (fj: any) => {
        console.log('[JobDetailPage] Mapping transport job:', fj.order_number || fj.order_code);
        const mappedJob: JobDetail = {
          id: fj.id,
          order_code: fj.order_number || fj.order_code || jobId!,
          job_type: (fj.booking_no || fj.bl_no) ? 'international' : (fj.job_type || fj.transport_category || 'domestic'),
          employer_name: fj.factory_name || fj.sender_name || fj.employer_name || '',
          transport_type: fj.transport_mode || fj.transport_type || 'เที่ยวเดียว',
          origin_location: fj.sender_district && fj.sender_province 
            ? `${fj.sender_district}, ${fj.sender_province}` 
            : (fj.sender_address || fj.origin_location || fj.origin_address || ''),
          origin_address: fj.sender_address || fj.origin_address || null,
          origin_company_name: fj.sender_name || fj.origin_company_name || null,
          origin_latitude: fj.sender_latitude || fj.origin_latitude || null,
          origin_longitude: fj.sender_longitude || fj.origin_longitude || null,
          origin_contact_phone: fj.sender_contact_phone || fj.origin_contact_phone || null,
          destination_location: fj.destination_district && fj.destination_province 
            ? `${fj.destination_district}, ${fj.destination_province}` 
            : (fj.destination_address || fj.destination_location || ''),
          destination_address: fj.destination_address || null,
          destination_company_name: fj.destination_company_name || fj.destination_name || null,
          destination_latitude: fj.destination_latitude || null,
          destination_longitude: fj.destination_longitude || null,
          destination_contact_phone: fj.destination_contact_phone || null,
          price: fj.transport_price ?? fj.price ?? 0,
          start_date: fj.sender_pickup_date || fj.start_date || '',
          start_time: fj.sender_pickup_time || fj.start_time || '',
          equipment_list: fj.vehicle_type || fj.equipment_list || null,
          safety_equipment: null,
          container_checkpoint: fj.container_checkpoint || fj.empty_pickup_depot || null,
          container_checkpoint_code: fj.container_checkpoint_code || null,
          empty_container_date: fj.empty_container_date || fj.empty_pickup_date || fj.first_pickup_date || fj.sender_pickup_date || null,
          empty_pickup_address: fj.empty_pickup_address || null,
          empty_pickup_phone: fj.empty_pickup_phone || null,
          empty_pickup_date: fj.empty_pickup_date || fj.sender_pickup_date || null,
          empty_pickup_time: fj.empty_pickup_time || fj.sender_pickup_time || null,
          container_number: fj.container_number || null,
          container_number_2: fj.container_number_2 || null,
          seal_number: fj.seal_number || null,
          seal_number_2: fj.seal_number_2 || null,
          origin_contact_person: fj.sender_contact_name,
          origin_contact_role: null,
          origin_bill_of_lading: fj.bill_of_lading || null,
          origin_goods_type: fj.product_name,
          origin_goods_quantity: fj.product_quantity ? String(fj.product_quantity) : null,
          origin_remarks: fj.remarks,
          destination_contact_person: fj.destination_contact_name,
          destination_bill_of_lading: null,
          destination_goods_type: fj.product_name,
          destination_goods_quantity: fj.product_quantity ? String(fj.product_quantity) : null,
          destination_time: fj.destination_delivery_time,
          destination_date: fj.destination_delivery_date,
          destination_remarks: fj.remarks,
          tax_id: null,
          container_checkpoint_time: fj.container_checkpoint_time || fj.eta_date || fj.eta_time || fj.vessel_eta || fj.vessel_arrival_date || null,
          booking_number: fj.booking_number || null,
          booking_no: fj.booking_no || null,
          bl_no: fj.bl_no || null,
          container_return_location: fj.container_return_location || fj.container_return?.location || fj.return_depot || fj.return_location || fj.return_full_container_location || fj.full_container_return?.location || null,
          container_return_address: fj.container_return_address || fj.container_return?.address || fj.return_address || fj.return_full_container_address || fj.full_container_return?.address || null,
          container_return_latitude: fj.container_return_latitude || fj.container_return?.latitude || fj.return_latitude || fj.full_container_return?.latitude || null,
          container_return_longitude: fj.container_return_longitude || fj.container_return?.longitude || fj.return_longitude || fj.full_container_return?.longitude || null,
          container_return_phone: fj.container_return_phone || fj.container_return?.phone || fj.return_phone || fj.return_contact_phone || fj.full_container_return?.phone || null,
          container_return_date: fj.container_return_date || fj.container_return_datetime || fj.container_return?.date || fj.container_return?.datetime || fj.return_date || fj.return_full_container_date || fj.full_container_return?.date || null,
          destinations: Array.isArray(fj.destinations) && fj.destinations.length > 0
            ? fj.destinations.map((d: any) => ({
                id: d.id || `dest-${d.sequence_number}`,
                sequence_number: d.sequence_number || 1,
                company_name: d.company_name || null,
                contact_name: d.contact_name || null,
                contact_phone: d.contact_phone || null,
                address: d.address || null,
                province: d.province || null,
                district: d.district || null,
                latitude: d.latitude || null,
                longitude: d.longitude || null,
                delivery_date: d.delivery_date || null,
                delivery_time: d.delivery_time || null,
                notes: d.notes || null,
                checked_in_at: null,
                sop_completed_at: null,
              }))
            : undefined,
          origins: Array.isArray(fj.origins) && fj.origins.length > 0
            ? fj.origins.map((o: any) => ({
                id: o.id || `origin-${o.sequence_number}`,
                sequence_number: o.sequence_number || 1,
                company_name: o.company_name || null,
                contact_name: o.contact_name || null,
                contact_phone: o.contact_phone || null,
                address: o.address || null,
                province: o.province || null,
                district: o.district || null,
                pickup_date: o.pickup_date || null,
                pickup_time: o.pickup_time || null,
                goods_type: o.goods_type || o.product_name || null,
                goods_quantity: o.goods_quantity || o.product_quantity ? String(o.goods_quantity || o.product_quantity) : null,
                notes: o.notes || null,
              }))
            : undefined,
        };
        setJob(mappedJob);
        const jobApp: JobApplication = {
          checked_in_at: null,
          sop_completed_at: null,
          job_started_at: fj.status === 'in_progress' ? new Date().toISOString() : null,
          delivery_checked_in_at: fj.status === 'delivered' || fj.status === 'completed' ? new Date().toISOString() : null,
          delivery_sop_completed_at: fj.status === 'completed' ? new Date().toISOString() : null,
          container_checked_in_at: null,
          container_sop_completed_at: null,
          status: fj.status,
        };
        setJobApplication(jobApp);
      };

      // Helper: try local DB redirect
      const tryLocalDbRedirect = async () => {
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
      };

      if (result.success && result.data) {
        const stateJob = (location.state as any)?.job || (location.state as any)?.jobData;
        const apiData = Array.isArray(result.data) ? result.data : [];

        console.log('[JobDetailPage] Looking for jobId:', jobId, 'in', apiData.length, 'API jobs, stateJob:', !!stateJob, stateJob?.order_number);

        // Only match by ID in API data — do NOT use stateJob as primary source
        const foundJob = apiData.find((j: any) => j.order_number === jobId || j.order_code === jobId);

        if (foundJob) {
          // Found in transport API — use regular mapping (unchanged flow for all job types)
          mapAndSetTransportJob(foundJob);
        } else {
          // Not found in transport jobs — try Bid Jobs FIRST (list-tickets API)
          console.log('Job not found in transport jobs, trying bid jobs for:', jobId);
          const bidJobFound = await loadBidJobDetail();
          
          if (!bidJobFound) {
            // Bid job not found — try stateJob as final fallback
            if (stateJob) {
              console.log('[JobDetailPage] Using stateJob fallback for:', jobId);
              mapAndSetTransportJob(stateJob);
            } else {
              await tryLocalDbRedirect();
            }
          }
        }
      } else {
        // External API did not return data. Try bid jobs first, then local DB.
        console.log('Transport API returned no data, trying bid jobs');
        const bidJobFound = await loadBidJobDetail();
        
        if (!bidJobFound) {
          await tryLocalDbRedirect();
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

          console.log('Found bid job:', JSON.stringify(foundTicket, null, 2));

          // Map ticket to JobDetail — use ALL fields from bid API
          const customer = foundTicket.customer || {};
          const creator = foundTicket.creator || {};
          const route = foundTicket.route || {};
          const originDistrict = route.origin_district || {};
          const destDistrict = route.destination_district || {};
          // Get employer: prefer customer, fallback to creator
          const employerName = customer.company_name || customer.full_name || creator.company_name || creator.full_name || '';
          const employerPhone = customer.phone || creator.phone || null;
          const contactPerson = customer.full_name || creator.full_name || null;
          // Destination location from route
          const originLoc = originDistrict.name && originDistrict.province?.name
            ? `${originDistrict.name}, ${originDistrict.province.name}` : '';
          const destLoc = destDistrict.name && destDistrict.province?.name
            ? `${destDistrict.name}, ${destDistrict.province.name}` : '';

          const mappedJob: JobDetail = {
            id: foundTicket.id,
            order_code: foundTicket.ticket_number,
            job_type: 'domestic',
            employer_name: employerName,
            transport_type: 'เที่ยวเดียว',
            origin_location: originLoc,
            origin_address: null,
            origin_company_name: customer.company_name || creator.company_name || employerName || '',
            origin_latitude: route.origin_latitude || null,
            origin_longitude: route.origin_longitude || null,
            origin_contact_phone: employerPhone,
            destination_location: destLoc,
            destination_address: null,
            destination_company_name: null,
            destination_latitude: route.destination_latitude || null,
            destination_longitude: route.destination_longitude || null,
            destination_contact_phone: null,
            price: userAcceptedBid.bid_price || foundTicket.market_price || foundTicket.price || 0,
            start_date: foundTicket.pickup_datetime ? foundTicket.pickup_datetime.split('T')[0] : foundTicket.created_at?.split('T')[0] || '',
            start_time: foundTicket.pickup_datetime ? foundTicket.pickup_datetime.split('T')[1]?.substring(0, 5) || '00:00' : '00:00',
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
            origin_contact_person: contactPerson,
            origin_contact_role: null,
            origin_bill_of_lading: null,
            origin_goods_type: foundTicket.product || null,
            origin_goods_quantity: foundTicket.weight_tons ? `${foundTicket.weight_tons} ตัน` : null,
            origin_remarks: foundTicket.notes || null,
            destination_contact_person: null,
            destination_bill_of_lading: null,
            destination_goods_type: foundTicket.product || null,
            destination_goods_quantity: foundTicket.weight_tons ? `${foundTicket.weight_tons} ตัน` : null,
            destination_time: foundTicket.delivery_datetime ? foundTicket.delivery_datetime.split('T')[1]?.substring(0, 5) || null : null,
            destination_date: foundTicket.delivery_datetime ? foundTicket.delivery_datetime.split('T')[0] : null,
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
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก') || job.job_type === 'international';

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
