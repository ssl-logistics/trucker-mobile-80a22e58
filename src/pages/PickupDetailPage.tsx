import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Phone, MapPin, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useCheckinStatus } from '@/hooks/useCheckinStatus';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import GoogleMap from '@/components/GoogleMap';
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate } from '@/lib/dateUtils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGpsTracking } from '@/hooks/useGpsTracking';
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';
import { fetchAcceptedBidTickets, mapBidTicketToPickupLikeJobDetail } from '@/lib/bidTickets';
import { driverCheckin, getDriverAssignedJobs, getFreelanceAcceptedJobs, updateOrderStatus } from '@/lib/externalApi';
interface JobDetail {
  id: string;
  order_code: string;
  order_number?: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  origin_contact_person?: string | null;
  origin_contact_role?: string | null;
  origin_goods_type?: string | null;
  origin_goods_quantity?: string | null;
  origin_remarks?: string | null;
  origin_address?: string | null;
  origin_company_name?: string | null;
  bl_no?: string | null;
  booking_no?: string | null;
  transport_category?: string | null;
}
export default function PickupDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isBidJob, setIsBidJob] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pickupSopCompleted, setPickupSopCompleted] = useState(false);
  const [sopPhotoUrl, setSopPhotoUrl] = useState<string | null>(null);
  
  // Initialize GPS tracking hook
  const { startTracking } = useGpsTracking();
  
  // Check-in status hook
  const { pickupCheckedIn, saveCheckin, loading: checkinStatusLoading } = useCheckinStatus(
    job?.order_code || jobId,
    user?.id
  );
  
  useEffect(() => {
    loadJobDetail();
  }, [jobId, user, isInternalDriver, isExternalDriver]);
  
  // Redirect to job detail if already checked in
  useEffect(() => {
    if (!checkinStatusLoading && pickupCheckedIn && job) {
      toast({
        title: t('pickup.alreadyCheckedIn') || 'เช็คอินแล้ว',
        description: t('pickup.redirectingToJobDetail') || 'กำลังนำทางไปหน้ารายละเอียดงาน...',
      });
      navigate(isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`);
    }
  }, [checkinStatusLoading, pickupCheckedIn, job, isBidJob, navigate, t]);
  
  useEffect(() => {
    if (job && user) {
      fetchSopStatus();
    }
  }, [job, user]);
  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    
    try {
      // Priority 1: Use job data from navigation state (passed from DomesticJobDetail)
      const stateJobData = (location.state as any)?.jobData;
      const stateIsBidJob = (location.state as any)?.isBidJob;
      if (stateJobData) {
        setIsBidJob(!!stateIsBidJob);
        const mappedJob: JobDetail = {
          id: stateJobData.id,
          order_code: stateJobData.order_code || jobId,
          order_number: stateJobData.order_code || jobId,
          employer_name: stateJobData.employer_name || '-',
          origin_location: stateJobData.origin_location || '-',
          start_date: stateJobData.start_date || '',
          start_time: stateJobData.start_time || '00:00',
          origin_latitude: stateJobData.origin_latitude ?? null,
          origin_longitude: stateJobData.origin_longitude ?? null,
          destination_latitude: stateJobData.destination_latitude ?? null,
          destination_longitude: stateJobData.destination_longitude ?? null,
          origin_contact_person: stateJobData.origin_contact_person ?? null,
          origin_contact_role: stateJobData.origin_contact_role ?? null,
          origin_goods_type: stateJobData.origin_goods_type ?? null,
          origin_goods_quantity: stateJobData.origin_goods_quantity ?? null,
          origin_remarks: stateJobData.origin_remarks ?? null,
          origin_address: stateJobData.origin_address ?? null,
          origin_company_name: stateJobData.origin_company_name ?? null,
          bl_no: stateJobData.bl_no ?? null,
          booking_no: stateJobData.booking_no ?? null,
          transport_category: stateJobData.transport_category ?? null,
        };
        setJob(mappedJob);
        setLoading(false);
        return;
      }

      // Priority 2: Fetch from API
      let result: any;
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        const [inProgressRes, inTransitRes, deliveredRes, returningContainerRes, atContainerReturnRes, containerReturnedRes] = await Promise.all([
          getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
          getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
          getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
          getDriverAssignedJobs(user.id, driverType, 50, 'returning_container'),
          getDriverAssignedJobs(user.id, driverType, 50, 'at_container_return'),
          getDriverAssignedJobs(user.id, driverType, 50, 'container_returned'),
        ]);
        const combinedData = [
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
          ...((returningContainerRes.data as any)?.data || []),
          ...((atContainerReturnRes.data as any)?.data || []),
          ...((containerReturnedRes.data as any)?.data || []),
        ];
        result = { success: true, data: combinedData };
      } else {
        const { data, error } = await getFreelanceAcceptedJobs(user.id);
        if (error) throw new Error(error);
        result = data;
      }

      if (result?.success && result?.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: any) => j.order_number === jobId);
        
        if (foundJob) {
          // Check if this is a bid job by remarks pattern
          const isBidOrigin = foundJob.remarks?.includes('งานจากระบบประมูลภายนอก');
          if (isBidOrigin) {
            // For bid jobs, try to load from bid tickets for correct date/time
            try {
              const tickets = await fetchAcceptedBidTickets(50, user.id);
              const ticket = tickets.find((t) => t.ticket_number === jobId || t.id === jobId);
              if (ticket) {
                setIsBidJob(true);
                setJob(mapBidTicketToPickupLikeJobDetail(ticket) as unknown as JobDetail);
                setLoading(false);
                return;
              }
            } catch {
              // Fall through to use freelance API data
            }
          }
          setIsBidJob(false);
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            order_number: foundJob.order_number,
            employer_name: foundJob.factory_name || foundJob.sender_name,
            origin_location: (Array.isArray(foundJob.origins) && foundJob.origins.length > 0 ? (foundJob.origins[0].district && foundJob.origins[0].province ? `${foundJob.origins[0].district}, ${foundJob.origins[0].province}` : foundJob.origins[0].province || '') : '') || `${foundJob.sender_district || ''}, ${foundJob.sender_province || ''}`.replace(/^, |, $/g, ''),
            start_date: foundJob.sender_pickup_date,
            start_time: foundJob.sender_pickup_time,
            origin_latitude: foundJob.sender_latitude ?? foundJob.empty_pickup_latitude ?? null,
            origin_longitude: foundJob.sender_longitude ?? foundJob.empty_pickup_longitude ?? null,
            destination_latitude: foundJob.destination_latitude,
            destination_longitude: foundJob.destination_longitude,
            origin_contact_person: foundJob.sender_contact_name,
            origin_contact_role: foundJob.sender_contact_phone,
            origin_goods_type: foundJob.product_name,
            origin_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            origin_remarks: foundJob.remarks,
            origin_address: (Array.isArray(foundJob.origins) && foundJob.origins.length > 0 ? foundJob.origins[0].address : null) || foundJob.sender_address,
            origin_company_name: foundJob.factory_name || foundJob.sender_name,
            bl_no: foundJob.bl_no || foundJob.bl_number || foundJob.bill_of_lading || null,
            booking_no: foundJob.booking_no || foundJob.booking_number || null,
            transport_category: foundJob.transport_category || null,
          };
          setJob(mappedJob);
        } else {
          // Fallback: try to load as Bid job (ticket_number)
          const tickets = await fetchAcceptedBidTickets(50, user.id);
          const ticket = tickets.find((t) => t.ticket_number === jobId || t.id === jobId);
          if (!ticket) throw new Error('Job not found');

          setIsBidJob(true);
          setJob(mapBidTicketToPickupLikeJobDetail(ticket) as unknown as JobDetail);
        }
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('pickup.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSopStatus = async () => {
    if (!job || !user) return;
    
    try {
      // Determine the correct driver ID parameter based on driver type
      let driverIdParam = `freelance_driver_id=${user.id}`;
      if (isInternalDriver) {
        driverIdParam = `internal_driver_id=${user.id}`;
      } else if (isExternalDriver) {
        driverIdParam = `external_driver_id=${user.id}`;
      }
      
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop?${driverIdParam}&order_number=${job.order_code}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('Fetched SOP status:', result);
        
        if (result.success && result.data && result.data.length > 0) {
          const pickupSop = result.data.find((sop: any) => sop.sop_type === 'pickup');
          if (pickupSop) {
            setPickupSopCompleted(true);
            if (pickupSop.product_images && pickupSop.product_images.length > 0) {
              setSopPhotoUrl(pickupSop.product_images[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SOP status:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!job || !user || isCheckingIn) return;
    
    setIsCheckingIn(true);
    
    try {
      // Start GPS fetch in background (non-blocking, reduced timeout)
      let latitude = job.origin_latitude || 0;
      let longitude = job.origin_longitude || 0;
      
      const gpsPromise = navigator.geolocation
        ? new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 30000
            });
          }).catch(() => null)
        : Promise.resolve(null);

      // Try to get GPS quickly, but don't block if slow
      const gpsResult = await Promise.race([
        gpsPromise,
        new Promise<null>(r => setTimeout(() => r(null), 3000))
      ]);
      
      if (gpsResult) {
        latitude = gpsResult.coords.latitude;
        longitude = gpsResult.coords.longitude;
      }

      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Call check-in API (the only blocking call)
      const { data: checkinResult, error: checkinError } = await driverCheckin({
        order_number: job.order_number || job.order_code,
        checkin_type: 'pickup',
        driver_id: user.id,
        driver_type: driverType,
        latitude: latitude,
        longitude: longitude,
        notes: 'ถึงจุดรับแล้ว'
      });

      if (checkinError) {
        console.error('Check-in error:', checkinError);
        throw new Error('Check-in failed');
      }

      // Optimistic update & navigate immediately
      saveCheckin({
        order_number: job.order_number || job.order_code,
        checkin_type: 'pickup',
        driver_id: user.id,
        checked_in_at: new Date().toISOString(),
        latitude: latitude,
        longitude: longitude
      });
      
      toast({
        title: t('pickup.checkInSuccess'),
        description: t('pickup.checkInSuccessMessage')
      });
      setShowConfirmDialog(false);
      navigate(`/job/${job.order_code}/sop`, { state: { jobData: job, isBidJob } });

      // === Background tasks (non-blocking) ===
      (async () => {
        try {
          const roomCodeKey = `room_code_${job.order_code}`;
          let roomCode = localStorage.getItem(roomCodeKey);

          if (!roomCode) {
            const truckPlate =
              user.license_plate ||
              (user.plate_province && user.plate_number ? `${user.plate_province} ${user.plate_number}` : '') ||
              user.plate_number || '';

            const jobAny = job as any;
            const waypoints = jobAny.destinations && jobAny.destinations.length > 1
              ? jobAny.destinations.filter((d: any) => d.latitude && d.longitude).map((d: any) => ({ lat: d.latitude, lng: d.longitude }))
              : undefined;

            const trackingBody: any = {
              truck_plate: truckPlate,
              order_code: job.order_code,
              origin_lat: job.origin_latitude ?? 0,
              origin_lng: job.origin_longitude ?? 0,
              destination_lat: job.destination_latitude ?? 0,
              destination_lng: job.destination_longitude ?? 0,
              current_lat: latitude,
              current_lng: longitude,
            };
            if (waypoints && waypoints.length > 0) trackingBody.waypoints = waypoints;

            const trackingResponse = await supabase.functions.invoke('create-tracking-room', { body: trackingBody });

            if (!trackingResponse.error && trackingResponse.data?.room?.room_code) {
              roomCode = trackingResponse.data.room.room_code;
              localStorage.setItem(roomCodeKey, roomCode!);
            } else {
              const errorData = trackingResponse.data || {};
              const detailsStr = errorData?.details?.details || errorData?.details || '';
              const roomMatch = String(detailsStr).match(/room '(RM[A-Z0-9]+)'/);
              if (roomMatch && roomMatch[1]) {
                roomCode = roomMatch[1];
                localStorage.setItem(roomCodeKey, roomCode!);
              }
            }
          }

          if (roomCode) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/truck-arrival`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room_code: roomCode, arrival_type: 'origin' }),
            }).catch(err => console.warn('truck-arrival error:', err));
          }

          // Update order status for international jobs (BL or Booking)
          if (job.booking_no) {
            // Booking: เช็คอินจุดรับสินค้า → delivered
            updateOrderStatus({
              order_number: job.order_code,
              status: 'delivered',
              driver_id: user.id,
              driver_type: driverType,
              notes: 'ถึงจุดรับสินค้าแล้ว',
            }).catch(err => console.warn('updateOrderStatus error:', err));
          } else if (job.bl_no || job.transport_category === 'international') {
            // BL: เช็คอินจุดรับสินค้า → in_transit
            updateOrderStatus({
              order_number: job.order_code,
              status: 'in_transit',
              driver_id: user.id,
              driver_type: driverType,
              notes: 'กำลังไปจุดส่ง',
            }).catch(err => console.warn('updateOrderStatus error:', err));
          }

          // Send job status notification
          sendJobStatus({
            jobId: job.id,
            orderCode: job.order_code,
            userId: user.id,
            status: 'pickup_checked_in',
          }).catch(err => console.warn('sendJobStatus error:', err));
        } catch (bgError) {
          console.error('[PickupDetail] Background task error:', bgError);
        }
      })();
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('pickup.error'),
        description: 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive'
      });
    } finally {
      setIsCheckingIn(false);
    }
  };
  const openGoogleMaps = () => {
    if (!job?.origin_latitude || !job?.origin_longitude) {
      toast({
        title: t('pickup.error'),
        description: t('pickup.noCoordinates'),
        variant: 'destructive'
      });
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${job.origin_latitude},${job.origin_longitude}`;
    window.open(url, '_blank');
  };
  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>;
  }
  if (!job) return null;
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('pickup.title')} {job.origin_company_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} orderNumber={jobId} />

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.contactName')}</div>
          <div className="text-base">
            {job.origin_contact_person || '-'}
            {job.origin_contact_role && ` (${job.origin_contact_role})`}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.routeNumber')}</div>
          <div className="text-base">{job.origin_location}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.address')}</div>
          <div className="text-base">{job.origin_address || job.origin_location || '-'}</div>
        </div>

        {job.origin_latitude && job.origin_longitude ? <GoogleMap latitude={job.origin_latitude} longitude={job.origin_longitude} markerLabel={job.origin_location} showRoute={true} /> : <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูลพิกัด</p>
            </div>
          </div>}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.productType')}</div>
          <div className="text-base">
            {job.origin_goods_type ? `${job.origin_goods_type}${job.origin_goods_quantity ? ` (${job.origin_goods_quantity})` : ''}` : '-'}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.pickupTime')}</div>
          <div className="text-base">{formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.note')}</div>
          <div className="text-base">{job.origin_remarks || '-'}</div>
        </div>

        <div className="space-y-3 pt-4">
          <Button 
            variant="outline" 
            className="w-full h-12 text-base border-[#153860]"
            onClick={() => {
              const phone = job.origin_contact_role;
              if (phone) {
                window.location.href = `tel:${phone}`;
              } else {
                toast({
                  title: t('pickup.error'),
                  description: t('jobDetail.noPhoneNumber'),
                  variant: 'destructive'
                });
              }
            }}
          >
            <Phone className="w-5 h-5 mr-2" />
            {t('pickup.call')}
          </Button>
          <Button variant="outline" onClick={openGoogleMaps} className="w-full h-12 text-base border-[#153860]">
            <img src={routeIcon} alt="Route" className="w-5 h-5 mr-2" />
            {t('pickup.route')}
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        {pickupCheckedIn ? (
          <div className="flex items-center justify-center gap-2 text-green-600 py-3">
            <CheckCircle className="w-6 h-6" />
            <span className="text-base font-medium">เช็คอินสำเร็จแล้ว</span>
          </div>
        ) : (
          <Button className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700" onClick={() => setShowConfirmDialog(true)}>
            <MapPin className="w-5 h-5 mr-2" />
            {t('pickup.checkIn')}
          </Button>
        )}
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">
              {t('pickup.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('pickup.confirmMessage').replace('{location}', job.origin_company_name || job.origin_location || '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 h-11">
              {t('pickup.cancel')}
            </Button>
            <Button onClick={handleCheckIn} disabled={isCheckingIn} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
              {isCheckingIn ? 'กำลังเช็คอิน...' : t('pickup.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}