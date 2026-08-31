import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { useBankCheck } from '@/hooks/useBankCheck';
import { supabase } from '@/integrations/supabase/client';
import { createTrackingRoom, logClientEvent } from '@/lib/trackingRoomClient';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { canHandleJobTruckType } from '@/utils/truckTypeHierarchy';
import { resolveJobLocations } from '@/lib/jobLocation';
import {
  getExpressRentPosts,
  getFreelanceAcceptedJobs,
  acceptExpressRentJob,
} from '@/lib/externalApi';

interface Job {
  id: string;
  post_id?: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  transport_type_label?: string;
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
  bl_no?: string | null;
  booking_no?: string | null;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  destinations?: Array<{ sequence: number; location: string; company_name?: string; latitude?: number; longitude?: number; address?: string; contact_name?: string; invoice_number?: string; province?: string }>;
}

// Helper: filter out numeric-only or very short code values from name fields
const isValidName = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim();
  const invalidNames = ['-', 'ไม่ระบุ', 'ไม่มีข้อมูล', 'n/a', 'na', 'null', 'undefined'];
  if (!s || invalidNames.includes(s.toLowerCase()) || /^\d+$/.test(s) || s.length <= 2) return '';
  return s;
};

export default function MarketPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { isFreelanceDriver, loading: roleLoading } = useUserRole();
  const { vehiclePhoto } = useVehiclePhoto();
  const { requireBankInfo } = useBankCheck();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const JOBS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // Guard: marketplace is freelance-only
  useEffect(() => {
    if (!roleLoading && !isFreelanceDriver) {
      navigate('/', { replace: true });
    }
  }, [roleLoading, isFreelanceDriver, navigate]);

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const loadJobs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: responseData, error } = await getExpressRentPosts();
      if (error) {
        console.error('[Market] Error loading posts:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive'
        });
        return;
      }

      const apiJobs = Array.isArray(responseData) ? responseData : ((responseData as any)?.data || []);

      // Marketplace = open express rent posts only (same source as Home "งานสำหรับคุณ")
      const transformedJobs: Job[] = apiJobs
        .filter((item: any) => item.is_express_rent === true)
        .filter((item: any) => {
          const status = (item.status || '').toLowerCase();
          if (status && status !== 'open') return false;
          if (item.express_rent_expiry) {
            const expiry = new Date(item.express_rent_expiry);
            if (expiry < new Date()) return false;
          }
          return true;
        })
        .map((item: any) => {
          const isIntlPost = !!(item.booking_no || item.booking_number || item.bl_no || item.bill_of_lading || item.bl_number) || item.job_type === 'international' || item.transport_category === 'international';
          const { originLocation, destinationLocation } = resolveJobLocations(item);

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

      // Exclude jobs already accepted by this driver
      let acceptedOrderNumbers = new Set<string>();
      try {
        const { data: acceptedResult, error: acceptedError } = await getFreelanceAcceptedJobs(user.id);
        if (!acceptedError && acceptedResult) {
          const acceptedData = (acceptedResult as any)?.data || acceptedResult;
          if (Array.isArray(acceptedData)) {
            acceptedOrderNumbers = new Set(acceptedData.map((job: any) => job.order_number));
          }
        }
      } catch (err) {
        console.error('[Market] Error fetching accepted jobs:', err);
      }

      const { data: applications } = await supabase
        .from('job_applications')
        .select('job_id, payment_completed_at')
        .eq('driver_id', user.id);

      const completedJobIds = new Set(
        applications?.filter(app => app.payment_completed_at).map(app => app.job_id) || []
      );
      const acceptedJobIds = new Set(applications?.map(app => app.job_id) || []);

      // Filter out past pickup date/time
      const now = new Date();
      const filterPastJobs = (jobList: Job[]) => jobList.filter(job => {
        if (!job.start_date) return true;
        const time = job.pickup_time || '23:59:59';
        const normalizedTime = time.length === 5 ? `${time}:00` : time;
        const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
        return pickupDateTime >= now;
      });

      const driverVehicleType = user.vehicle_type || '';

      const availableJobs = filterPastJobs(transformedJobs)
        .filter(job => !completedJobIds.has(job.id))
        .filter(job => !acceptedOrderNumbers.has(job.order_code))
        .filter(job => canHandleJobTruckType(driverVehicleType, job.equipment_list))
        .map(job => ({ ...job, isAccepted: acceptedJobIds.has(job.id) }));

      setJobs(availableJobs);
    } catch (err) {
      console.error('[Market] Error fetching jobs:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (user && isFreelanceDriver) {
      loadJobs();
    }
  }, [user, isFreelanceDriver, loadJobs]);

  const applySearch = (jobList: Job[]) => {
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) return jobList;
    return jobList.filter((job) => {
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
      ]
        .filter((f) => typeof f === 'string')
        .join(' ')
        .toLowerCase();
      return haystack.includes(raw);
    });
  };

  const displayedJobs = applySearch(jobs);
  const totalPages = Math.ceil(displayedJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = displayedJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, jobs.length]);

  const handleAcceptJob = (job: Job) => {
    if (!requireBankInfo()) return;
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };

  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user || isAccepting) return;

    logClientEvent({
      event: 'accept-job:pressed',
      driver_id: localStorage.getItem('auth_driver_id') ?? user?.id ?? null,
      order_number: selectedJob.order_code,
      payload: { context: 'market-page', job_id: selectedJob.id },
    });

    setIsAccepting(true);

    try {
      const driverName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.full_name || user.name || '';
      const driverPhone = user.phone_number || user.phone || '';
      const province = (user.plate_province || '').trim();
      const number = (user.plate_number || '').trim();
      const licensePlate = [province, number].filter(Boolean).join(' ').trim();
      const vehicleType = (user.vehicle_type || '').trim();
      const vehicleBrand = (user.vehicle_brand || '').trim();

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
        } catch (gpsError) {
          console.warn('[Market] Could not get GPS position, using origin as fallback:', gpsError);
        }

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
          driver_id: localStorage.getItem('auth_driver_id') || undefined,
        };
        if (waypoints && waypoints.length > 0) {
          trackingBody.waypoints = waypoints;
        }

        const trackingResponse = await createTrackingRoom(trackingBody, 'market-accept');
        if (!trackingResponse.ok) {
          console.error('[Market] Error creating tracking room:', trackingResponse.status, trackingResponse.error);
        } else if (trackingResponse.data?.room?.room_code) {
          localStorage.setItem(`room_code_${selectedJob.order_code}`, trackingResponse.data.room.room_code);
        }
      } catch (trackingError) {
        console.error('[Market] Error creating tracking room:', trackingError);
      }

      setConfirmDialogOpen(false);
      setIsAccepting(false);
      loadJobs();
    } catch (err) {
      console.error('[Market] Error accepting job:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
      setIsAccepting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <AppHeader
        userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username}
        profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined}
        onSignOut={handleSignOut}
        showQuickMenu={false}
      />

      <PullToRefresh onRefresh={loadJobs} className="flex-1 pb-24 lg:pb-8">
        <div className="px-4 mt-6 sm:px-6 lg:px-8 xl:px-10 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold sm:text-xl lg:text-2xl flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              {t('market.title')}
            </h2>
            <span className="text-sm text-muted-foreground sm:text-base">
              {displayedJobs.length} {t('home.items')}
              {totalPages > 1 && ` • ${currentPage}/${totalPages}`}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-md lg:max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('market.search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>

          {/* Job Cards */}
          <div className="card-grid-responsive">
            {isLoading && displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-muted-foreground sm:text-lg">
                  {t('common.loading') || 'กำลังโหลด...'}
                </p>
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 sm:w-20 sm:h-20">
                  <Store className="w-8 h-8 text-muted-foreground sm:w-10 sm:h-10" />
                </div>
                <p className="text-muted-foreground sm:text-lg">
                  {t('market.empty')}
                </p>
              </div>
            ) : (
              paginatedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onAccept={handleAcceptJob}
                  isProcessing={isAccepting}
                />
              ))
            )}
          </div>

          {/* Pagination */}
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

      <ConfirmJobDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmJobAcceptance}
        job={selectedJob}
        isLoading={isAccepting}
      />
    </div>
  );
}
