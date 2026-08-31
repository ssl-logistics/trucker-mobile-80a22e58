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
import { getTaladJobs } from '@/lib/taladApi';


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
      const { jobs: taladJobs, error } = await getTaladJobs();
      if (error) {
        console.error('[Market] Error loading talad jobs:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive'
        });
        return;
      }

      const transformedJobs: Job[] = (taladJobs || [])
        .filter((item) => {
          const status = (item.status || '').toLowerCase();
          if (status && status !== 'open') return false;
          const auction = (item.auction_status || '').toLowerCase();
          if (auction && auction !== 'open') return false;
          if (item.auction_deadline) {
            const deadline = new Date(item.auction_deadline);
            if (!isNaN(deadline.getTime()) && deadline < new Date()) return false;
          }
          return true;
        })
        .map((item) => {
          const bookingNo = item.container?.booking_no || null;
          const weightNumber = typeof item.weight === 'number'
            ? item.weight
            : (typeof item.weight === 'string' ? parseFloat(item.weight.replace(/[^\d.]/g, '')) : null);

          return {
            id: item.job_id,
            post_id: item.job_id,
            order_code: item.talad_code || (item.job_id ? item.job_id.slice(0, 8).toUpperCase() : ''),
            job_type: bookingNo || item.service_type === 'container' ? 'international' : (item.job_type || 'domestic'),
            employer_name: isValidName(item.poster?.company_name) || isValidName(item.poster?.contact_name) || '',
            transport_type: item.truck_type || 'single',
            transport_type_label: item.truck_type || '',
            origin_location: item.locations?.pickup || item.origin || '',
            destination_location: item.locations?.dropoff || item.destination || '',
            destination_company_name: null,
            price: item.final_price ?? item.price ?? 0,
            start_date: (item.locations?.pickup_date || item.created_at || '').slice(0, 10),
            pickup_time: '',
            equipment_list: item.truck_type || null,
            safety_equipment: null,
            goods_type: item.title || null,
            goods_quantity: null,
            goods_weight: weightNumber && !isNaN(weightNumber) ? weightNumber : null,
            goods_unit: null,
            goods_quantity_unit: null,
            isAccepted: false,
            bl_no: null,
            booking_no: bookingNo,
            invoice_number: null,
            remarks: item.description || null,
          } as Job;
        });

      setJobs(transformedJobs);
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
