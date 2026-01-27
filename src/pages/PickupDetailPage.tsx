import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
}
export default function PickupDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
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
  
  useEffect(() => {
    if (job && user) {
      fetchSopStatus();
    }
  }, [job, user]);
  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    
    try {
      let apiUrl: string;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Use different API based on driver type
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        apiUrl = `${supabaseUrl}/functions/v1/get-driver-assigned-jobs?driver_id=${user.id}&driver_type=${driverType}&limit=50`;
      } else {
        apiUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: any) => j.order_number === jobId);
        
        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            order_number: foundJob.order_number,
            employer_name: foundJob.factory_name || foundJob.sender_name,
            origin_location: `${foundJob.sender_district || ''}, ${foundJob.sender_province || ''}`.replace(/^, |, $/g, ''),
            start_date: foundJob.sender_pickup_date,
            start_time: foundJob.sender_pickup_time,
            origin_latitude: foundJob.sender_latitude,
            origin_longitude: foundJob.sender_longitude,
            destination_latitude: foundJob.destination_latitude,
            destination_longitude: foundJob.destination_longitude,
            origin_contact_person: foundJob.sender_contact_name,
            origin_contact_role: foundJob.sender_contact_phone,
            origin_goods_type: foundJob.product_name,
            origin_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            origin_remarks: foundJob.remarks,
            origin_address: foundJob.sender_address,
            origin_company_name: foundJob.factory_name || foundJob.sender_name,
          };
          setJob(mappedJob);
        } else {
          throw new Error('Job not found');
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
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop?freelance_driver_id=${user.id}&order_number=${job.order_code}`,
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
      // Get current location
      let latitude = job.origin_latitude || 0;
      let longitude = job.origin_longitude || 0;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.log('Could not get current location, using job location');
        }
      }

      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Call check-in API via proxy
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-checkin-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_number: job.order_number || job.order_code,
            checkin_type: 'pickup',
            driver_id: user.id,
            driver_type: driverType,
            driver_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
            driver_phone: user.phone_number || user.phone || '',
            driver_avatar: user.avatar_url || user.profile_photo_url || '',
            latitude: latitude,
            longitude: longitude,
            notes: 'ถึงจุดรับแล้ว'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      // Get room_code from localStorage (fallback: create tracking room if missing)
      const roomCodeKey = `room_code_${job.order_code}`;
      let roomCode = localStorage.getItem(roomCodeKey);

      if (!roomCode) {
        const truckPlate =
          user.license_plate ||
          (user.plate_province && user.plate_number ? `${user.plate_province} ${user.plate_number}` : '') ||
          user.plate_number ||
          '';

        try {
          const trackingBody = {
            truck_plate: truckPlate,
            order_code: job.order_code,
            origin_lat: job.origin_latitude ?? 0,
            origin_lng: job.origin_longitude ?? 0,
            destination_lat: job.destination_latitude ?? 0,
            destination_lng: job.destination_longitude ?? 0,
          };

          console.log('📍 create-tracking-room fallback body:', trackingBody);

          const trackingResponse = await supabase.functions.invoke('create-tracking-room', {
            body: trackingBody,
          });

          if (!trackingResponse.error && trackingResponse.data?.room?.room_code) {
            roomCode = trackingResponse.data.room.room_code;
            localStorage.setItem(roomCodeKey, roomCode);
          } else {
            // If 409 conflict, extract existing room_code from error details
            // Response format: { error: "...", details: { error: "...", details: "...room 'RMXXXXXX'" } }
            const errorData = trackingResponse.data || {};
            const detailsStr = errorData?.details?.details || errorData?.details || '';
            const roomMatch = String(detailsStr).match(/room '(RM[A-Z0-9]+)'/);
            
            if (roomMatch && roomMatch[1]) {
              roomCode = roomMatch[1];
              localStorage.setItem(roomCodeKey, roomCode);
              console.log('📍 Extracted existing room_code from conflict:', roomCode);
            } else {
              console.warn('Failed to create tracking room (fallback):', trackingResponse.error || errorData);
            }
          }
        } catch (trackingError) {
          console.warn('Failed to create tracking room (fallback):', trackingError);
        }
      }

      if (roomCode) {
        // Call truck-arrival API to notify arrival at origin
        try {
          const arrivalBody = { room_code: roomCode, arrival_type: 'origin' };
          console.log('📍 truck-arrival body:', arrivalBody);

          const arrivalResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/truck-arrival`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(arrivalBody),
          });

          if (arrivalResponse.ok) {
            const arrivalResult = await arrivalResponse.json();
            console.log('✅ Truck arrival notification sent:', arrivalResult);
          } else {
            const errorText = await arrivalResponse.text();
            console.warn('❌ Failed to send truck arrival notification:', errorText);
          }
        } catch (arrivalError) {
          console.error('Error sending truck arrival notification:', arrivalError);
          // Don't fail the check-in if arrival notification fails
        }
      } else {
        console.warn('⚠️ No room_code found/created for order:', job.order_code);
      }

      // Save check-in to localStorage
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
      navigate(`/job/${job.order_code}`);
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
          <button onClick={() => navigate(`/job/${job.order_code}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('pickup.title')} {job.origin_company_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} />

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
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('pickup.map')}</p>
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
          <Button variant="outline" className="w-full h-12 text-base border-[#153860]">
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