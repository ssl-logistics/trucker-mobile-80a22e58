import { useState, useEffect, useCallback } from 'react';
import { extractDistrictProvince } from '@/utils/addressExtraction';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { useMultiProcessingGuard } from '@/hooks/useProcessingGuard';
import { useBankCheck } from '@/hooks/useBankCheck';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import { useNewJobPolling } from '@/hooks/useNewJobPolling';

import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { RejectFactoryJobDialog } from '@/components/home/RejectFactoryJobDialog';
import AccidentEvidenceModal from '@/components/job/AccidentEvidenceModal';
import { preloadablePages } from '@/App';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { HomeTour } from '@/components/onboarding/HomeTour';
import { canHandleJobTruckType } from '@/utils/truckTypeHierarchy';
import { deduplicateJobs } from '@/utils/jobDeduplication';
import { getAccidentEvidenceInfo } from '@/utils/accidentEvidence';
import { 
  getDriverAssignedJobs, 
  getFactoryAssignedJobs, 
  getFreelanceAcceptedJobs,
  getExpressRentPosts,
  acceptExpressRentJob,
  logout as externalLogout,
} from '@/lib/externalApi';
interface Job {
  id: string;
  post_id?: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  transport_type_label?: string;
  transport_mode?: string | null;
  transport_category?: string | null;
  origin_location: string;
  destination_location: string;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  pickup_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  goods_weight?: number | null;
  goods_unit?: string | null;
  goods_quantity_unit?: string | null;
  remarks?: string | null;
  invoice_number?: string | null;
  isAccepted?: boolean;
  status?: string;
  bl_no?: string | null;
  booking_no?: string | null;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  destinations?: Array<{ sequence: number; location: string; company_name?: string; latitude?: number; longitude?: number; address?: string; contact_name?: string; invoice_number?: string; province?: string }>;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setAuthTransitioning, userType } = useAuth();
  const { t } = useLanguage();
  const { role, isInternalDriver, isExternalDriver, isFreelanceDriver } = useUserRole();
  const { vehiclePhoto } = useVehiclePhoto();
  
  // Global processing guard for all job actions
  const { isProcessingKey, withGuard: withJobGuard } = useMultiProcessingGuard();
  const { requireBankInfo } = useBankCheck();

// Helper: filter out numeric-only or very short code values from name fields
const isValidName = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim();
  const invalidNames = ['-', 'ไม่ระบุ', 'ไม่มีข้อมูล', 'n/a', 'na', 'null', 'undefined'];
  if (!s || invalidNames.includes(s.toLowerCase()) || /^\d+$/.test(s) || s.length <= 2) return '';
  return s;
};

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [openJobOrderCode, setOpenJobOrderCode] = useState<string | null>(null);
  const [accidentOrderInfo, setAccidentOrderInfo] = useState<{ id?: string; order_number?: string } | null>(null);
  const [accidentStartJob, setAccidentStartJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Category filter (multi-select). Empty = show all categories.
  type CategoryKey = 'bl' | 'booking' | 'multi' | 'single';
  const [categoryFilters, setCategoryFilters] = useState<Set<CategoryKey>>(new Set());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const toggleCategoryFilter = (key: CategoryKey) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearCategoryFilters = () => setCategoryFilters(new Set());
  // Set default filter based on user type from AuthContext (more reliable than hooks)
  // Internal/External drivers should see factory jobs by default (their assigned jobs)
  const getDefaultFilter = (): 'all' | 'company' | 'factory' => {
    if (userType === 'internal_driver' || userType === 'external_driver') return 'factory';
    return 'company'; // default for freelance_driver
  };
  const [jobFilter, setJobFilter] = useState<'all' | 'company' | 'factory'>(getDefaultFilter());
  
  // Update filter when userType changes (e.g., after login)
  useEffect(() => {
    if (userType === 'internal_driver' || userType === 'external_driver') {
      setJobFilter('factory');
    }
  }, [userType]);

  // State for factory jobs
  const [factoryJobs, setFactoryJobs] = useState<Job[]>([]);
  const [isLoadingFactoryJobs, setIsLoadingFactoryJobs] = useState(false);
  
  // State for factory job actions
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedFactoryJob, setSelectedFactoryJob] = useState<Job | null>(null);
  const [isFactoryJobProcessing, setIsFactoryJobProcessing] = useState(false);
  
  // Track processed order codes to prevent duplicates
  const [processedOrderCodes, setProcessedOrderCodes] = useState<Set<string>>(new Set());
  
  // Pagination
  const JOBS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  
  // GPS Tracking hook
  const { startTracking } = useGpsTracking();
  
  // Poll for new jobs and create notifications
  useNewJobPolling();

  const parseJobDateTime = (job: Job): number => {
    const dateValue = (job.start_date || '').trim();
    if (!dateValue) return 0;

    const timeValue = (job.pickup_time || '00:00:00').trim();
    const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return new Date(`${dateValue}T${normalizedTime}`).getTime();
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
      const [day, month, year] = dateValue.split('/');
      return new Date(`${year}-${month}-${day}T${normalizedTime}`).getTime();
    }

    const parsed = new Date(dateValue).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortJobsByDateDesc = (jobList: Job[]) =>
    [...jobList].sort((a, b) => parseJobDateTime(b) - parseJobDateTime(a));

  // Get displayed jobs based on filter
  const getDisplayedJobs = () => {
    // Filter out international jobs without any international reference (booking_no, bl_no, or transport_mode)
    const filterInternationalWithoutRef = (jobList: Job[]) =>
      jobList.filter(job => {
        const isInternational = job.job_type === 'international' ||
          (!!(job as any).transport_category && (job as any).transport_category !== 'domestic');
        // Allow international jobs that have transport_mode (sea/air) even without booking/bl
        if (isInternational && !job.booking_no && !job.bl_no && !(job as any).transport_mode) return false;
        return true;
      });

    // Apply free-text search across common identifiers (BL/Booking/Order/Origin/Destination/Employer/Goods)
    // Splits the query into tokens so "BL YMJAN710625124" still matches a job whose bl_no is "YMJAN710625124".
    const applySearch = (jobList: Job[]) => {
      const raw = searchQuery.trim().toLowerCase();
      if (!raw) return jobList;
      // Strip common prefixes/labels like "bl", "bl:", "booking", "booking#", "order", "no", "no.", "#"
      const noiseWords = new Set(['bl', 'booking', 'order', 'no', 'no.', '#', 'ref', 'เลข']);
      const tokens = raw
        .split(/[\s,;:#\/]+/)
        .map((t) => t.replace(/^[#:]+|[#:]+$/g, ''))
        .filter((t) => t.length > 0 && !noiseWords.has(t));
      // If the query was only label words, fall back to substring match on the raw string
      const effectiveTokens = tokens.length > 0 ? tokens : [raw];

      return jobList.filter((job: any) => {
        const haystack = [
          job.order_code,
          job.bl_no,
          job.booking_no,
          job.employer_name,
          job.destination_company_name,
          job.origin_location,
          job.destination_location,
          job.goods_type,
          job.transport_type,
          job.transport_type_label,
          job.equipment_list,
          job.shipper,
          job.consignee,
        ]
          .filter((f) => typeof f === 'string')
          .join(' ')
          .toLowerCase();

        // Every token must appear somewhere in the haystack
        return effectiveTokens.every((t) => haystack.includes(t));
      });
    };

    // Apply category filter (BL / Booking / Multi-destination / Single-destination)
    // Multi-select: a job passes if it matches ANY selected category. Empty set = pass-through.
    const applyCategoryFilter = (jobList: Job[]) => {
      if (categoryFilters.size === 0) return jobList;
      return jobList.filter((job: any) => {
        const destCount = Array.isArray(job.destinations) ? job.destinations.length : 0;
        const isMulti = destCount > 1;
        const isSingle = destCount <= 1;
        const hasBl = !!(job.bl_no || job.bl_number || job.bill_of_lading);
        const hasBooking = !!(job.booking_no || job.booking_number);
        if (categoryFilters.has('bl') && hasBl) return true;
        if (categoryFilters.has('booking') && hasBooking) return true;
        if (categoryFilters.has('multi') && isMulti) return true;
        if (categoryFilters.has('single') && isSingle) return true;
        return false;
      });
    };

    const pipeline = (jobList: Job[]) =>
      sortJobsByDateDesc(applyCategoryFilter(applySearch(filterInternationalWithoutRef(jobList))));

    // Internal/External drivers ONLY see their assigned factory jobs
    if (userType === 'internal_driver' || userType === 'external_driver') {
      return pipeline(factoryJobs);
    }

    if (jobFilter === 'factory') {
      return pipeline(factoryJobs);
    }

    // 'all' and 'company' both show company jobs (current API)
    return pipeline(jobs);
  };

  const displayedJobs = getDisplayedJobs();
  const totalPages = Math.ceil(displayedJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = displayedJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);
  
  // Reset page when filter or jobs change
  useEffect(() => {
    setCurrentPage(1);
  }, [jobFilter, jobs.length, factoryJobs.length, searchQuery, categoryFilters]);

  // Load factory/driver assigned jobs from API
  // For internal/external drivers from factory company, use get-driver-assigned-jobs
  // For freelance drivers, use get-factory-assigned-jobs
  const loadFactoryJobs = async (silent = false) => {
    if (!user?.id) return;
    
    if (!silent) setIsLoadingFactoryJobs(true);
    try {
      let result: any;
      
      // Determine which API to call based on user type - using external API directly
      if (isInternalDriver || isExternalDriver) {
        // Internal/External drivers use get-driver-assigned-jobs API
        // Single API call with comma-separated statuses, then filter client-side
        const driverType = isInternalDriver ? 'internal' : 'external';
        const statuses = ['in_progress', 'awaiting_response'].join(',');
        const res = await getDriverAssignedJobs(user.id, driverType, 50, statuses);

        if (res.error) {
          console.error('Error loading factory/driver jobs:', res.error);
          setIsLoadingFactoryJobs(false);
          return;
        }

        const allJobs = ((res.data as any)?.data || []) as any[];

        const uniqueJobs = allJobs.filter((item: any, index: number, arr: any[]) => {
          const itemKey = item?.id || item?.order_number;
          return arr.findIndex((j: any) => (j?.id || j?.order_number) === itemKey) === index;
        });

        result = { data: uniqueJobs };
      } else {
        // Freelance drivers use get-factory-assigned-jobs API
        const { data, error } = await getFactoryAssignedJobs(user.id, 10);
        
        if (error) {
          console.error('Error loading factory/driver jobs:', error);
          setIsLoadingFactoryJobs(false);
          return;
        }
        result = data;
      }

      console.log('Loaded factory/driver jobs from API:', result, 'userType:', userType);

      // Transform API response to Job format
      // For Internal/External drivers: Show ALL assigned jobs (so driver can decide to start or not)
      // Jobs will be hidden from Home only after driver explicitly starts them via "เริ่มงาน" button
      // For Freelance drivers: Only show jobs awaiting_response
      const apiJobs = (result?.data || []).filter((item: any) => {
        const status = (item?.status || '').toLowerCase().trim();
        if (isInternalDriver || isExternalDriver) {
          // Internal/External drivers see jobs with 'in_progress' or 'awaiting_response' status
          // Jobs with 'in_transit' status are shown in Current Jobs page
          return status === 'in_progress' || status === 'awaiting_response';
        }
        // Freelance drivers only see jobs awaiting their response
        // Also filter out jobs without factory_id - those are company jobs, not factory jobs
        if (!item.factory_id) return false;
        return status === 'awaiting_response';
      });
      

      const transformedJobs: Job[] = apiJobs.map((item: any) => {
        // Determine if international
        const isIntl = !!(item.booking_no || item.booking_number || item.bl_no || item.bl_number || item.bill_of_lading) || item.transport_category === 'international' || item.job_type === 'international' || (item.transport_mode && ['sea', 'air'].includes((item.transport_mode || '').toLowerCase()));
        
        // Build origin/destination - use different sources for international vs domestic
        let originLocation: string;
        let destinationLocation: string;
        
        if (isIntl) {
          const intl = item.international_details || {};
          const originObj = item.origin || intl.origin || {};
          const returnObj = item.return_terminal || intl.return_terminal || {};
          // Origin = จุดรับตู้เปล่า ใช้ origin.name เท่านั้น
          originLocation = originObj.name || '';
          // Destination = จุดคืนตู้ ใช้ return_terminal.location หรือ name เท่านั้น
          destinationLocation = returnObj.location || returnObj.name || '';
        } else {
          // Domestic single-trip: use origin.name and destination.name only (no fallback)
          const hasMultipleDest = Array.isArray(item.destinations) && item.destinations.length > 0;
          const originObjDom = (item.origin && typeof item.origin === 'object') ? item.origin : null;
          const destObjDom = (item.destination && typeof item.destination === 'object') ? item.destination : null;
          if (!hasMultipleDest) {
            originLocation = originObjDom?.name || '';
            destinationLocation = destObjDom?.name || '';
          } else {
            // Multi-destination: keep existing origin logic
            const originCompany = (Array.isArray(item.origins) && item.origins.length > 0 ? item.origins[0].company_name : '') || (originObjDom?.name) || item.sender_name || item.sender_company_name || '';
            const originDistrict = (Array.isArray(item.origins) && item.origins.length > 0
              ? [item.origins[0].district, item.origins[0].province].filter(Boolean).join(', ')
              : '') ||
              (originObjDom ? [originObjDom.district, originObjDom.province].filter(Boolean).join(', ') : '') ||
              (typeof item.origin === 'string' ? item.origin : '') ||
              [item.sender_district, item.sender_province].filter(Boolean).join(', ') ||
              item.from_location || '';
            originLocation = [originCompany, originDistrict].filter(Boolean).join('\n');
            destinationLocation = '';
          }
        }

        
        return {
           id: item.id || String(Math.random()),
           post_id: item.id || item.post_id || '',
           order_code: item.order_number || item.order_code || item.quote_number || '',
           job_type: (item.booking_no || item.booking_number || item.bl_no || item.bill_of_lading || item.bl_number || item.job_type === 'international' || item.transport_category === 'international' || (item.transport_mode && ['sea', 'air'].includes((item.transport_mode || '').toLowerCase()))) ? 'international' : (item.job_type || item.shipment_type || 'domestic'),
          employer_name: isIntl
            ? (isValidName(item.assigned_company) || isValidName(item.assignedCompany) || '')
            : (isValidName(item.assigned_company) || isValidName(item.assignedCompany) || isValidName(item.factory_name) || isValidName(item.customer_name) || isValidName(item.sender_company_name) || isValidName(item.sender_name) || isValidName(item.company_name) || isValidName(user?.company_name) || ''),

          transport_type: item.transport_mode || item.send_mode || 'single',
          transport_type_label: item.transport_type_label || item.send_mode_label || '',
          transport_mode: item.transport_mode || null,
          transport_category: item.transport_category || null,
          origin_location: originLocation,
          destination_location: destinationLocation,
          destination_company_name: isIntl ? null : (isValidName(item.destination_company_name) || isValidName(item.destination_name) || null),
          price: item.transport_price || item.price || 0,
          start_date: item.sender_pickup_date || item.pickup_date || item.start_date || '',
          pickup_time: item.sender_pickup_time || item.pickup_time || item.start_time || '',
          equipment_list: item.vehicle_type || item.truck_type || null,
          safety_equipment: Array.isArray(item.truck_requirements) ? item.truck_requirements.join(', ') : (item.truck_requirements || null),
          goods_type: item.product_name || item.goods_type || null,
          goods_quantity: item.product_quantity ? String(item.product_quantity) : (item.goods_quantity || null),
          goods_weight: item.product_weight || null,
          goods_unit: (Array.isArray(item.products) && item.products[0]?.weight_unit) || item.product_weight_unit || null,
          goods_quantity_unit: (Array.isArray(item.products) && item.products[0]?.unit) || item.product_unit || null,
          isAccepted: false,
          status: item.status || null,
          bl_no: item.bl_no || item.bill_of_lading || item.bl_number || null,
          booking_no: item.booking_no || item.booking_number || null,
          invoice_number: item.invoice_number || item.inv_no || item.inv || null,
          remarks: item.remark || item.remarks || item.note || null,
          origin_lat: item.sender_latitude || item.origin_lat || undefined,
          origin_lng: item.sender_longitude || item.origin_lng || undefined,
          destination_lat: item.destination_latitude || item.destination_lat || undefined,
          destination_lng: item.destination_longitude || item.destination_lng || undefined,
          destinations: Array.isArray(item.destinations) ? item.destinations.map((d: any, idx: number) => ({
            sequence: d.sequence_number || d.sequence || idx + 1,
            location: d.province || d.address || d.location || d.destination_location || '',
            address: d.address || '',
            company_name: d.company_name || '',
            contact_name: d.contact_name || d.contact_person || '',
            invoice_number: d.invoice_number || d.inv_no || d.inv || '',
            province: d.province || '',
            latitude: d.latitude || d.destination_latitude || undefined,
            longitude: d.longitude || d.destination_longitude || undefined,
          })) : undefined
        };
      });

      setFactoryJobs(transformedJobs);
    } catch (err) {
      console.error('Error fetching factory/driver jobs:', err);
    } finally {
      setIsLoadingFactoryJobs(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    console.log('🔄 Loading jobs with userType:', userType);

    const refreshJobs = (silent = false) => {
      if (userType === 'internal_driver' || userType === 'external_driver') {
        loadFactoryJobs(silent);
      } else if (userType === 'freelance_driver') {
        loadJobs();
        loadFactoryJobs(silent);
      }
    };

    // Initial load
    refreshJobs(false);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastActivityAt = Date.now();

    const getInterval = () => {
      if (typeof document !== 'undefined' && document.hidden) return 0;
      if (Date.now() - lastActivityAt > 5 * 60_000) return 0;
      const hasActive = (factoryJobs?.length || 0) > 0 || (jobs?.length || 0) > 0;
      return hasActive ? 60_000 : 180_000;
    };

    const schedule = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const delay = getInterval();
      if (delay <= 0) return;
      timeoutId = setTimeout(async () => {
        await Promise.resolve(refreshJobs(true));
        schedule();
      }, delay);
    };

    const onActivity = () => { lastActivityAt = Date.now(); };
    const onVisibility = () => {
      if (!document.hidden) {
        lastActivityAt = Date.now();
        refreshJobs(true);
        schedule();
      } else if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, userType]);

  // Preload pages users are likely to navigate to from "งานสำหรับคุณ" section
  useEffect(() => {
    if (!user) return;
    const idle = (cb: () => void) => {
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 800);
      }
    };
    idle(() => {
      preloadablePages.JobDetailPage.preload?.();
      preloadablePages.CurrentJobsPage.preload?.();
      preloadablePages.PickupDetailPage.preload?.();
    });
  }, [user]);

  // Handle openJobOrderCode from notifications navigation (state or query string)
  useEffect(() => {
    const orderCodeFromState = location.state?.openJobOrderCode as string | undefined;
    const orderCodeFromQuery = new URLSearchParams(location.search).get('openJobOrderCode') || undefined;

    const orderCode = orderCodeFromState || orderCodeFromQuery;

    if (orderCode) {
      setOpenJobOrderCode(orderCode);

      // Clear navigation state/query to prevent reopening on refresh
      if (orderCodeFromState) {
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.pathname, location.search, location.state, navigate]);

  // Subscribe to jobs table changes for real-time updates
  useEffect(() => {
    if (user) {
      const jobsChannel = supabase
        .channel('jobs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs'
          },
          () => {
            loadJobs();
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(jobsChannel);
      };
    }
  }, [user]);
  const loadJobs = async () => {
    try {
      // Fetch from external API directly
      const { data: responseData, error } = await getExpressRentPosts();
      
      if (error) {
        console.error('Error loading jobs from API:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive'
        });
        return;
      }

      console.log('Loaded jobs from API:', responseData);
      
      // Transform API response to Job format
      const apiJobs = Array.isArray(responseData) ? responseData : ((responseData as any)?.data || []);
      
      // Filter by is_express_rent based on user type
      // internal_driver & external_driver: show is_express_rent = false (งานปกติ)
      // freelance_driver: show is_express_rent = true (งานด่วน)
      const isExpressRentFilter = isInternalDriver || isExternalDriver ? false : true;
      
      const transformedJobs: Job[] = apiJobs
        .filter((item: any) => item.is_express_rent === isExpressRentFilter)
        .filter((item: any) => {
          // Only show posts that are still open (not assigned to another driver)
          const status = (item.status || '').toLowerCase();
          if (status && status !== 'open') return false;
          
          // Filter out expired express rent posts
          if (item.express_rent_expiry) {
            const expiry = new Date(item.express_rent_expiry);
            if (expiry < new Date()) return false;
          }
          
          return true;
        })
        .map((item: any) => {
        const hasMultipleDest = Array.isArray(item.destinations) && item.destinations.length > 0;
        const originObjPost = (item.origin && typeof item.origin === 'object') ? item.origin : null;
        const destObjPost = (item.destination && typeof item.destination === 'object') ? item.destination : null;
        let originLocation = '';
        let destinationLocation = '';

        // International job override: use empty pickup depot / container return location
        const isIntlPost = !!(item.booking_no || item.booking_number || item.bl_no || item.bill_of_lading || item.bl_number) || item.job_type === 'international' || item.transport_category === 'international';
        if (isIntlPost) {
          const intl2 = item.international_details || {};
          const originObj2 = item.origin || intl2.origin || {};
          const returnObj2 = item.return_terminal || intl2.return_terminal || {};
          originLocation = originObj2.name || '';
          destinationLocation = returnObj2.location || returnObj2.name || '';
        } else if (!hasMultipleDest) {
          // Domestic single-trip: use origin.name and destination.name only (no fallback)
          originLocation = originObjPost?.name || (typeof item.origin === 'string' ? item.origin : '') || '';
          destinationLocation = destObjPost?.name || (typeof item.destination === 'string' ? item.destination : '') || '';
        } else {
          // Multi-destination domestic: keep prior fallback behavior for origin
          originLocation = (typeof item.origin === 'string' ? item.origin : '') || originObjPost?.name || item.from_location || '';
          const originCompany = item.sender_name || item.sender_company_name || item.company_name || item.factory_name || '';
          if (originCompany && originLocation && originLocation !== '-') {
            originLocation = [originCompany, originLocation].filter(Boolean).join('\n');
          } else if (originCompany && (!originLocation || originLocation === '-')) {
            originLocation = originCompany;
          }
        }

        
        // Extract order code from title (format: "โพสต์หารถด่วน - OR20251203002")
        let orderCode = item.post_code || item.order_number || item.quote_number || '';
        if (item.title && item.title.includes(' - ')) {
          const titleParts = item.title.split(' - ');
          if (titleParts.length >= 2) {
            orderCode = titleParts[titleParts.length - 1].trim();
          }
        }
        
        return {
          id: item.id || String(Math.random()),
          post_id: item.id || item.post_id || '',
          order_code: orderCode,
          job_type: (item.booking_no || item.booking_number || item.bl_no || item.bill_of_lading || item.bl_number || item.job_type === 'international' || item.transport_category === 'international' || (item.transport_mode && ['sea', 'air'].includes((item.transport_mode || '').toLowerCase()))) ? 'international' : (item.job_type || item.post_type || item.shipment_type || item.product_type || 'domestic'),
          employer_name: isIntlPost
            ? (isValidName(item.assigned_company) || isValidName(item.assignedCompany) || '')
            : (isValidName(item.factory_name) || isValidName(item.customer_name) || isValidName(item.sender_company_name) || isValidName(item.sender_name) || isValidName(item.company_name) || isValidName(user?.company_name) || ''),
          transport_type: item.send_mode || 'single',
          transport_type_label: item.transport_type_label || item.send_mode_label || '',
          origin_location: originLocation,
          destination_location: destinationLocation,
          destination_company_name: isIntlPost ? null : (isValidName(item.destination_company_name) || isValidName(item.destination_name) || isValidName(item.receiver_name) || isValidName(item.receiver_company_name) || null),
          price: item.price || 0,
          start_date: item.pickup_date || item.start_date || item.period_start || '',
          pickup_time: item.pickup_time || item.start_time || '',
          equipment_list: item.truck_type !== '-' ? item.truck_type : null,
          safety_equipment: Array.isArray(item.truck_requirements) ? item.truck_requirements.join(', ') : (item.truck_requirements || null),
          goods_type: Array.isArray(item.products) && item.products.length > 0
            ? item.products.map((p: any) => p.product_name).filter(Boolean).join(', ')
            : (item.product_name || item.goods_type || item.product_type || null),
          goods_quantity: Array.isArray(item.products) && item.products.length > 0
            ? String(item.products.reduce((sum: number, p: any) => sum + (p.quantity || 0), 0))
            : (item.product_quantity ? String(item.product_quantity) : (item.goods_quantity || item.quantity || null)),
          goods_weight: Array.isArray(item.products) && item.products.length > 0
            ? item.products.reduce((sum: number, p: any) => sum + (p.weight || 0), 0)
            : (item.product_weight || null),
          goods_unit: (Array.isArray(item.products) && item.products[0]?.weight_unit) || item.product_weight_unit || null,
          goods_quantity_unit: (Array.isArray(item.products) && item.products[0]?.unit) || item.product_unit || null,
          isAccepted: false,
          bl_no: item.bl_no || item.bill_of_lading || item.bl_number || null,
          booking_no: item.booking_no || item.booking_number || null,
          invoice_number: item.invoice_number || item.inv_no || item.inv || null,
          remarks: item.remark || item.remarks || item.note || null,
          // Map coordinates from API
          origin_lat: item.origin_lat || undefined,
          origin_lng: item.origin_lng || undefined,
          destination_lat: item.destination_lat || undefined,
          destination_lng: item.destination_lng || undefined,
          destinations: Array.isArray(item.destinations) ? item.destinations.map((d: any, idx: number) => ({
            sequence: d.sequence_number || d.sequence || idx + 1,
            location: d.province || d.address || d.location || d.destination_location || '',
            address: d.address || '',
            company_name: d.company_name || '',
            contact_name: d.contact_name || d.contact_person || '',
            invoice_number: d.invoice_number || d.inv_no || d.inv || '',
            province: d.province || '',
            latitude: d.latitude || d.destination_latitude || undefined,
            longitude: d.longitude || d.destination_longitude || undefined,
          })) : undefined
        };
      });

      // Check which jobs the user has accepted
      if (user && transformedJobs.length > 0) {
        // Fetch accepted jobs from external API directly
        let acceptedOrderNumbers = new Set<string>();
        try {
          const { data: acceptedResult, error: acceptedError } = await getFreelanceAcceptedJobs(user.id);
          
          if (!acceptedError && acceptedResult) {
            const acceptedData = (acceptedResult as any)?.data || acceptedResult;
            if (Array.isArray(acceptedData)) {
              acceptedOrderNumbers = new Set(
                acceptedData.map((job: any) => job.order_number)
              );
            }
          }
        } catch (err) {
          console.error('Error fetching accepted jobs:', err);
        }

        // Also check local job_applications table
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id, payment_completed_at')
          .eq('driver_id', user.id);
        
        const completedJobIds = new Set(
          applications?.filter(app => app.payment_completed_at).map(app => app.job_id) || []
        );
        const acceptedJobIds = new Set(applications?.map(app => app.job_id) || []);
        
        // Filter out jobs with past pickup date/time
        const now = new Date();
        const filterPastJobs = (jobList: Job[]) => {
          return jobList.filter(job => {
            if (!job.start_date) return true; // Keep jobs without date
            
            // Combine date and time to create full datetime
            const time = job.pickup_time || '23:59:59';
            const normalizedTime = time.length === 5 ? `${time}:00` : time;
            const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
            return pickupDateTime >= now;
          });
        };

        // Get driver's vehicle type for filtering
        const driverVehicleType = user.vehicle_type || '';
        console.log('🚛 Driver vehicle type:', driverVehicleType);
        
        // Filter out: completed jobs, accepted via external API, past jobs, and jobs requiring bigger trucks
        const availableJobs = filterPastJobs(transformedJobs)
          .filter(job => !completedJobIds.has(job.id))
          .filter(job => !acceptedOrderNumbers.has(job.order_code)) // Filter by order_code from external API
          .filter(job => {
            const canHandle = canHandleJobTruckType(driverVehicleType, job.equipment_list);
            console.log(`🚛 Job ${job.order_code} requires: ${job.equipment_list}, driver has: ${driverVehicleType}, can handle: ${canHandle}`);
            return canHandle;
          })
          .map(job => ({
            ...job,
            isAccepted: acceptedJobIds.has(job.id)
          }));
        
        setJobs(availableJobs);
      } else {
        // Filter out jobs with past pickup date/time for non-logged in users too
        const now = new Date();
        const filteredJobs = transformedJobs.filter(job => {
          if (!job.start_date) return true;
          const time = job.pickup_time || '23:59:59';
          const normalizedTime = time.length === 5 ? `${time}:00` : time;
          const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
          return pickupDateTime >= now;
        });
        setJobs(filteredJobs);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    }
  };
  const handleAcceptJob = (job: Job) => {
    if (!requireBankInfo()) return;
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };
  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user || isAccepting) return;
    
    setIsAccepting(true);
    
    try {
      // Get driver name from user object
      const driverName = user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.full_name || user.name || '';
      
      // Get driver phone from user object
      const driverPhone = user.phone_number || user.phone || '';
      
      // Get vehicle info from user object (from login API)
      const province = (user.plate_province || '').trim();
      const number = (user.plate_number || '').trim();
      const licensePlate = [province, number].filter(Boolean).join(' ').trim();
      const vehicleType = (user.vehicle_type || '').trim();
      const vehicleBrand = (user.vehicle_brand || '').trim();
      
      console.log('Vehicle data from user:', { licensePlate, vehicleType, vehicleBrand });

      // Call accept job API directly
      console.log('[Home] Accepting express rent job:', {
        order_number: selectedJob.order_code,
        post_id: selectedJob.post_id || selectedJob.id,
        freelance_driver_id: user.id,
      });

      const { data: result, error } = await acceptExpressRentJob({
        order_number: selectedJob.order_code,
        post_id: selectedJob.post_id || selectedJob.id,
        freelance_driver_id: user.id,
        freelance_driver_name: driverName,
        driver_phone: driverPhone,
        license_plate: licensePlate,
        vehicle_type: vehicleType,
        vehicle_brand: vehicleBrand
      });

      console.log('[Home] Accept job result:', result, 'error:', error);

      if (error || !result?.success) {
        toast({
          title: t('home.error_load'),
          description: error || t('home.error_accept'),
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('home.accept_success'),
        description: `${t('home.accept_success_desc')} ${selectedJob.order_code}`
      });

      // Create tracking room after successful job acceptance
      try {
        // Get actual GPS position for current_lat/current_lng
        let currentLat = selectedJob.origin_lat || 0;
        let currentLng = selectedJob.origin_lng || 0;
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
          console.log('📍 [Freelance] Got GPS position:', currentLat, currentLng);
        } catch (gpsError) {
          console.warn('[Freelance] Could not get GPS position, using origin as fallback:', gpsError);
        }

        // Build waypoints from destinations for multi-destination jobs
        const waypoints = selectedJob.destinations && selectedJob.destinations.length > 1
          ? selectedJob.destinations
              .filter((d: any) => d.latitude && d.longitude)
              .map((d: any) => ({ lat: d.latitude, lng: d.longitude }))
          : undefined;

        const trackingBody: any = {
          truck_plate: licensePlate,
          order_code: selectedJob.order_code,
          origin_lat: selectedJob.origin_lat || 0,
          origin_lng: selectedJob.origin_lng || 0,
          destination_lat: selectedJob.destination_lat || 0,
          destination_lng: selectedJob.destination_lng || 0,
          current_lat: currentLat,
          current_lng: currentLng,
        };
        if (waypoints && waypoints.length > 0) {
          trackingBody.waypoints = waypoints;
        }
        console.log('📍 create-tracking-room body:', JSON.stringify(trackingBody, null, 2));
        
        const trackingResponse = await supabase.functions.invoke('create-tracking-room', {
          body: trackingBody
        });

        if (trackingResponse.error) {
          console.error('Error creating tracking room:', trackingResponse.error);
        } else {
          console.log('Tracking room created:', trackingResponse.data);
          // Save room_code to localStorage for later use (check-in, tracking)
          if (trackingResponse.data?.room?.room_code) {
            localStorage.setItem(`room_code_${selectedJob.order_code}`, trackingResponse.data.room.room_code);
            console.log('Saved room_code:', trackingResponse.data.room.room_code);
          }
        }
      } catch (trackingError) {
        console.error('Error creating tracking room:', trackingError);
      }

      setConfirmDialogOpen(false);
      setIsAccepting(false);
      loadJobs();
    } catch (err) {
      console.error('Error accepting job:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
      setIsAccepting(false);
    }
  };

  // Handle starting an assigned job (Internal/External drivers)
  // These drivers already have the job assigned - update status to in_transit via API
  const handleStartAssignedJob = async (job: Job) => {
    if (!user) return;
    
    const orderCode = job.order_code;
    
    // Check if this order is already being processed
    if (isProcessingKey(`start-job-${orderCode}`)) {
      console.log(`[Home] Job ${orderCode} is already being processed, skipping`);
      return;
    }
    
    // Check if already started (in processedOrderCodes)
    if (processedOrderCodes.has(orderCode)) {
      console.log(`[Home] Job ${orderCode} already started, skipping`);
      toast({
        title: t('home.duplicate_order') || 'งานซ้ำ',
        description: t('home.order_already_processed') || 'งานนี้ถูกดำเนินการแล้ว',
        variant: 'destructive'
      });
      return;
    }
    
    // Use processing guard to prevent double-clicks
    await withJobGuard(`start-job-${orderCode}`, async () => {
      try {
        console.log(`[Home] ===== START JOB WORKFLOW STARTED =====`);
        console.log(`[Home] Order Code: ${orderCode}, Job ID: ${job.id}`);
        console.log(`[Home] User Type: ${userType}, User ID: ${user.id}`);
        
        // Determine driver type for the API call
        const driverType = userType === 'internal_driver' ? 'internal' : 'external';
        
        // Determine status based on job type: BL/Booking jobs send 'accepted', others send 'in_transit'
        const isInternationalJob = !!(job.bl_no || job.booking_no);
        const orderStatus = isInternationalJob ? 'accepted' : 'in_transit';
        
        // Update the order status via the external API
        console.log(`[Home] Calling update-order-status API with status: '${orderStatus}' (isInternational: ${isInternationalJob})`);
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-order-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
            },
            body: JSON.stringify({
              order_id: job.id,
              order_number: job.order_code,
              status: orderStatus,
              driver_id: user.id,
              driver_type: driverType,
            }),
          }
        );
        
        const result = await response.json();
        console.log('[Home] Update order status result:', result);
        console.log(`[Home] API Response status: ${response.status}, OK: ${response.ok}`);
        
        if (!response.ok) {
          console.error(`[Home] API failed with status ${response.status}, error:`, result);
          const accidentInfo = getAccidentEvidenceInfo(result, job);
          if (accidentInfo) {
            setAccidentStartJob(job);
            setAccidentOrderInfo(accidentInfo);
            return;
          }
          throw new Error(result.error || 'Failed to update status');
        }
        
        console.log(`[Home] ✅ Status updated to '${orderStatus}' successfully`);
        
        // Mark as processed to prevent future duplicate submissions
        setProcessedOrderCodes(prev => new Set([...prev, orderCode]));
        
        // Show success toast immediately
        const titleKey = t('home.start_job_success');
        const descKey = t('home.start_job_success_desc');
        toast({
          title: titleKey !== 'home.start_job_success' ? titleKey : 'เริ่มงานสำเร็จ',
          description: `${descKey !== 'home.start_job_success_desc' ? descKey : 'คุณได้เริ่มงาน'} ${job.order_code}`
        });
        
        // Remove job from Home list instantly
        setFactoryJobs(prev => prev.filter(j => j.id !== job.id));
        
        // Redirect to Current Jobs page immediately, marking the just-started job
        navigate('/current-jobs', { state: { justStartedOrder: job.order_code } });
        
        // Create tracking room in background (don't block UI)
        (async () => {
          try {
            const province = (user.plate_province || '').trim();
            const number = (user.plate_number || '').trim();
            const licensePlate = [province, number].filter(Boolean).join(' ').trim();
            
            let currentLat = job.origin_lat || 0;
            let currentLng = job.origin_lng || 0;
            try {
              const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 5000,
                  maximumAge: 60000
                });
              });
              currentLat = position.coords.latitude;
              currentLng = position.coords.longitude;
            } catch (gpsError) {
              console.warn('[Staff] GPS fallback to origin:', gpsError);
            }
            
            const waypoints = job.destinations && job.destinations.length > 1
              ? job.destinations
                  .filter((d: any) => d.latitude && d.longitude)
                  .map((d: any) => ({ lat: d.latitude, lng: d.longitude }))
              : undefined;

            const trackingBody: any = {
              truck_plate: licensePlate,
              order_code: job.order_code,
              origin_lat: job.origin_lat || 0,
              origin_lng: job.origin_lng || 0,
              destination_lat: job.destination_lat || 0,
              destination_lng: job.destination_lng || 0,
              current_lat: currentLat,
              current_lng: currentLng
            };
            if (waypoints && waypoints.length > 0) {
              trackingBody.waypoints = waypoints;
            }
            
            const trackingResponse = await supabase.functions.invoke('create-tracking-room', {
              body: trackingBody
            });

            if (!trackingResponse.error && trackingResponse.data?.room?.room_code) {
              const roomCode = trackingResponse.data.room.room_code;
              localStorage.setItem(`room_code_${job.order_code}`, roomCode);
              startTracking(roomCode, job.order_code);
              console.log('[Staff] Tracking started in background:', roomCode);
            }
          } catch (trackingError) {
            console.error('[Staff] Background tracking error:', trackingError);
          }
        })();
        
        console.log(`[Home] ===== START JOB WORKFLOW COMPLETED =====`);
        
      } catch (error) {
        console.error('[Home] Error updating order status:', error);
        console.log(`[Home] ===== START JOB WORKFLOW FAILED =====`);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถเริ่มงานได้ กรุณาลองใหม่อีกครั้ง',
          variant: 'destructive'
        });
      }
    });
  };

  // Handle factory job accept with double-click and duplicate order protection
  const handleAcceptFactoryJob = async (job: Job) => {
    if (!user) return;
    if (!requireBankInfo()) return;
    
    // For Internal/External drivers, jobs are already assigned - just navigate to job detail
    if (userType === 'internal_driver' || userType === 'external_driver') {
      handleStartAssignedJob(job);
      return;
    }
    
    const orderCode = job.order_code;
    
    // Check if this order is already being processed or was already processed
    if (processedOrderCodes.has(orderCode)) {
      console.log(`[Home] Order ${orderCode} already processed, skipping`);
      toast({
        title: t('home.duplicate_order'),
        description: t('home.order_already_processed') || 'งานนี้ถูกดำเนินการแล้ว',
        variant: 'destructive'
      });
      return;
    }
    
    // Use processing guard to prevent double-clicks
    await withJobGuard(`accept-factory-${orderCode}`, async () => {
      setIsFactoryJobProcessing(true);
      
      try {
        const response = await fetch(`https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/respond-factory-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
          body: JSON.stringify({
            order_number: orderCode,
            freelance_driver_id: user.id,
            action: 'accept'
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          toast({
            title: t('home.error_factory_job'),
            description: result.message || t('home.error_accept'),
            variant: 'destructive'
          });
          return;
        }

        // Mark as processed to prevent future duplicate submissions
        setProcessedOrderCodes(prev => new Set([...prev, orderCode]));

        toast({
          title: t('home.accept_factory_success'),
          description: `${t('home.accept_factory_success_desc')} ${orderCode}`
        });

        // Remove accepted job from list immediately
        setFactoryJobs(prevJobs => prevJobs.filter(j => j.order_code !== orderCode));
      } catch (err) {
        console.error('Error accepting factory job:', err);
        toast({
          title: t('home.error_factory_job'),
          description: t('home.error_accept'),
          variant: 'destructive'
        });
      } finally {
        setIsFactoryJobProcessing(false);
      }
    });
  };

  // Handle factory job reject - open dialog
  const handleRejectFactoryJob = (job: Job) => {
    // Check if already processing
    if (isProcessingKey(`reject-factory-${job.order_code}`)) {
      console.log(`[Home] Reject for ${job.order_code} already in progress`);
      return;
    }
    setSelectedFactoryJob(job);
    setRejectDialogOpen(true);
  };

  // Confirm factory job rejection with reason - with double-click protection
  const confirmFactoryJobRejection = async (reason: string) => {
    if (!selectedFactoryJob || !user) return;
    
    const orderCode = selectedFactoryJob.order_code;
    
    // Check if already processed
    if (processedOrderCodes.has(orderCode)) {
      console.log(`[Home] Order ${orderCode} already processed, skipping reject`);
      setRejectDialogOpen(false);
      setSelectedFactoryJob(null);
      return;
    }
    
    await withJobGuard(`reject-factory-${orderCode}`, async () => {
      setIsFactoryJobProcessing(true);
      
      try {
        const response = await fetch(`https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/respond-factory-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
          body: JSON.stringify({
            order_number: orderCode,
            freelance_driver_id: user.id,
            action: 'reject',
            reject_reason: reason
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          toast({
            title: t('home.error_factory_job'),
            description: result.message || t('home.cancel_job'),
            variant: 'destructive'
          });
          return;
        }

        // Mark as processed
        setProcessedOrderCodes(prev => new Set([...prev, orderCode]));

        toast({
          title: t('home.reject_factory_success'),
          description: `${t('home.reject_factory_success_desc')} ${orderCode}`
        });

        setRejectDialogOpen(false);
        setSelectedFactoryJob(null);
        
        // Reload factory jobs
        loadFactoryJobs();
      } catch (err) {
        console.error('Error rejecting factory job:', err);
        toast({
          title: t('home.error_factory_job'),
          description: t('home.cancel_job'),
          variant: 'destructive'
        });
      } finally {
        setIsFactoryJobProcessing(false);
      }
    });
  };
  const handleSignOut = async () => {
    try {
      const driverId = user?.id || localStorage.getItem('auth_driver_id');
      if (driverId) {
        await externalLogout(driverId);
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      logout();
      toast({
        description: t('settings.logoutSuccess') || 'ออกจากระบบสำเร็จ',
        className: '!bg-red-500 !text-white !border-red-500 [&>div]:!text-white',
      });
      navigate('/');
    }
  };
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header + Search wrapped together with rounded corners at bottom */}
      <div className="rounded-b-3xl shadow-lg overflow-hidden lg:rounded-none lg:shadow-none">
        <AppHeader 
          userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username} 
          profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined} 
          onSignOut={handleSignOut} 
          showQuickMenu={true} 
        />

        {/* Search Bar - inside the rounded container */}
        <div className="px-4 py-3 bg-gradient-to-b from-[#E1EBF7] to-[#d6e4f5] lg:px-6 xl:px-8">
          <div className="flex items-center gap-2 max-w-2xl mx-auto lg:max-w-3xl xl:max-w-4xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.search')}
                className="pl-10 pr-10 bg-white shadow-sm border-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-label={t('home.filter') || 'ตัวกรอง'}
              className="relative shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-white shadow-sm text-foreground hover:bg-muted/40 transition-colors"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {categoryFilters.size > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {categoryFilters.size}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content - Responsive container */}
      <PullToRefresh onRefresh={async () => {
        if (userType === 'internal_driver' || userType === 'external_driver') {
          await loadFactoryJobs();
        } else if (userType === 'freelance_driver') {
          await Promise.all([loadJobs(), loadFactoryJobs()]);
        }
      }} className="flex-1 pb-24 lg:pb-8">
        {/* Jobs Section - Centered with max-width on larger screens */}
        <div data-tour="available-jobs" className="px-4 mt-6 sm:px-6 lg:px-8 xl:px-10 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold sm:text-xl lg:text-2xl">
              {userType === 'internal_driver' || userType === 'external_driver' 
                ? t('home.yourJobs') 
                : t('home.recommended')}
            </h2>
            <span className="text-sm text-muted-foreground sm:text-base">
              {displayedJobs.length} {t('home.items')}
              {totalPages > 1 && ` • ${currentPage}/${totalPages}`}
            </span>
          </div>

          {/* Job Filter Buttons - Only show for Freelance Driver */}
          {/* Internal/External drivers don't see filter buttons - they only see their assigned jobs */}
          {userType === 'freelance_driver' && (
            <div className="flex gap-2 mb-4 sm:gap-3 lg:gap-4 max-w-md lg:max-w-lg">
              <Button
                variant={jobFilter === 'company' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setJobFilter(jobFilter === 'company' ? 'all' : 'company')}
                className={`flex-1 sm:text-base lg:h-11 ${jobFilter === 'company' ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {t('home.companyJobs')}
              </Button>
              <Button
                variant={jobFilter === 'factory' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setJobFilter(jobFilter === 'factory' ? 'all' : 'factory')}
                className={`flex-1 sm:text-base lg:h-11 ${jobFilter === 'factory' ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {t('home.factoryJobs')}
              </Button>
            </div>
          )}

          {/* Job Cards - Responsive grid */}
          <div className="card-grid-responsive">
            {isLoadingFactoryJobs && displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-muted-foreground sm:text-lg">
                  {t('common.loading') || 'กำลังโหลด...'}
                </p>
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 sm:w-20 sm:h-20">
                  <Search className="w-8 h-8 text-muted-foreground sm:w-10 sm:h-10" />
                </div>
                <p className="text-muted-foreground sm:text-lg">
                  {jobFilter === 'factory' ? t('home.noFactoryJobs') : t('home.noCompanyJobs')}
                </p>
              </div>
            ) : (
              paginatedJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onAccept={jobFilter === 'factory' || userType === 'internal_driver' || userType === 'external_driver' ? handleAcceptFactoryJob : handleAcceptJob}
                  autoOpenDetail={openJobOrderCode === job.order_code}
                  onDetailClosed={() => setOpenJobOrderCode(null)}
                  showCancelButton={jobFilter === 'factory' && userType !== 'internal_driver'}
                  isFactoryJob={jobFilter === 'factory' || userType === 'internal_driver' || userType === 'external_driver'}
                  onCancel={handleRejectFactoryJob}
                  isProcessing={
                    jobFilter === 'factory' || userType === 'internal_driver' || userType === 'external_driver'
                      ? (isProcessingKey(`accept-factory-${job.order_code}`) || isProcessingKey(`reject-factory-${job.order_code}`))
                      : isAccepting
                  }
                  useStartJobLabel={userType === 'internal_driver' || userType === 'external_driver'}
                />
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 mb-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </PullToRefresh>

      <BottomNavigation />

      {/* Onboarding Tour */}
      <HomeTour />

      <ConfirmJobDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} onConfirm={confirmJobAcceptance} job={selectedJob} isLoading={isAccepting} />
      
      <RejectFactoryJobDialog 
        open={rejectDialogOpen} 
        onOpenChange={setRejectDialogOpen} 
        onConfirm={confirmFactoryJobRejection} 
        orderCode={selectedFactoryJob?.order_code || ''} 
        isLoading={isFactoryJobProcessing} 
      />

      <AccidentEvidenceModal
        open={!!accidentOrderInfo}
        onOpenChange={(open) => {
          if (!open) {
            setAccidentOrderInfo(null);
            setAccidentStartJob(null);
          }
        }}
        orderId={accidentOrderInfo?.id}
        orderNumber={accidentOrderInfo?.order_number}
        onSuccess={() => {
          const jobToStart = accidentStartJob;
          setAccidentOrderInfo(null);
          setAccidentStartJob(null);
          if (jobToStart) void handleStartAssignedJob(jobToStart);
        }}
      />

      {/* Filter Sheet (slides in from the right) */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="right" className="w-[85vw] sm:w-[380px] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t('home.filter') || 'ตัวกรอง'}</SheetTitle>
            <SheetDescription>
              {t('home.filterDescription') || 'เลือกประเภทงานที่ต้องการแสดง'}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-2">
            {([
              { key: 'bl' as CategoryKey, label: t('home.filterBL') || 'งาน BL' },
              { key: 'booking' as CategoryKey, label: t('home.filterBooking') || 'งาน Booking' },
              { key: 'multi' as CategoryKey, label: t('home.filterMulti') || 'งานส่งหลายที่' },
              { key: 'single' as CategoryKey, label: t('home.filterSingle') || 'งานส่งเที่ยวเดียว' },
            ]).map((opt) => {
              const checked = categoryFilters.has(opt.key);
              return (
                <label
                  key={opt.key}
                  htmlFor={`cat-${opt.key}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <Checkbox
                    id={`cat-${opt.key}`}
                    checked={checked}
                    onCheckedChange={() => toggleCategoryFilter(opt.key)}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              );
            })}
          </div>

          <SheetFooter className="flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={clearCategoryFilters}
              disabled={categoryFilters.size === 0}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              {t('home.filterClear') || 'ล้างตัวกรอง'}
            </Button>
            <Button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="flex-1"
            >
              {t('home.filterApply') || 'ใช้ตัวกรอง'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}