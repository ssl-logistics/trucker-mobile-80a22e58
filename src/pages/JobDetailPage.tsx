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
import AccidentEvidenceModal from '@/components/job/AccidentEvidenceModal';


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
  location_name?: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
  goods_type: string | null;
  invoice_number?: string | null;
  products?: any[];
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
  origin_contact_name?: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_contact_phone: string | null;
  destination_contact_name?: string | null;
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
  products?: any[];
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
  const [accidentEvidenceRequired, setAccidentEvidenceRequired] = useState(false);
  const [accidentOrderInfo, setAccidentOrderInfo] = useState<{ id?: string; order_number?: string } | null>(null);

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
          getDriverAssignedJobs(user.id, driverType, 50, 'returning_container'),
          getDriverAssignedJobs(user.id, driverType, 50, 'at_container_return'),
          getDriverAssignedJobs(user.id, driverType, 50, 'container_returned'),
          getDriverAssignedJobs(user.id, driverType, 50, 'completed'),
          getDriverAssignedJobs(user.id, driverType, 50, 'accepted'),
          getDriverAssignedJobs(user.id, driverType, 50, 'arrived_at_pickup'),
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
        // Freelance drivers: fetch from both freelance-accepted and factory-assigned APIs
        const [freelanceResp, factoryResp] = await Promise.all([
          fetch(
            `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
              },
            }
          ),
          fetch(
            `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${user.id}&limit=50`,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
              },
            }
          ),
        ]);

        const freelanceData = freelanceResp.ok ? await freelanceResp.json() : { success: false, data: [] };
        const factoryData = factoryResp.ok ? await factoryResp.json() : { success: false, data: [] };

        const combinedFreelanceData = [
          ...(Array.isArray(freelanceData?.data) ? freelanceData.data : []),
          ...(Array.isArray(factoryData?.data) ? factoryData.data.map((j: any) => ({ ...j, isFactoryJob: true })) : []),
        ];

        console.log('[JobDetailPage] Freelance jobs:', Array.isArray(freelanceData?.data) ? freelanceData.data.length : 0,
          'Factory jobs:', Array.isArray(factoryData?.data) ? factoryData.data.length : 0,
          'Combined:', combinedFreelanceData.length);
        console.log('[JobDetailPage] All order_numbers:', combinedFreelanceData.map((j: any) => j.order_number || j.order_code).filter(Boolean));

        // Create a mock response with combined data
        response = {
          ok: true,
          json: async () => ({ success: true, data: combinedFreelanceData }),
        } as Response;
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
          // Debug: dump ALL keys from API response to find correct field names
          console.log('[JobDetailPage] ALL API keys:', Object.keys(foundJob).sort());
          console.log('[JobDetailPage] FULL RAW JSON:', JSON.stringify(foundJob, null, 2));
          console.log('[JobDetailPage] ALL API values (date/location related):', 
            Object.fromEntries(
              Object.entries(foundJob).filter(([k]) => 
                k.includes('date') || k.includes('time') || k.includes('empty') || 
                k.includes('return') || k.includes('depot') || k.includes('container') || 
                k.includes('checkpoint') || k.includes('pickup') || k.includes('eta') ||
                k.includes('vessel') || k.includes('location') || k.includes('address') ||
                k.includes('phone') || k.includes('contact')
              )
            )
          );
          // Map API response to JobDetail interface
          // Handle different field names from different APIs
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number || foundJob.order_code || jobId!,
            job_type: (foundJob.booking_no || foundJob.bl_no) ? 'international' : (foundJob.job_type || foundJob.transport_category || 'domestic'),
            employer_name: foundJob.factory_name || foundJob.sender_name || foundJob.employer_name || '',
            transport_type: foundJob.transport_mode || foundJob.transport_type || 'เที่ยวเดียว',
            origin_location: (() => {
              const o = (foundJob.origin && typeof foundJob.origin === 'object') ? foundJob.origin : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return o?.address || null;
              if (foundJob.sender_district && foundJob.sender_province) return `${foundJob.sender_district}, ${foundJob.sender_province}`;
              if (o && (o.district || o.province)) return [o.district, o.province].filter(Boolean).join(', ');
              return foundJob.sender_address || (typeof foundJob.origin_location === 'string' ? foundJob.origin_location : '') || (typeof foundJob.origin_address === 'string' ? foundJob.origin_address : '') || '';
            })(),
            origin_address: (() => {
              const o = (foundJob.origin && typeof foundJob.origin === 'object') ? foundJob.origin : null;
              return o ? [o.province, o.district].filter(Boolean).join(' ') || null : null;
            })(),
            origin_company_name: foundJob.sender_name || foundJob.origin_company_name || (foundJob.origin && typeof foundJob.origin === 'object' ? foundJob.origin.name : null) || null,
            origin_contact_name: (() => {
              const o = (foundJob.origin && typeof foundJob.origin === 'object') ? foundJob.origin : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return o?.name || null;
              return foundJob.sender_contact_name || foundJob.origin_contact_name || o?.name || null;
            })(),
            origin_latitude: foundJob.sender_latitude || foundJob.origin_latitude || (foundJob.origin && typeof foundJob.origin === 'object' ? foundJob.origin.latitude : null) || null,
            origin_longitude: foundJob.sender_longitude || foundJob.origin_longitude || (foundJob.origin && typeof foundJob.origin === 'object' ? foundJob.origin.longitude : null) || null,
            origin_contact_phone: foundJob.sender_contact_phone || foundJob.origin_contact_phone || (foundJob.origin && typeof foundJob.origin === 'object' ? foundJob.origin.phone : null) || null,
            destination_location: (() => {
              const d = (foundJob.destination && typeof foundJob.destination === 'object') ? foundJob.destination : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return d?.address || null;
              if (foundJob.destination_district && foundJob.destination_province) return `${foundJob.destination_district}, ${foundJob.destination_province}`;
              if (d && (d.district || d.province)) return [d.district, d.province].filter(Boolean).join(', ');
              return (typeof foundJob.destination_address === 'string' ? foundJob.destination_address : '') || (typeof foundJob.destination_location === 'string' ? foundJob.destination_location : '') || '';
            })(),
            destination_address: (() => {
              const d = (foundJob.destination && typeof foundJob.destination === 'object') ? foundJob.destination : null;
              return d ? [d.province, d.district].filter(Boolean).join(' ') || null : null;
            })(),
            destination_company_name: foundJob.destination_company_name || foundJob.destination_name || (foundJob.destination && typeof foundJob.destination === 'object' ? foundJob.destination.name : null) || null,
            destination_contact_name: (() => {
              const d = (foundJob.destination && typeof foundJob.destination === 'object') ? foundJob.destination : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return d?.name || null;
              return foundJob.destination_contact_name || d?.name || null;
            })(),
            destination_latitude: foundJob.destination_latitude || (foundJob.destination && typeof foundJob.destination === 'object' ? foundJob.destination.latitude : null) || null,
            destination_longitude: foundJob.destination_longitude || (foundJob.destination && typeof foundJob.destination === 'object' ? foundJob.destination.longitude : null) || null,
            destination_contact_phone: foundJob.destination_contact_phone || (foundJob.destination && typeof foundJob.destination === 'object' ? foundJob.destination.phone : null) || null,
            price: (stateJob?.transport_price != null ? stateJob.transport_price : null) ?? foundJob.transport_price ?? foundJob.price ?? 0,
            start_date: foundJob.sender_pickup_date || foundJob.start_date || '',
            start_time: foundJob.sender_pickup_time || foundJob.start_time || '',
            equipment_list: foundJob.vehicle_type || foundJob.equipment_list || null,
            safety_equipment: null,
            container_checkpoint:
              foundJob.container_checkpoint ||
              foundJob.pickup_location_name ||
              foundJob.empty_pickup_depot ||
              foundJob.cy_empty_container ||
              foundJob.empty_pickup_location ||
              foundJob.empty_pickup_yard ||
              foundJob.cy_location ||
              foundJob.cy_name ||
              foundJob.yard_name ||
              foundJob.international_details?.empty_pickup_depot ||
              foundJob.international_details?.cy_empty_container ||
              foundJob.international_details?.pickup_location_name ||
              null,
            container_checkpoint_code: foundJob.container_checkpoint_code || null,
            empty_container_date: foundJob.first_pickup_date || foundJob.empty_container_date || foundJob.empty_pickup_date || foundJob.sender_pickup_date || null,
            empty_pickup_address:
              foundJob.empty_pickup_address ||
              foundJob.cy_empty_container_address ||
              foundJob.empty_pickup_location_address ||
              foundJob.cy_address ||
              foundJob.international_details?.empty_pickup_address ||
              foundJob.international_details?.cy_empty_container_address ||
              null,
            empty_pickup_phone: foundJob.empty_pickup_phone || foundJob.cy_phone || null,
            empty_pickup_date: foundJob.empty_pickup_date || foundJob.first_pickup_date || foundJob.sender_pickup_date || null,
            empty_pickup_time: foundJob.empty_pickup_time || foundJob.first_pickup_time || foundJob.sender_pickup_time || null,
            container_number: foundJob.container_number || null,
            container_number_2: foundJob.container_number_2 || null,
            seal_number: foundJob.seal_number || null,
            seal_number_2: foundJob.seal_number_2 || null,
            origin_contact_person: (() => {
              const o = (foundJob.origin && typeof foundJob.origin === 'object') ? foundJob.origin : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return o?.name || null;
              return foundJob.sender_contact_name || o?.name || null;
            })(),
            origin_contact_role: null,
            origin_bill_of_lading: foundJob.bill_of_lading || null,
            origin_goods_type: foundJob.product_name,
            origin_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            origin_remarks: foundJob.remarks,
            destination_contact_person: (() => {
              const d = (foundJob.destination && typeof foundJob.destination === 'object') ? foundJob.destination : null;
              const isIntl = !!(foundJob.booking_no || foundJob.bl_no);
              if (!isIntl) return d?.name || null;
              return foundJob.destination_contact_name || d?.name || null;
            })(),
            destination_bill_of_lading: foundJob.invoice_number || foundJob.destination_invoice_number || foundJob.inv_no || foundJob.destination_bill_of_lading || (typeof foundJob.csv_extra_data === 'object' && foundJob.csv_extra_data?.invoice_number) || (typeof foundJob.csv_extra_data === 'string' ? (() => { try { return JSON.parse(foundJob.csv_extra_data)?.invoice_number; } catch { return null; } })() : null) || null,
            destination_goods_type: foundJob.product_name,
            destination_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            destination_time: foundJob.destination_delivery_time,
            destination_date: foundJob.destination_delivery_date,
            destination_remarks: foundJob.remarks,
            tax_id: null,
            container_checkpoint_time: foundJob.container_checkpoint_time || foundJob.eta_date || foundJob.eta_time || foundJob.vessel_eta || foundJob.vessel_arrival_date || null,
            booking_number: foundJob.booking_number || null,
            booking_no: foundJob.booking_no || null,
            bl_no: foundJob.bl_no || null,
            // Container return info - support flat fields, nested object, and alternative field names from API
            container_return_location: foundJob.container_return_location || foundJob.container_return?.location || foundJob.return_depot || foundJob.return_location || foundJob.return_full_container_location || foundJob.full_container_return?.location || null,
            container_return_address: foundJob.container_return_address || foundJob.container_return?.address || foundJob.return_address || foundJob.return_full_container_address || foundJob.full_container_return?.address || null,
            container_return_latitude: foundJob.container_return_latitude || foundJob.container_return?.latitude || foundJob.return_latitude || foundJob.full_container_return?.latitude || null,
            container_return_longitude: foundJob.container_return_longitude || foundJob.container_return?.longitude || foundJob.return_longitude || foundJob.full_container_return?.longitude || null,
            container_return_phone: foundJob.container_return_phone || foundJob.container_return?.phone || foundJob.return_phone || foundJob.return_contact_phone || foundJob.full_container_return?.phone || null,
            container_return_date: foundJob.container_return_date || foundJob.container_return_datetime || foundJob.container_return?.date || foundJob.container_return?.datetime || foundJob.return_date || foundJob.return_full_container_date || foundJob.full_container_return?.date || null,
            // Map destinations array from API (fallback to csv_extra_data.destinations)
            destinations: (() => {
              let rawDests: any[] = Array.isArray(foundJob.destinations) ? foundJob.destinations : [];
              if (rawDests.length === 0) {
                const csv = typeof foundJob.csv_extra_data === 'string'
                  ? (() => { try { return JSON.parse(foundJob.csv_extra_data); } catch { return null; } })()
                  : foundJob.csv_extra_data;
                if (csv && Array.isArray(csv.destinations)) {
                  rawDests = csv.destinations;
                }
              }
              const isIntlJob =
                String(foundJob.job_type || '').toLowerCase() === 'bl' ||
                String(foundJob.job_type || '').toLowerCase() === 'booking' ||
                String(foundJob.job_type || '').toLowerCase() === 'international' ||
                String(foundJob.transport_category || '').toLowerCase() === 'international' ||
                !!foundJob.bl_no ||
                !!foundJob.booking_no;
              const hasSingleTripDestinationObject =
                !isIntlJob &&
                rawDests.length <= 1 &&
                foundJob.destination &&
                typeof foundJob.destination === 'object';
              if (hasSingleTripDestinationObject) return undefined;
              // For BL (inbound) jobs, fall back to sender_* / destination_* fields as the
              // cargo delivery point (place of receipt) when destinations array is empty.
              if (rawDests.length === 0 && foundJob.bl_no) {
                const cargoName = foundJob.sender_name || foundJob.destination_name || null;
                const cargoAddress = foundJob.sender_address || foundJob.destination_address || null;
                const cargoProvince = foundJob.sender_province || foundJob.destination_province || null;
                const cargoDistrict = foundJob.sender_district || foundJob.destination_district || null;
                const cargoLat = foundJob.sender_latitude ?? foundJob.destination_latitude ?? null;
                const cargoLng = foundJob.sender_longitude ?? foundJob.destination_longitude ?? null;
                const cargoPhone = foundJob.sender_contact_phone || foundJob.destination_contact_phone || null;
                const cargoContact = foundJob.sender_contact_name || foundJob.destination_contact_name || null;
                if (cargoName || cargoAddress || cargoProvince || cargoDistrict) {
                  rawDests = [{
                    id: `bl-cargo-${foundJob.id || jobId}`,
                    sequence_number: 1,
                    company_name: cargoName,
                    contact_name: cargoContact,
                    contact_phone: cargoPhone,
                    address: cargoAddress,
                    province: cargoProvince,
                    district: cargoDistrict,
                    latitude: cargoLat,
                    longitude: cargoLng,
                    delivery_date: foundJob.destination_delivery_date || foundJob.sender_pickup_date || null,
                    delivery_time: foundJob.destination_delivery_time || foundJob.sender_pickup_time || null,
                    goods_type: foundJob.product_name || null,
                  }];
                }
              }
              if (rawDests.length === 0) return undefined;
              return rawDests.map((d: any, idx: number) => {
                const destId = d.id || `dest-${d.sequence_number || idx + 1}`;
                const destProducts = Array.isArray(d.products) ? d.products : [];
                const matchedProducts = destProducts.length > 0
                  ? destProducts
                  : (Array.isArray(foundJob.products)
                      ? foundJob.products.filter((p: any) => p.destination_id === d.id)
                      : []);
                const productNames = matchedProducts
                  .map((p: any) => p.product_name || p.name)
                  .filter(Boolean);
                const goodsType = productNames.length > 0
                  ? productNames.join(',')
                  : d.goods_type || d.product_name || null;
                return {
                  id: destId,
                  sequence_number: d.sequence_number || idx + 1,
                  company_name: d.company_name || d.companyName || d.deliveryLocation || null,
                  contact_name: d.contact_name || d.contactName || null,
                  contact_phone: d.contact_phone || d.contactPhone || null,
                  address: d.address || null,
                  province: d.province || null,
                  district: d.district || null,
                  delivery_date: d.delivery_date || d.deliveryDate || null,
                  delivery_time: d.delivery_time || d.deliveryTime || null,
                  notes: d.notes || null,
                  checked_in_at: null,
                  sop_completed_at: null,
                  goods_type: goodsType,
                  invoice_number: d.invoice_number || d.billDoc || null,
                  latitude: d.latitude ?? null,
                  longitude: d.longitude ?? null,
                  products: matchedProducts,
                };
              });
            })(),
            // Pass raw products array
            products: Array.isArray(foundJob.products) ? foundJob.products : undefined,
            // Map origins array from API
            origins: Array.isArray(foundJob.origins) && foundJob.origins.length > 0
              ? foundJob.origins.map((o: any) => ({
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

          // International override: use origin / cargo_point / return_terminal / assigned_company
          const rawJobType = String((foundJob as any).job_type || '').toLowerCase();
          const rawTransportCategory = String((foundJob as any).transport_category || '').toLowerCase();
          const isIntl =
            mappedJob.job_type === 'international' ||
            rawJobType === 'bl' ||
            rawJobType === 'booking' ||
            rawJobType === 'international' ||
            rawTransportCategory === 'international' ||
            !!(foundJob as any).bl_no ||
            !!(foundJob as any).booking_no;
          if (isIntl) {
            const intl = (foundJob as any).international_details || {};
            const originObj = (foundJob as any).origin || intl.origin || {};
            const cargoObj = (foundJob as any).cargo_point || intl.cargo_point || {};
            const returnObj = (foundJob as any).return_terminal || intl.return_terminal || {};

            // Helper: build "ที่อยู่" จาก province + district เท่านั้น (ไม่มี fallback)
            const buildProvDist = (o: any): string | null => {
              const parts = [o?.province, o?.district].filter(Boolean);
              return parts.length > 0 ? parts.join(' ') : null;
            };

            // ผู้จ้าง
            mappedJob.employer_name = (foundJob as any).assigned_company || (foundJob as any).assignedCompany || mappedJob.employer_name;

            // จุดรับตู้ (origin) — สถานที่ = name, ที่อยู่ = province+district
            mappedJob.container_checkpoint = originObj.name || null;
            mappedJob.empty_pickup_address = buildProvDist(originObj);
            if (originObj.latitude != null) (mappedJob as any).origin_latitude = originObj.latitude;
            if (originObj.longitude != null) (mappedJob as any).origin_longitude = originObj.longitude;
            if (originObj.phone) mappedJob.origin_contact_phone = originObj.phone;
            if (originObj.customer) (mappedJob as any).origin_customer = originObj.customer;

            // จุดส่งสินค้า/จุดรับสินค้า (cargo_point) — สถานที่ = name, ที่อยู่ = province+district
            mappedJob.destination_company_name = cargoObj.name || null;
            mappedJob.destination_location = cargoObj.name || null;
            mappedJob.destination_address = buildProvDist(cargoObj);
            if (cargoObj.latitude != null) mappedJob.destination_latitude = cargoObj.latitude;
            if (cargoObj.longitude != null) mappedJob.destination_longitude = cargoObj.longitude;
            if (cargoObj.phone) mappedJob.destination_contact_phone = cargoObj.phone;
            if (cargoObj.customer) (mappedJob as any).cargo_point_customer = cargoObj.customer;

            // สำหรับงาน Booking (export): "จุดรับสินค้า" = cargo_point
            // override origin_* ให้ใช้ cargo_point name/province+district
            const isBooking = !!(foundJob as any).booking_no && !(foundJob as any).bl_no;
            if (isBooking) {
              mappedJob.origin_location = cargoObj.name || '-';
              mappedJob.origin_address = buildProvDist(cargoObj);
              if (cargoObj.customer) (mappedJob as any).origin_customer = cargoObj.customer;
            }

            if (cargoObj.name || cargoObj.address || cargoObj.district || cargoObj.province) {
              mappedJob.destinations = [{
                id: `cargo-point-${foundJob.id || jobId}`,
                sequence_number: 1,
                company_name: cargoObj.name || null,
                contact_name: null,
                contact_phone: cargoObj.phone || null,
                address: buildProvDist(cargoObj),
                province: cargoObj.province || null,
                district: cargoObj.district || null,
                location_name: cargoObj.name || null,
                delivery_date: foundJob.destination_delivery_date || foundJob.sender_pickup_date || null,
                delivery_time: foundJob.destination_delivery_time || foundJob.sender_pickup_time || null,
                notes: null,
                checked_in_at: null,
                sop_completed_at: null,
                goods_type: foundJob.product_name || null,
                invoice_number: mappedJob.destination_bill_of_lading || null,
                latitude: cargoObj.latitude ?? null,
                longitude: cargoObj.longitude ?? null,
                products: Array.isArray(foundJob.products) ? foundJob.products : undefined,
                customer: cargoObj.customer || null,
              } as any];
            }

            // จุดคืนตู้ (return_terminal) — สถานที่ = name, ที่อยู่ = province+district
            mappedJob.container_return_location = returnObj.name || null;
            mappedJob.container_return_address = buildProvDist(returnObj);
            if (returnObj.latitude != null) mappedJob.container_return_latitude = returnObj.latitude;
            if (returnObj.longitude != null) mappedJob.container_return_longitude = returnObj.longitude;
          }

          setJob(mappedJob);

          // Auto-open accident evidence modal if backend flagged this order
          if (foundJob.requires_accident_evidence === true && !foundJob.accident_evidence_uploaded_at) {
            setAccidentOrderInfo({ id: foundJob.id, order_number: foundJob.order_number || foundJob.order_code });
            setAccidentEvidenceRequired(true);
          } else {
            setAccidentEvidenceRequired(false);
            setAccidentOrderInfo(null);
          }

          // Create job application based on status from API
          // Note: 'delivered' status means arrived at destination but NOT POD completed.
          // completed/closed/container_returned means every required delivery step is already done.
          const statusLower = String(foundJob.status || '').toLowerCase();
          const isCompletedLikeStatus = ['completed', 'closed', 'container_returned'].includes(statusLower);
          const completedAt = foundJob.updated_at || foundJob.destination_delivery_date || foundJob.sender_pickup_date || new Date().toISOString();
          const jobApplicationData: JobApplication = {
            checked_in_at: isCompletedLikeStatus ? completedAt : null,
            sop_completed_at: isCompletedLikeStatus ? completedAt : null,
            job_started_at: statusLower === 'in_progress' ? new Date().toISOString() : null,
            delivery_checked_in_at: statusLower === 'delivered' || isCompletedLikeStatus ? completedAt : null,
            delivery_sop_completed_at: isCompletedLikeStatus ? completedAt : null,
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
            navigate('/home', { replace: true });
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
          navigate('/home', { replace: true });
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
            start_date: foundTicket.pickup_date || (foundTicket.pickup_datetime ? foundTicket.pickup_datetime.split('T')[0] : null) || foundTicket.created_at?.split('T')[0] || '',
            start_time: foundTicket.pickup_time || (foundTicket.pickup_datetime ? foundTicket.pickup_datetime.split('T')[1]?.substring(0, 5) : null) || '00:00',
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
            destination_time: foundTicket.delivery_time || (foundTicket.delivery_datetime ? foundTicket.delivery_datetime.split('T')[1]?.substring(0, 5) : null) || null,
            destination_date: foundTicket.delivery_date || (foundTicket.delivery_datetime ? foundTicket.delivery_datetime.split('T')[0] : null) || null,
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

  useEffect(() => {
    if (!loading && !job) {
      navigate('/home', { replace: true });
    }
  }, [loading, job, navigate]);

  if (loading) {
    return null;
  }

  if (!job || !user) {
    return null;
  }

  const handleUpdate = () => {
    loadJobDetail();
    refetchCheckinStatus();
  };

  return (
    <>
      <DomesticJobDetail 
        job={job} 
        jobApplication={jobApplication} 
        userId={user.id}
        onUpdate={handleUpdate}
      />
      <AccidentEvidenceModal
        open={accidentEvidenceRequired}
        onOpenChange={(o) => {
          if (!o) setAccidentEvidenceRequired(false);
        }}
        orderId={accidentOrderInfo?.id}
        orderNumber={accidentOrderInfo?.order_number}
        onSuccess={() => {
          setAccidentEvidenceRequired(false);
          loadJobDetail();
        }}
      />
    </>
  );
}
