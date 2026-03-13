import { useState, useEffect, useCallback } from 'react';
import { extractDistrictProvince } from '@/utils/addressExtraction';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Filter, Clock, MapPin, CircleDot, X, CalendarIcon, Calendar as CalendarIconLucide } from 'lucide-react';
import coinsIcon from '@/assets/coins-icon.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerFooter } from '@/components/ui/drawer';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { formatDate as formatThaiDate } from '@/lib/dateUtils';
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
import { translateJobType, translateUnit } from '@/utils/apiDataTranslations';
import { deduplicateJobs } from '@/utils/jobDeduplication';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { 
  getDriverAssignedJobs, 
  getFactoryAssignedJobs, 
  getFreelanceAcceptedJobs,
  getDriverCheckins,
  listTickets 
} from '@/lib/externalApi';
// Interface for accepted jobs from external API
interface AcceptedJob {
  id: string;
  order_number: string;
  transport_type_id: string | null;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_latitude: number | null;
  sender_longitude: number | null;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_contact_name: string;
  sender_contact_phone: string;
  destination_name: string;
  destination_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
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
  driver_name: string | null;
  driver_phone: string | null;
  license_plate: string | null;
  freelance_bidder_id: string | null;
  freelance_bidder_name: string | null;
  freelance_accepted_at?: string | null;
  factory_name?: string | null;
  isFactoryJob?: boolean;
  isBidJob?: boolean; // Flag for bid jobs - navigate to /bid-job/:ticketNumber
  job_type?: string | null; // domestic or international
  transport_category?: string | null;
  bl_no?: string | null;
  bl_number?: string | null;
  bill_of_lading?: string | null;
  booking_no?: string | null;
  booking_number?: string | null;
  // Container info for international jobs
  container_number?: string | null;
  container_number_2?: string | null;
  seal_number?: string | null;
  seal_number_2?: string | null;
  // International job addresses
  empty_pickup_address?: string | null;
  container_return_address?: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  // Multiple destinations support
  destinations?: Array<{ sequence: number; location: string; company_name?: string }>;
  // Products array for per-item display
  products?: Array<{
    product_name: string;
    product_code?: string;
    quantity: number;
    unit: string;
    weight: number;
    weight_unit: string;
    destination_id?: string;
  }>;
}
export default function CurrentJobsPage() {
  const navigate = useNavigate();
  const {
    user,
    userType
  } = useAuth();
  const {
    t,
    language
  } = useLanguage();
  const {
    role,
    isInternalDriver,
    isExternalDriver,
    canViewPrice
  } = useUserRole();
  const [acceptedJobs, setAcceptedJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [selectedJobType, setSelectedJobType] = useState<string>('all');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  useEffect(() => {
    console.log(`[CurrentJobsPage] useEffect triggered - user: ${user?.id}, userType: ${userType}`);
    loadAcceptedJobs();
  }, [user, userType]);

  // Use centralized dedupe utility for order_number based deduplication
  const dedupeJobs = (jobs: AcceptedJob[]) => {
    // Transform to match utility interface and dedupe
    const jobsWithOrderCode = jobs.map(job => ({
      ...job,
      order_code: job.order_number, // Map order_number to order_code for utility
    }));
    
    const deduped = deduplicateJobs(jobsWithOrderCode);
    
    console.log(`[CurrentJobsPage] Deduped ${jobs.length} jobs to ${deduped.length}`);
    return deduped as AcceptedJob[];
  };

  const loadAcceptedJobs = async () => {
    if (!user) return;
    setLoading(true);
    console.log(`[CurrentJobsPage] ===== LOADING ACCEPTED JOBS =====`);
    console.log(`[CurrentJobsPage] User: ${user.id}, UserType: ${userType}`);
    
    try {
      const freelanceDriverId = user.id;
      
      // For Internal/External drivers, only use get-driver-assigned-jobs API
      if (isInternalDriver || isExternalDriver) {
        console.log(`[CurrentJobsPage] Loading as ${isInternalDriver ? 'Internal' : 'External'} driver`);
        const driverType = isInternalDriver ? 'internal' : 'external';
        
         // Fetch jobs and check-ins in parallel using external API directly
        console.log(`[CurrentJobsPage] Calling API: getDriverAssignedJobs for in_transit + delivered + completed`);
        const [inTransitResult, deliveredResult, completedResult, checkinsResult] = await Promise.all([
          getDriverAssignedJobs(freelanceDriverId, driverType, 50, 'in_transit'),
          getDriverAssignedJobs(freelanceDriverId, driverType, 50, 'delivered'),
          getDriverAssignedJobs(freelanceDriverId, driverType, 100, 'completed'),
          getDriverCheckins(freelanceDriverId, driverType, 'all'),
        ]);

        // Merge in_transit, delivered, and completed results
        const inTransitJobs = (!inTransitResult.error && inTransitResult.data) ? ((inTransitResult.data as any)?.data || []) : [];
        const deliveredJobs = (!deliveredResult.error && deliveredResult.data) ? ((deliveredResult.data as any)?.data || []) : [];
        const completedJobs = (!completedResult.error && completedResult.data) ? ((completedResult.data as any)?.data || []) : [];
        const mergedApiJobs = [...inTransitJobs, ...deliveredJobs, ...completedJobs];
        console.log(`[CurrentJobsPage] Merged jobs: ${inTransitJobs.length} in_transit + ${deliveredJobs.length} delivered + ${completedJobs.length} completed = ${mergedApiJobs.length} total`);

        if (mergedApiJobs.length > 0 || (!inTransitResult.error && !deliveredResult.error && !completedResult.error)) {
          // Get check-ins to determine which jobs are actually started and which are completed
          let startedTransportIds = new Set<string>();
          // Track POD count per transport_order_id for multi-destination jobs
          const podCountByTransportId: Record<string, number> = {};
          // Track container return checkins for international jobs
          const containerReturnByTransportId: Set<string> = new Set();
          let allCheckins: any[] = [];
          
          if (!checkinsResult.error && checkinsResult.data) {
            allCheckins = (checkinsResult.data as any)?.data || [];
            console.log(`[CurrentJobsPage] Total checkins received: ${allCheckins.length}`);
            const driverIdField = isInternalDriver ? 'internal_driver_id' : 'external_driver_id';
            
            // Log all container_return_confirmed checkins for debugging
            const containerReturnCheckins = allCheckins.filter((c: any) => c.checkin_type === 'container_return_confirmed');
            console.log(`[CurrentJobsPage] container_return_confirmed checkins:`, containerReturnCheckins.map((c: any) => ({
              transport_order_id: c.transport_order_id,
              order_number: c.order_number || c.transport_orders?.order_number,
              driver: c[driverIdField],
              checkin_type: c.checkin_type
            })));
            
         allCheckins
               .filter(
                 (c: any) =>
                   c[driverIdField] === freelanceDriverId &&
                   c.transport_order_id
               )
               .forEach((c: any) => {
                 const transportId = String(c.transport_order_id);
                 if (c.checkin_type === 'delivery_confirmed' || c.checkin_type?.startsWith('delivery_confirmed_')) {
                   podCountByTransportId[transportId] = (podCountByTransportId[transportId] || 0) + 1;
                 }
                 if (c.checkin_type === 'container_return_confirmed') {
                   containerReturnByTransportId.add(transportId);
                   console.log(`[CurrentJobsPage] ✅ Found container_return_confirmed for transport: ${transportId}`);
                 }
               });
            
            // Jobs with ANY check-in record are actually started by the driver
            startedTransportIds = new Set(
              allCheckins
                .filter(
                  (c: any) =>
                    c[driverIdField] === freelanceDriverId &&
                    c.transport_order_id
                )
                .map((c: any) => String(c.transport_order_id))
            );
            
            console.log('POD counts by transport ID:', podCountByTransportId);
            console.log('Container return by transport ID:', [...containerReturnByTransportId]);
            console.log('Jobs with any check-in (actually started):', startedTransportIds.size);
          }
          
           const apiJobs = mergedApiJobs;
           console.log(`[CurrentJobsPage] Total API jobs returned: ${apiJobs.length}`);
           apiJobs.forEach(j => console.log(`  - Order: ${j.order_number}, Status: ${j.status}, ID: ${j.id}`));
           
           // Show jobs that have status 'in_transit' OR have check-in records (already started)
           // This allows jobs to appear in Current Jobs when:
           // 1. Driver clicked "Start Job" and status was updated to 'in_transit'
           // 2. Driver has done any check-in (pickup, delivery, etc.)
           const startedJobs = apiJobs.filter((job: any) => {
             const status = (job.status || '').toLowerCase();
             const hasCheckIn = startedTransportIds.has(String(job.id));
             const isInTransit = status === 'in_transit';
             const isDelivered = status === 'delivered';
             const shouldInclude = hasCheckIn || isInTransit || isDelivered;
             if (shouldInclude) {
               console.log(`[CurrentJobsPage] ✅ Including job ${job.order_number}: status='${status}', hasCheckIn=${hasCheckIn}, isInTransit=${isInTransit}`);
             }
             return shouldInclude;
           });
           console.log('Jobs with in_transit status or check-in records:', startedJobs.length, '(excluded not-yet-started:', apiJobs.length - startedJobs.length, ')');
          
          // Filter out completed jobs
          // Domestic: all PODs completed -> remove
          // International: all PODs completed AND container returned -> remove
          const isInternationalJob = (job: any) => !!(job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading || job.job_type === 'international' || (job.transport_category && job.transport_category !== 'domestic') || (job.transport_mode && ['sea', 'air'].includes(job.transport_mode.toLowerCase())));
          
           const activeJobs = startedJobs.filter((job: any) => {
              const transportId = String(job.id);
              const podCount = podCountByTransportId[transportId] || 0;
              const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
                ? job.destinations.length 
                : 1;
              
              const allPodsCompleted = podCount >= destinationCount;
              
              if (isInternationalJob(job)) {
                // International jobs: remove when container return is confirmed
                // Check both by transport_order_id and order_number for robustness
                const inSet = containerReturnByTransportId.has(transportId);
                const inCheckins = allCheckins.some((c: any) => {
                    const driverIdField = isInternalDriver ? 'internal_driver_id' : 'external_driver_id';
                    const matchesDriver = c[driverIdField] === freelanceDriverId;
                    const matchesJob = String(c.transport_order_id) === transportId || 
                      (c.order_number && c.order_number === job.order_number) ||
                      (c.transport_orders?.order_number && c.transport_orders.order_number === job.order_number);
                    return matchesDriver && matchesJob && c.checkin_type === 'container_return_confirmed';
                  });
                const hasContainerReturnConfirmed = inSet || inCheckins;
                
                console.log(`[CurrentJobsPage] International job ${job.order_number} (${transportId}): booking_no=${job.booking_no}, bl_no=${job.bl_no}, containerReturnInSet=${inSet}, containerReturnInCheckins=${inCheckins}, hasContainerReturn=${hasContainerReturnConfirmed}`);
                
                if (hasContainerReturnConfirmed) {
                  console.log(`[CurrentJobsPage] ➡️ International job ${job.order_number} container return confirmed → moving to history`);
                  return false;
                }
                // Still active if no container return confirmed
                return true;
              }
             
             // Domestic jobs: just need all PODs
             if (allPodsCompleted) {
               console.log(`Job ${job.order_number} completed: ${podCount}/${destinationCount} PODs`);
             }
             return !allPodsCompleted;
           });
          console.log('Active jobs after filtering completed:', activeJobs.length, '(excluded:', startedJobs.length - activeJobs.length, ')');
          console.log(`[CurrentJobsPage] Final accepted jobs count: ${activeJobs.length}`);
          // Map to AcceptedJob format
          const mappedJobs: AcceptedJob[] = activeJobs.map((job: any) => ({
            id: job.id,
            order_number: job.order_number,
            transport_type_id: job.transport_type_id,
            transport_mode: job.transport_mode,
            status: job.status,
            sender_name: job.factory_name || job.sender_company_name || job.sender_name || job.company_name || job.employer_name || '',
            sender_address: job.sender_address || '',
            sender_latitude: job.sender_latitude,
            sender_longitude: job.sender_longitude,
            sender_province: job.sender_province || '',
            sender_district: job.sender_district || '',
            sender_pickup_date: job.sender_pickup_date || '',
            sender_pickup_time: job.sender_pickup_time || '',
            sender_contact_name: job.sender_contact_name || '',
            sender_contact_phone: job.sender_contact_phone || '',
            destination_name: job.destination_name || '',
            destination_address: job.destination_address || '',
            destination_latitude: job.destination_latitude,
            destination_longitude: job.destination_longitude,
            destination_province: job.destination_province || '',
            destination_district: job.destination_district || '',
            destination_delivery_date: job.destination_delivery_date || '',
            destination_delivery_time: job.destination_delivery_time || '',
            destination_contact_name: job.destination_contact_name || '',
            destination_contact_phone: job.destination_contact_phone || '',
            destination_company_name: job.destination_company_name,
            product_name: job.product_name,
            product_type: job.product_type,
            product_category: job.product_category,
            product_weight: job.product_weight,
            product_weight_value: job.product_weight_value,
            product_quantity: job.product_quantity,
            product_unit: job.product_unit,
            vehicle_type: job.vehicle_type,
            vehicle_category: job.vehicle_category,
            transport_price: job.transport_price || 0,
            driver_name: job.driver_name,
            driver_phone: job.driver_phone,
            license_plate: job.license_plate,
            freelance_bidder_id: null,
            freelance_bidder_name: null,
            factory_name: job.factory_name,
            isFactoryJob: true,
            job_type: (job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading) ? 'international' : (job.job_type || job.transport_category || null),
            transport_category: job.transport_category || null,
            bl_no: job.bl_no || job.bl_number || job.bill_of_lading || null,
            booking_no: job.booking_no || job.booking_number || null,
            // Container info for international jobs
            container_number: job.container_number || null,
            container_number_2: job.container_number_2 || null,
            seal_number: job.seal_number || null,
            seal_number_2: job.seal_number_2 || null,
            // International job addresses
            empty_pickup_address: job.empty_pickup_address || null,
            container_return_address: job.container_return_address || null,
            remarks: job.remarks,
            created_at: job.created_at,
            updated_at: job.updated_at,
            // Multiple destinations support
            destinations: Array.isArray(job.destinations) ? job.destinations.map((d: any, idx: number) => ({
              sequence: d.sequence_number || d.sequence || idx + 1,
              location: d.district && d.province ? `${d.district}, ${d.province}` : (d.address || d.location || ''),
              company_name: d.company_name || '',
              products: Array.isArray(d.products) ? d.products : undefined,
            })) : undefined,
            products: Array.isArray(job.products) ? job.products : (Array.isArray(job.destinations) ? job.destinations.flatMap((d: any) => Array.isArray(d.products) ? d.products : []) : undefined),
           }));

           console.log(`[CurrentJobsPage] Setting accepted jobs: ${mappedJobs.length} jobs`);
           mappedJobs.forEach(j => console.log(`  - ${j.order_number} (status: ${j.status})`));
           setAcceptedJobs(mappedJobs);
        } else {
          console.error('Error loading driver assigned jobs:', inTransitResult.error, deliveredResult.error, completedResult.error);
          setAcceptedJobs([]);
        }
        
        setLoading(false);
        return;
      }
      
      // For Freelance drivers: Fetch company jobs, factory jobs, bid-won jobs, AND check-ins from API in parallel
      const [companyJobsResult, factoryJobsResult, bidWonJobsResult, freelanceCheckinsResult] = await Promise.all([
        getFreelanceAcceptedJobs(freelanceDriverId),
        getFactoryAssignedJobs(freelanceDriverId, 50).catch(() => ({ data: null, error: 'Failed' })),
        listTickets({ freelanceDriverId, bidsStatus: 'accepted' }).catch(() => ({ data: null, error: 'Failed' })),
        getDriverCheckins(freelanceDriverId, 'freelance', 'all').catch(() => ({ data: null, error: 'Failed' })),
      ]);

      // Track POD count and container return per transport_order_id and order_number
      const podCountByTransportId: Record<string, number> = {};
      const podCountByOrderNumber: Record<string, number> = {};
      const containerReturnByTransportId: Set<string> = new Set();
      const containerReturnByOrderNumber: Set<string> = new Set();
      let allFreelanceCheckins: any[] = [];
      
      if (!freelanceCheckinsResult.error && freelanceCheckinsResult.data) {
        allFreelanceCheckins = (freelanceCheckinsResult.data as any)?.data || [];
        
        allFreelanceCheckins
          .filter(
            (c: any) => c.freelance_driver_id === freelanceDriverId
          )
          .forEach((c: any) => {
            if (c.checkin_type === 'delivery_confirmed' || c.checkin_type?.startsWith('delivery_confirmed_')) {
              if (c.transport_order_id) {
                const transportId = String(c.transport_order_id);
                podCountByTransportId[transportId] = (podCountByTransportId[transportId] || 0) + 1;
              }
              const orderNumber = c.transport_orders?.order_number || c.order_number || '';
              if (orderNumber) {
                podCountByOrderNumber[orderNumber] = (podCountByOrderNumber[orderNumber] || 0) + 1;
              }
            }
            if (c.checkin_type === 'container_return_confirmed') {
              if (c.transport_order_id) {
                containerReturnByTransportId.add(String(c.transport_order_id));
              }
              const orderNumber = c.transport_orders?.order_number || c.order_number || '';
              if (orderNumber) {
                containerReturnByOrderNumber.add(orderNumber);
              }
            }
          });
        console.log('Freelance POD counts:', { byTransportId: podCountByTransportId, byOrderNumber: podCountByOrderNumber });
        console.log('Freelance container return:', { byTransportId: [...containerReturnByTransportId], byOrderNumber: [...containerReturnByOrderNumber] });
      }
      
      // Helper: check if job is international
      const isInternationalJob = (job: any) => !!(job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading || job.job_type === 'international' || (job.transport_category && job.transport_category !== 'domestic') || (job.transport_mode && ['sea', 'air'].includes(job.transport_mode.toLowerCase())));

      // Helper function to check if job has all PODs completed (and container returned for international)
      const isJobFullyCompleted = (job: any): boolean => {
        const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
          ? job.destinations.length 
          : 1;
        
        const podCount = Math.max(
          podCountByTransportId[String(job.id)] || 0,
          podCountByOrderNumber[job.order_number] || 0
        );
        
        const allPodsCompleted = podCount >= destinationCount;
        
        // For international jobs, also require container return
        if (isInternationalJob(job)) {
          const hasContainerReturn = containerReturnByTransportId.has(String(job.id)) ||
            containerReturnByOrderNumber.has(job.order_number);
          // International: remove from current jobs once container return is confirmed
          if (hasContainerReturn) return true;
          return allPodsCompleted && hasContainerReturn;
        }
        
        return allPodsCompleted;
      };

      // Process company jobs - filter out jobs with all PODs completed
      let companyJobs: AcceptedJob[] = [];
      if (!companyJobsResult.error && companyJobsResult.data) {
        const companyResult = companyJobsResult.data;
        console.log('Loaded company accepted jobs:', companyResult);
        const allCompanyJobs = Array.isArray(companyResult) ? companyResult : ((companyResult as any).data || []);
        // Debug: log raw data for specific order
        allCompanyJobs.forEach((job: any) => {
          if (job.order_number === 'OR20260306033') {
            console.log('[DEBUG] OR20260306033 raw company job data:', JSON.stringify({ booking_no: job.booking_no, booking_number: job.booking_number, bl_no: job.bl_no, bl_number: job.bl_number, bill_of_lading: job.bill_of_lading, job_type: job.job_type, transport_category: job.transport_category, allKeys: Object.keys(job) }, null, 2));
          }
        });
        // Filter out jobs that have ALL destinations POD completed, and map job_type/destinations
        companyJobs = allCompanyJobs
          .filter((job: any) => !isJobFullyCompleted(job))
          .map((job: any) => ({
            ...job,
            job_type: (job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading) ? 'international' : (job.job_type || job.transport_category || 'domestic'),
            bl_no: job.bl_no || job.bl_number || job.bill_of_lading || null,
            booking_no: job.booking_no || job.booking_number || null,
            destinations: Array.isArray(job.destinations) ? job.destinations.map((d: any, idx: number) => ({
              sequence: d.sequence_number || d.sequence || idx + 1,
              location: d.district && d.province ? `${d.district}, ${d.province}` : (d.address || d.location || ''),
              company_name: d.company_name || '',
              products: Array.isArray(d.products) ? d.products : undefined,
            })) : undefined,
            products: Array.isArray(job.products) ? job.products : (Array.isArray(job.destinations) ? job.destinations.flatMap((d: any) => Array.isArray(d.products) ? d.products : []) : undefined),
          }));
      } else {
        console.error('Error loading company accepted jobs:', companyJobsResult.error);
      }

      // Process factory jobs - include assigned/in_transit/in_progress jobs
      let factoryJobs: AcceptedJob[] = [];
      let pendingFactoryOrderNumbers = new Set<string>();
      if (!factoryJobsResult.error && factoryJobsResult.data) {
        const factoryResult = factoryJobsResult.data;
        console.log('Loaded factory jobs:', factoryResult);
        const allFactoryJobs = Array.isArray(factoryResult) ? factoryResult : ((factoryResult as any).data || []);
        allFactoryJobs.forEach((job: any) => {
          if (job.order_number === 'OR20260306033') {
            console.log('[DEBUG] OR20260306033 raw factory job data:', JSON.stringify({ booking_no: job.booking_no, booking_number: job.booking_number, bl_no: job.bl_no, bl_number: job.bl_number, bill_of_lading: job.bill_of_lading, job_type: job.job_type, transport_category: job.transport_category, allKeys: Object.keys(job) }, null, 2));
          }
        });

        // Statuses that indicate job is actively assigned and should show in Current Jobs
        const activeStatuses = ['in_progress', 'in_transit', 'assigned', 'accepted'];
        
        // Track pending factory offers (awaiting_response) 
        // Only these should NOT appear in Current Jobs
        pendingFactoryOrderNumbers = new Set(
          allFactoryJobs
            .filter((job: any) => {
              const status = (job?.status || '').toLowerCase().trim();
              // Only awaiting_response should be excluded from Current Jobs
              return status === 'awaiting_response';
            })
            .map((job: any) => job?.order_number)
            .filter(Boolean)
        );
        
        // Include factory jobs that are:
        // - Active status (in_progress, in_transit, assigned, accepted) OR
        // - Accepted by freelance (has freelance_accepted_at)
        // AND not all PODs completed yet
        factoryJobs = allFactoryJobs
          .filter((job: any) => {
            // Skip if all destinations have POD completed
            if (isJobFullyCompleted(job)) return false;
            
            const status = (job?.status || '').toLowerCase().trim();
            
            // Skip awaiting_response - these are offers, not assigned jobs
            if (status === 'awaiting_response') return false;
            
            // Allow active status jobs to appear in Current Jobs (admin-assigned)
            const isActiveStatus = activeStatuses.includes(status);
            // Also allow jobs that have been accepted by freelance
            const isAccepted = Boolean(job.freelance_accepted_at);
            
            return isActiveStatus || isAccepted;
          })
          .map((job: any) => {
            const inferredJobType = (job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading)
              ? 'international'
              : (job.job_type || job.transport_category || undefined);
            const mappedDestinations = Array.isArray(job.destinations) && job.destinations.length > 0
              ? job.destinations.map((d: any, idx: number) => ({
                  sequence: d.sequence_number || d.sequence || idx + 1,
                  location: d.district && d.province ? `${d.district}, ${d.province}` : (d.address || d.location || ''),
                  company_name: d.company_name || '',
                  products: Array.isArray(d.products) ? d.products : undefined,
                }))
              : undefined;

            return {
              ...job,
              sender_name: job.factory_name || job.sender_name,
              isFactoryJob: true,
              ...(inferredJobType ? { job_type: inferredJobType } : {}),
              ...(job.bl_no || job.bl_number || job.bill_of_lading ? { bl_no: job.bl_no || job.bl_number || job.bill_of_lading } : {}),
              ...(job.booking_no || job.booking_number ? { booking_no: job.booking_no || job.booking_number } : {}),
              ...(mappedDestinations ? { destinations: mappedDestinations } : {}),
              ...(Array.isArray(job.products) ? { products: job.products } : (Array.isArray(job.destinations) ? { products: job.destinations.flatMap((d: any) => Array.isArray(d.products) ? d.products : []) } : {})),
            };
          });
          
        console.log('Factory jobs for Current Jobs:', factoryJobs.length, '(awaiting_response excluded:', pendingFactoryOrderNumbers.size, ')');
      }

      if (pendingFactoryOrderNumbers.size > 0) {
        companyJobs = companyJobs.filter((job) => !pendingFactoryOrderNumbers.has(job.order_number));
      }

      // Process bid-won jobs from list-tickets API
      // Show ALL accepted bid jobs EXCEPT those with delivery_confirmed check-in
      let bidWonJobs: AcceptedJob[] = [];
      if (!bidWonJobsResult.error && bidWonJobsResult.data) {
        const bidData = bidWonJobsResult.data;
        console.log('Loaded bid-won jobs from API:', bidData);
        const tickets = (bidData as any)?.data || (bidData as any)?.tickets || (Array.isArray(bidData) ? bidData : []);
        
        // Only exclude cancelled and closed, NOT completed
        // Completed jobs should still show until all PODs are done
        const excludedStatuses = ['cancelled', 'closed'];
        bidWonJobs = tickets
          .filter((ticket: any) => {
            const ticketNumber = ticket.ticket_number || ticket.order_code || ticket.post_code || '';
            const status = (ticket.status || '').toLowerCase();
            
            // Check if all PODs are completed for this ticket
            const podCount = podCountByOrderNumber[ticketNumber] || 0;
            // Bid jobs typically have single destination, but check destinations array if present
            const destinationCount = Array.isArray(ticket.destinations) && ticket.destinations.length > 0
              ? ticket.destinations.length
              : 1;
            
            // For international bid jobs, also check container return
            if (isInternationalJob(ticket)) {
              const hasContainerReturn = containerReturnByOrderNumber.has(ticketNumber);
              if (hasContainerReturn) {
                console.log(`International bid job ${ticketNumber} excluded - container return confirmed`);
                return false;
              }
            }
            
            if (podCount >= destinationCount) {
              console.log(`Bid job ${ticketNumber} excluded - all PODs completed (${podCount}/${destinationCount})`);
              return false;
            }
            
            // Skip cancelled/closed
            if (excludedStatuses.includes(status)) return false;
            
            // Check if current user has an accepted bid on this ticket
            const userAcceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === freelanceDriverId
            );
            return !!userAcceptedBid;
          })
          .map((ticket: any) => ({
            id: ticket.id,
            order_number: ticket.ticket_number || ticket.order_code || ticket.post_code || ticket.ticket_code,
            transport_type_id: null,
            transport_mode: ticket.transport_type || ticket.post_type,
            status: ticket.status || 'accepted',
            sender_name: ticket.customer?.company_name || ticket.creator?.company_name || ticket.creator?.full_name || ticket.company_name || ticket.employer_name || ticket.factory_name || '',
            sender_address: ticket.pickup_location?.address || ticket.sender_address || ticket.origin_address || '',
            sender_latitude: ticket.pickup_location?.latitude || ticket.origin_lat || null,
            sender_longitude: ticket.pickup_location?.longitude || ticket.origin_lng || null,
            sender_province: ticket.route?.origin_district?.province?.name || ticket.pickup_location?.province || '',
            sender_district: ticket.route?.origin_district?.name || ticket.pickup_location?.district || '',
            sender_pickup_date: ticket.pickup_location?.date || ticket.pickup_date || (ticket.pickup_datetime ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'yyyy-MM-dd') : null) || ticket.start_date || ticket.created_at?.split('T')[0],
            sender_pickup_time: ticket.pickup_location?.time || ticket.pickup_time || (ticket.pickup_datetime ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'HH:mm') : null) || ticket.start_time || '00:00',
            sender_contact_name: ticket.customer?.full_name || ticket.pickup_location?.contact_name || ticket.sender_name || '',
            sender_contact_phone: ticket.customer?.phone || ticket.pickup_location?.contact_phone || ticket.sender_phone || '',
            destination_name: ticket.dropoff_location?.name || ticket.recipient_name || '',
            destination_address: ticket.dropoff_location?.address || ticket.recipient_address || ticket.destination_address || '',
            destination_latitude: ticket.dropoff_location?.latitude || ticket.destination_lat || null,
            destination_longitude: ticket.dropoff_location?.longitude || ticket.destination_lng || null,
            destination_province: ticket.route?.destination_district?.province?.name || ticket.dropoff_location?.province || '',
            destination_district: ticket.route?.destination_district?.name || ticket.dropoff_location?.district || '',
            destination_delivery_date: ticket.dropoff_location?.date || ticket.delivery_date || (ticket.delivery_datetime ? formatInTimeZone(new Date(ticket.delivery_datetime), 'Asia/Bangkok', 'yyyy-MM-dd') : null) || ticket.destination_date || ticket.pickup_date,
            destination_delivery_time: ticket.dropoff_location?.time || ticket.delivery_time || (ticket.delivery_datetime ? formatInTimeZone(new Date(ticket.delivery_datetime), 'Asia/Bangkok', 'HH:mm') : null) || ticket.destination_time || '00:00',
            destination_contact_name: ticket.dropoff_location?.contact_name || ticket.recipient_name || '',
            destination_contact_phone: ticket.dropoff_location?.contact_phone || ticket.recipient_phone || '',
            destination_company_name: ticket.dropoff_location?.company_name || ticket.destination_company_name || null,
            product_name: ticket.product || ticket.product_name || ticket.goods_type || null,
            product_type: ticket.product_type || null,
            product_category: null,
            product_weight: ticket.weight_tons || ticket.product_weight || null,
            product_weight_value: null,
            product_quantity: ticket.trips_per_month || ticket.product_quantity || null,
            product_unit: ticket.product_unit || null,
            vehicle_type: ticket.vehicle_type?.name || ticket.truck_type || ticket.vehicle_type || null,
            vehicle_category: null,
            transport_price: ticket.transport_price || ticket.bids?.find((b: any) => b.status === 'accepted' && b.contractor_id === freelanceDriverId)?.bid_price || ticket.price || 0,
            driver_name: null,
            driver_phone: null,
            license_plate: null,
            freelance_bidder_id: freelanceDriverId,
            freelance_bidder_name: null,
            freelance_accepted_at: ticket.bid_accepted_at || ticket.created_at,
            factory_name: ticket.factory_name || null,
            isFactoryJob: false,
            isBidJob: true, // Mark as bid job for UI distinction
            job_type: (ticket.booking_no || ticket.booking_number || ticket.bl_no || ticket.bl_number || ticket.bill_of_lading) ? 'international' : (ticket.job_type || ticket.transport_category || 'domestic'),
            bl_no: ticket.bl_no || ticket.bl_number || ticket.bill_of_lading || null,
            booking_no: ticket.booking_no || ticket.booking_number || null,
            remarks: ticket.notes || ticket.remarks || null,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at || ticket.created_at,
            // Multiple destinations support
            destinations: Array.isArray(ticket.destinations) ? ticket.destinations.map((d: any, idx: number) => ({
              sequence: d.sequence_number || d.sequence || idx + 1,
              location: d.district && d.province ? `${d.district}, ${d.province}` : (d.address || d.location || ''),
              company_name: d.company_name || '',
              products: Array.isArray(d.products) ? d.products : undefined,
            })) : undefined,
            products: Array.isArray(ticket.products) ? ticket.products : (Array.isArray(ticket.destinations) ? ticket.destinations.flatMap((d: any) => Array.isArray(d.products) ? d.products : []) : undefined),
          }));
        
        console.log(`Bid jobs for Current Jobs: ${bidWonJobs.length} (excluded ${tickets.length - bidWonJobs.length} with delivery_confirmed or wrong user)`);
      }

      // Combine all job sources
      // Bid jobs have correct timezone-converted dates, so they should take priority
      // Filter out company/factory duplicates of bid jobs before combining
      const bidOrderNumbers = new Set(bidWonJobs.map((j: any) => j.order_number).filter(Boolean));
      const filteredCompanyJobs = companyJobs.filter((j: any) => !bidOrderNumbers.has(j.order_number));
      const filteredFactoryJobs = factoryJobs.filter((j: any) => !bidOrderNumbers.has(j.order_number));
      
      const allJobs = [...filteredCompanyJobs, ...filteredFactoryJobs, ...bidWonJobs];
      const uniqueJobs = dedupeJobs(allJobs);
      console.log('Total current jobs:', uniqueJobs.length, '(Company:', filteredCompanyJobs.length, ', Factory:', filteredFactoryJobs.length, ', Bid-Won:', bidWonJobs.length, ', Dedupe removed:', allJobs.length - uniqueJobs.length, ')');

      const normalizedJobs = uniqueJobs.map((job: AcceptedJob) => ({
        ...job,
        job_type: (job.booking_no || job.booking_number || job.bl_no || job.bl_number || job.bill_of_lading)
          ? 'international'
          : (job.job_type || job.transport_category || 'domestic'),
      }));

      setAcceptedJobs(normalizedJobs);

      // Auto-create tracking rooms for accepted bid jobs that don't have one yet
      for (const bidJob of bidWonJobs) {
        const orderNum = bidJob.order_number;
        if (!orderNum) continue;
        const existingRoomCode = localStorage.getItem(`room_code_${orderNum}`);
        if (existingRoomCode) {
          console.log(`[Tracking] Bid job ${orderNum} already has room_code: ${existingRoomCode}`);
          continue;
        }

        try {
          // Get driver's vehicle plate
          const province = (user.plate_province || '').trim();
          const number = (user.plate_number || '').trim();
          const truckPlate = [province, number].filter(Boolean).join(' ').trim() || user.id;

          // Get actual GPS position for current_lat/current_lng
          let currentLat = bidJob.sender_latitude || 0;
          let currentLng = bidJob.sender_longitude || 0;
          try {
            const gpsPos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              });
            });
            currentLat = gpsPos.coords.latitude;
            currentLng = gpsPos.coords.longitude;
            console.log(`📍 [Tracking] Got GPS for bid job ${orderNum}:`, currentLat, currentLng);
          } catch (gpsErr) {
            console.warn(`[Tracking] Could not get GPS for ${orderNum}, using origin:`, gpsErr);
          }

          const trackingBody = {
            truck_plate: truckPlate,
            order_code: orderNum,
            origin_lat: bidJob.sender_latitude || 0,
            origin_lng: bidJob.sender_longitude || 0,
            destination_lat: bidJob.destination_latitude || 0,
            destination_lng: bidJob.destination_longitude || 0,
            current_lat: currentLat,
            current_lng: currentLng,
          };

          console.log(`[Tracking] Creating tracking room for bid job ${orderNum}:`, trackingBody);

          const trackingResponse = await supabase.functions.invoke('create-tracking-room', {
            body: trackingBody,
          });

          if (trackingResponse.error) {
            console.error(`[Tracking] Error creating room for ${orderNum}:`, trackingResponse.error);
          } else {
            const roomCode = trackingResponse.data?.room?.room_code;
            if (roomCode) {
              localStorage.setItem(`room_code_${orderNum}`, roomCode);
              console.log(`[Tracking] Room created for bid job ${orderNum}: ${roomCode}`);
            }
          }
        } catch (trackingErr) {
          console.error(`[Tracking] Failed to create room for bid job ${orderNum}:`, trackingErr);
        }
      }
    } catch (error) {
      console.error('Error fetching accepted jobs:', error);
      toast({
        title: t('currentJobs.errorLoad'),
        description: t('currentJobs.errorLoadDesc'),
        variant: 'destructive'
      });
      setAcceptedJobs([]);
    }
    
    setLoading(false);
  };

  const handleApplyFilter = () => {
    setFilterOpen(false);
  };
  const handleResetFilter = () => {
    setSelectedJobType('all');
    setSelectedTransportType('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Filter jobs based on search and date filters
  // Note: We no longer filter by 'completed' status here because:
  // 1. For Bid Jobs, 'completed' from external API just means the bid was accepted
  // 2. The real completion check is done via delivery_confirmed check-in
  // 3. Jobs with delivery_confirmed are already filtered out during data loading
  const excludedStatuses = ['cancelled', 'closed', 'ยกเลิก', 'ปิดงาน'];
  
  const filteredJobs = acceptedJobs.filter((job: any) => {
    // Only filter out cancelled/closed jobs, NOT completed
    const jobStatus = (job.status || '').toLowerCase().trim();
    if (excludedStatuses.some(s => jobStatus.includes(s.toLowerCase()))) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderNumber = job.order_number || '';
      const senderName = job.sender_name || '';
      const matchesSearch = 
        orderNumber.toLowerCase().includes(query) || 
        senderName.toLowerCase().includes(query) || 
        (job.destination_company_name && job.destination_company_name.toLowerCase().includes(query)) || 
        (job.sender_province && job.sender_province.toLowerCase().includes(query)) || 
        (job.destination_province && job.destination_province.toLowerCase().includes(query)) ||
        (job.product_name && job.product_name.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const jobDate = new Date(job.sender_pickup_date);
      jobDate.setHours(0, 0, 0, 0);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (jobDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (jobDate > end) return false;
      }
    }
    return true;
  });
  const EmptyState = () => <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4">
        <MapPin className="w-16 h-16 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-center">{t('currentJobs.empty')}</p>
    </div>;
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-header text-header-foreground sticky top-0 z-50 rounded-b-xl page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('currentJobs.title')}</h1>
        </div>
      </header>

      <PullToRefresh onRefresh={async () => { await loadAcceptedJobs(); }}>

      {/* Search and Filter Bar */}
      <div className="bg-[#FAFAFF] px-4 py-3 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder={t('currentJobs.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 bg-white " />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setFilterOpen(true)}>
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div> : filteredJobs.length === 0 ? <EmptyState /> : <div className="space-y-4">
            {filteredJobs.map(job => {
          const pickupDate = job.sender_pickup_date || '';
          const pickupTime = job.sender_pickup_time || '';
          const deliveryDate = job.destination_delivery_date || '';
          const deliveryTime = job.destination_delivery_time || '';

          return <Card key={job.id} className="overflow-hidden bg-card">
                  <div className="flex items-center justify-between px-3 py-2 bg-white">
                    <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
                      {job.bl_no ? `BL ${job.bl_no}` : job.booking_no ? `Booking ${job.booking_no}` : `${t('job.order_code')} ${job.order_number}`}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatThaiDate(pickupDate, language)} | {pickupTime.substring(0, 5)}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">{(isInternalDriver || isExternalDriver) ? t('job.factory') : t('job.employer')} : </span>
                      <span className="font-medium">{job.sender_name}</span>
                    </div>
                    
                    {job.job_type && (
                      <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-medium ${
                        job.job_type === 'domestic' || job.job_type === 'ในประเทศ' || job.job_type === 'ภายในประเทศ'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {translateJobType(job.job_type, language)}
                        {(job.job_type === 'domestic' || job.job_type === 'ในประเทศ' || job.job_type === 'ภายในประเทศ') ? (
                          <span className="ml-1">
                            {job.destinations && Array.isArray(job.destinations) && job.destinations.length > 0
                              ? `(${t('job.multipleDestinations')})`
                              : `(${t('job.singleTrip')})`}
                          </span>
                        ) : (
                          <span className="ml-1">
                            {job.bl_no ? '(BL)' : job.booking_no ? '(Booking)' : ''}
                          </span>
                        )}
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 flex gap-2">
                        <div className="flex flex-col items-center">
                          <CircleDot className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="w-0.5 flex-1 border-l-2 border-dashed border-gray-300 my-1"></div>
                          <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.origin')}</div>
                            <div className="font-medium">
                              {job.sender_province && job.sender_district 
                                ? `${job.sender_district}, ${job.sender_province}` 
                                : extractDistrictProvince(job.empty_pickup_address || job.sender_address)}
                            </div>
                          </div>
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.destination')}</div>
                            <div className="font-medium">
                              {job.destination_province && job.destination_district 
                                ? `${job.destination_district}, ${job.destination_province}` 
                                : extractDistrictProvince(job.container_return_address || job.destination_address)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        {canViewPrice && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                            <img src={coinsIcon} alt="coins" className="w-5 h-5" />
                            <span className="text-lg font-bold text-teal-500">฿ {(job.transport_price || 0).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                          <CalendarIconLucide className="w-4 h-4 text-gray-500" />
                          <div className="text-left">
                            <div className="text-xs text-[#375B7B]">
                              วันเข้ารับสินค้า
                            </div>
                            <div className="text-xs font-medium">
                              {formatThaiDate(pickupDate, language)} | {pickupTime.substring(0, 5)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>


                    {!job.bl_no && !job.booking_no && (
                    <div className="rounded-lg p-3 space-y-1.5 text-xs bg-[#e6f8ff]">
                      {Array.isArray(job.products) && job.products.length > 0 ? (
                        job.products.map((product, idx) => {
                          const weightUnitLabel = translateUnit(product.weight_unit || 'kg', language);
                          const quantityUnitLabel = translateUnit(product.unit, language);
                          return (
                            <div key={product.product_name + idx} className={idx > 0 ? 'pt-1.5 border-t border-blue-200' : ''}>
                              <div>
                                <span className="text-[#375c7b]">{t('job.goods')} {idx + 1} : </span>
                                <span className="font-medium">{product.product_name}</span>
                              </div>
                              <div>
                                <span className="text-[#375B7B]">{t('job.weight')} : </span>
                                <span>{product.weight ? `${product.weight.toLocaleString()} ${weightUnitLabel}` : '-'}</span>
                              </div>
                              <div>
                                <span className="text-[#375B7B]">{t('job.quantity')} : </span>
                                <span>{product.quantity ? `${product.quantity.toLocaleString()} ${quantityUnitLabel}` : '-'}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <>
                          <div>
                            <span className="text-[#375c7b]">{t('job.goods')} : </span>
                            <span>{job.product_name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-[#375B7B]">{t('job.weight')} : </span>
                            <span>{job.product_weight ? `${job.product_weight.toLocaleString()} ${translateUnit('kg', language)}` : '-'}</span>
                          </div>
                          <div>
                            <span className="text-[#375B7B]">{t('job.quantity')} : </span>
                            <span>{job.product_quantity ? `${job.product_quantity}${job.product_unit ? ` ${translateUnit(job.product_unit, language)}` : ''}` : '-'}</span>
                          </div>
                        </>
                      )}
                    </div>
                    )}

                    <Button variant="outline" className="w-full h-11 text-base font-medium" onClick={() => {
                      // Navigate to correct page based on job type
                      if (job.isBidJob) {
                        navigate(`/bid-job/${job.order_number}`);
                      } else {
                        // Pass the job payload as navigation state (fallback if API no longer returns it)
                        navigate(`/job/${job.order_number}`, { state: { job } });
                      }
                    }}>
                      {t('currentJobs.viewDetails')}
                    </Button>
                  </div>
                </Card>;
        })}
          </div>}
      </div>

      </PullToRefresh>

      {/* Filter Drawer */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle>{t('currentJobs.filter')}</DrawerTitle>
              <DrawerClose>
                <X className="w-5 h-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('currentJobs.dateRange')}</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-11", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : t('currentJobs.startDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground">—</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-11", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : t('currentJobs.endDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleResetFilter}>
                {t('currentJobs.clearFilter')}
              </Button>
              <Button onClick={handleApplyFilter}>
                {t('currentJobs.applyFilter')}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>;
}