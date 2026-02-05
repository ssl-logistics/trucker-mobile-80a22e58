import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Phone, MapPin, Camera, Check, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCheckinStatus } from "@/hooks/useCheckinStatus";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import GoogleMap from "@/components/GoogleMap";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { sendJobStatus } from '@/lib/jobStatusService';
import { usePresignedImageUrl } from "@/hooks/usePresignedImageUrl";
import { useGpsTracking } from "@/hooks/useGpsTracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  destination_location: string;
  start_date: string;
  start_time: string;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_contact_person?: string | null;
  destination_address?: string | null;
  destination_goods_type?: string | null;
  destination_goods_quantity?: string | null;
  destination_remarks?: string | null;
  destination_time?: string | null;
  destination_company_name?: string | null;
  price?: number;
}

interface JobDestination {
  id: string;
  job_id: string;
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

interface JobApplication {
  delivery_checked_in_at: string | null;
  payment_completed_at: string | null;
  payment_method: string | null;
  pod_photo_url: string | null;
  delivery_sop_completed_at: string | null;
}

export default function DeliveryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId, destinationId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [destination, setDestination] = useState<JobDestination | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("cash");
  const [showPodConfirmDialog, setShowPodConfirmDialog] = useState(false);
  const [podPhoto, setPodPhoto] = useState<File | null>(null);
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // GPS tracking hook
  const { stopTracking } = useGpsTracking();
  
  // Check-in status hook
  const { deliveryCheckedIn, saveCheckin } = useCheckinStatus(
    job?.order_code || jobId,
    user?.id
  );
  
  // Get presigned URL for POD photo
  const { url: presignedPodPhotoUrl } = usePresignedImageUrl(jobApplication?.pod_photo_url);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, destinationId, user, isInternalDriver, isExternalDriver]);

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
        apiUrl = `${supabaseUrl}/functions/v1/get-freelance-accepted-jobs-proxy?freelance_driver_id=${user.id}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
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
            employer_name: foundJob.factory_name || foundJob.destination_name || foundJob.destination_company_name,
            destination_location: `${foundJob.destination_district || ''}, ${foundJob.destination_province || ''}`.replace(/^, |, $/g, ''),
            start_date: foundJob.destination_delivery_date || foundJob.sender_pickup_date,
            start_time: foundJob.destination_delivery_time || foundJob.sender_pickup_time,
            destination_latitude: foundJob.destination_latitude,
            destination_longitude: foundJob.destination_longitude,
            destination_contact_person: foundJob.destination_contact_name,
            destination_address: foundJob.destination_address,
            destination_goods_type: foundJob.product_name,
            destination_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            destination_remarks: foundJob.remarks,
            destination_time: foundJob.destination_delivery_time,
            destination_company_name: foundJob.destination_company_name || foundJob.destination_name,
            price: foundJob.transport_price || 0,
          };
          setJob(mappedJob);

            // Check for delivery check-in status from API
            try {
              // Build query params based on driver type
              const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
              const checkinsResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?driver_id=${user.id}&driver_type=${driverType}&order_number=${jobId}`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                  }
                }
              );
            
            let deliveryCheckinTime: string | null = null;
            let deliveryConfirmedTime: string | null = null;
            let deliveryConfirmedPhotoUrl: string | null = null;
            let deliveryConfirmedPaymentMethod: string | null = null;

            if (checkinsResponse.ok) {
              const checkinsResult = await checkinsResponse.json();
              if (checkinsResult.success && Array.isArray(checkinsResult.data)) {
                // Filter checkins by transport_order_id matching job.id (foundJob.id) and appropriate driver ID
                const filteredCheckins = checkinsResult.data.filter((c: any) => {
                  const matchesOrder = c.transport_order_id === foundJob.id;
                  const matchesUser = isInternalDriver 
                    ? c.internal_driver_id === user.id 
                    : isExternalDriver 
                      ? c.external_driver_id === user.id 
                      : c.freelance_driver_id === user.id;
                  return matchesOrder && matchesUser;
                });
                console.log('Filtered delivery checkins for order', foundJob.id, ':', filteredCheckins.length);
                
                const deliveryCheckin = filteredCheckins.find((c: any) => c.checkin_type === 'delivery');
                deliveryCheckinTime = deliveryCheckin?.checkin_time || null;

                const deliveryConfirmed = filteredCheckins.find((c: any) => c.checkin_type === 'delivery_confirmed');
                deliveryConfirmedTime = deliveryConfirmed?.checkin_time || null;
                deliveryConfirmedPhotoUrl = deliveryConfirmed?.photo_url || null;
                deliveryConfirmedPaymentMethod = deliveryConfirmed?.payment_method || null;
              }
            }
            
            // Fetch local job application data for payment status (may not exist for external jobs)
            const { data: localJobApp } = await supabase
              .from("job_applications")
              .select("payment_completed_at, payment_method, pod_photo_url, delivery_sop_completed_at")
              .eq("job_id", foundJob.id)
              .eq("driver_id", user.id)
              .maybeSingle();
            
            // Combine external check-in status with local payment/POD data
            setJobApplication({
              delivery_checked_in_at: deliveryCheckinTime,
              payment_completed_at: localJobApp?.payment_completed_at || null,
              payment_method: deliveryConfirmedPaymentMethod || localJobApp?.payment_method || null,
              // Prefer external delivery_confirmed photo/time if present, fallback to local
              pod_photo_url: deliveryConfirmedPhotoUrl || localJobApp?.pod_photo_url || null,
              delivery_sop_completed_at: deliveryConfirmedTime || localJobApp?.delivery_sop_completed_at || null,
            });
          } catch (checkinError) {
            console.error('Error fetching checkin status:', checkinError);
          }
        } else {
          throw new Error('Job not found');
        }
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('delivery.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!job || !user) return;

    const { error } = await supabase
      .from("job_applications")
      .update({
        payment_completed_at: new Date().toISOString(),
        payment_method: selectedPaymentMethod,
      })
      .eq("job_id", job.id)
      .eq("driver_id", user.id);

    if (error) {
      toast({
        title: t('delivery.error'),
        description: t('delivery.paymentError'),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t('delivery.paymentSuccess'),
      description: t('delivery.paymentSuccessToast'),
    });
    setShowPaymentDrawer(false);
    
    // Update jobApplication state directly to show POD section immediately
    setJobApplication(prev => ({
      ...prev!,
      payment_completed_at: new Date().toISOString(),
      payment_method: selectedPaymentMethod,
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPodPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPodPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePodConfirm = async () => {
    if (!job || !user || isSubmittingPod) return;
    
    setIsSubmittingPod(true);

    let photoUrl = jobApplication?.pod_photo_url;

    // Upload photo to S3 if new one is selected
    if (podPhoto) {
      const formData = new FormData();
      formData.append('file', podPhoto);
      formData.append('folder', 'mobile/pod-photos');
      formData.append('filename', `${user.id}-${job.order_code}-${Date.now()}`);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-s3', {
        body: formData
      });

      if (uploadError || !uploadData?.url) {
        toast({
          title: t('delivery.error'),
          description: t('delivery.uploadError'),
          variant: "destructive",
        });
        setIsSubmittingPod(false);
        return;
      }

      photoUrl = uploadData.url;
    }

    // Get current location for POD
    let podLatitude = 0;
    let podLongitude = 0;
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        podLatitude = position.coords.latitude;
        podLongitude = position.coords.longitude;
      } catch (geoError) {
        console.log('Could not get location for POD:', geoError);
      }
    }

    // Send POD to external API directly (same API as check-in)
    let podSubmitSuccess = false;
    let podApiResponse: any = null;
    
    // Determine driver type for POD submission
    const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
    
    try {
      const podPayload: Record<string, unknown> = {
        order_number: job.order_code,
        checkin_type: 'delivery_confirmed',
        driver_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
        driver_phone: user.phone_number || user.phone || '',
        driver_avatar: user.avatar_url || user.profile_photo_url || '',
        latitude: podLatitude,
        longitude: podLongitude,
        notes: 'จัดส่งสำเร็จ',
        photo_url: photoUrl,
        driver_type: driverType,
        payment_method: selectedPaymentMethod,
        // Include destination sequence number for multi-destination POD
        ...(destinationId && { destination_sequence_number: parseInt(destinationId) || 1 }),
      };

      // Set the appropriate driver ID field based on driver type
      if (driverType === 'internal') {
        podPayload.internal_driver_id = user.id;
      } else if (driverType === 'external') {
        podPayload.external_driver_id = user.id;
      } else {
        podPayload.freelance_driver_id = user.id;
      }
      
      console.log('=== Sending POD to external API ===');
      console.log('Payload:', JSON.stringify(podPayload, null, 2));
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-checkin-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(podPayload)
        }
      );
      
      const responseText = await response.text();
      console.log('POD API response status:', response.status);
      console.log('POD API response body:', responseText);
      
      try {
        podApiResponse = JSON.parse(responseText);
      } catch {
        podApiResponse = { message: responseText };
      }
      
      if (!response.ok) {
        console.error('POD API error:', responseText);
        toast({
          title: "❌ ส่ง POD ไม่สำเร็จ",
          description: `API Error: ${podApiResponse?.error || podApiResponse?.message || 'Unknown error'}`,
          variant: "destructive",
        });
        setIsSubmittingPod(false);
        return;
      } else {
        podSubmitSuccess = true;
        console.log('✅ POD submitted to external API successfully:', podApiResponse);
      }
    } catch (podApiError) {
      console.error('Error calling POD API:', podApiError);
      toast({
        title: "❌ ส่ง POD ไม่สำเร็จ",
        description: `Network Error: ${podApiError instanceof Error ? podApiError.message : 'Unknown error'}`,
        variant: "destructive",
      });
      setIsSubmittingPod(false);
      return;
    }

    // Show success toast
    toast({
      title: t('delivery.podSuccess'),
      description: t('delivery.podSuccessToast'),
    });
    
    setShowPodConfirmDialog(false);
    setIsSubmittingPod(false);
    navigate(`/job/${job.order_code}`);
  };

  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const handleCheckIn = async () => {
    if (!job || !user || isCheckingIn) return;

    setIsCheckingIn(true);

    try {
      // Get current location
      let latitude = displayLatitude || 0;
      let longitude = displayLongitude || 0;
      
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

      // Call check-in API via proxy with checkin_type: 'delivery'
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-checkin-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_number: job.order_code,
            checkin_type: 'delivery',
            driver_id: user.id,
            driver_type: driverType,
            driver_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
            driver_phone: user.phone_number || user.phone || '',
            driver_avatar: user.avatar_url || user.profile_photo_url || '',
            latitude: latitude,
            longitude: longitude,
            notes: 'ถึงจุดส่งแล้ว'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      // Also send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: 'delivery_checked_in',
        sequenceNumber: destination?.sequence_number || 3,
        destinationId: destinationId
      });

      // Send truck arrival notification for destination
      try {
        const roomCode = localStorage.getItem(`room_code_${job.order_code}`);
        if (roomCode) {
          console.log('[DeliveryDetailPage] Sending truck-arrival for destination:', { room_code: roomCode, arrival_type: 'destination' });
          const arrivalResponse = await supabase.functions.invoke('truck-arrival', {
            body: {
              room_code: roomCode,
              arrival_type: 'destination'
            }
          });
          console.log('[DeliveryDetailPage] truck-arrival response:', arrivalResponse.data);
        } else {
          console.warn('[DeliveryDetailPage] No room_code found for order:', job.order_code);
        }
      } catch (arrivalError) {
        console.error('[DeliveryDetailPage] Error sending truck-arrival:', arrivalError);
        // Don't block check-in if arrival notification fails
      }

      // Stop GPS tracking after delivery check-in
      stopTracking();
      console.log('[DeliveryDetailPage] GPS tracking stopped');

      // Save check-in to localStorage
      saveCheckin({
        order_number: job.order_code,
        checkin_type: 'delivery',
        driver_id: user.id,
        checked_in_at: new Date().toISOString(),
        latitude: latitude,
        longitude: longitude
      });

      toast({
        title: t('delivery.checkInSuccess'),
        description: t('pickup.checkInSuccessMessage'),
      });
      setShowConfirmDialog(false);
      
      // Navigate to job status page
      navigate(`/job/${job.order_code}`);
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('delivery.error'),
        description: 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง',
        variant: "destructive",
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Determine which check-in status to use - prioritize localStorage for reliability
  const isCheckedIn = deliveryCheckedIn || (destination ? !!destination.checked_in_at : !!jobApplication?.delivery_checked_in_at);
  const checkedInAt = destination ? destination.checked_in_at : jobApplication?.delivery_checked_in_at;
  const isSopCompleted = destination ? !!destination.sop_completed_at : !!jobApplication?.delivery_sop_completed_at;
  
  // Display values - use destination if available, otherwise fallback to job
  const displayCompanyName = destination?.company_name || job?.destination_company_name || '';
  const displayContactName = destination?.contact_name || job?.destination_contact_person || '-';
  const displayAddress = destination?.address || job?.destination_address || job?.destination_location || '-';
  const displayLocation = destination ? `${destination.district || ''}, ${destination.province || ''}` : job?.destination_location || '-';
  const displayLatitude = destination?.latitude || job?.destination_latitude;
  const displayLongitude = destination?.longitude || job?.destination_longitude;
  const displayDeliveryDate = destination?.delivery_date || job?.start_date;
  const displayDeliveryTime = destination?.delivery_time || job?.destination_time || job?.start_time || '-';
  const displayNotes = destination?.notes || job?.destination_remarks || '-';


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            const fromParam = new URLSearchParams(location.search).get('from');
            navigate(`/job/${job.order_code}${fromParam ? `?from=${fromParam}` : ''}`);
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('delivery.deliveryTo')} {displayCompanyName}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {new URLSearchParams(location.search).get('from') !== 'history' && !isSopCompleted && (
          <JobActionButtons jobId={jobId} orderNumber={jobId} isPodCompleted={isSopCompleted} />
        )}

        {isCheckedIn && checkedInAt && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-semibold text-lg">{t('delivery.checkInSuccess')}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(checkedInAt, language)}
              </span>
            </div>
          </div>
        )}

        {jobApplication?.payment_completed_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">{t('delivery.paymentSuccess')}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.payment_completed_at, language)}
              </span>
            </div>

            <div className="border-t-2 border-gray-100 pt-4">
              <h3 className="font-semibold text-base mb-3 text-gray-800">{t('delivery.paymentInfo')}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">{t('delivery.paymentMethod')}</div>
                  <div className="font-medium text-gray-900">
                    {jobApplication.payment_method === "cash" && t('delivery.cash')}
                    {jobApplication.payment_method === "mobile_banking" && t('delivery.mobileBanking')}
                    {jobApplication.payment_method === "qr_code" && t('delivery.qrCode')}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">{t('delivery.amount')}</div>
                  <div className="font-medium text-gray-900">{job?.price?.toLocaleString() || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {jobApplication?.payment_completed_at && !jobApplication?.delivery_sop_completed_at && (
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">
              {t('delivery.uploadDocument')} <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 bg-gray-50"
            >
              {podPhotoPreview ? (
                <img src={podPhotoPreview} alt="POD Document" className="w-full h-full object-contain rounded-lg" />
              ) : (
                <>
                  <Camera className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 text-center" dangerouslySetInnerHTML={{ __html: `${t('delivery.clickToTake')}<br />${t('delivery.waybill')}` }} />
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>
        )}

        {/* POD Success - Show after POD completed */}
        {jobApplication?.delivery_sop_completed_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">{t('delivery.podCompleted')}</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.delivery_sop_completed_at, language)}
              </span>
            </div>

            {/* Payment Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">{t('delivery.paymentMethod')}</div>
                  <div className="font-medium text-gray-900">
                    {jobApplication.payment_method === "cash" && t('delivery.cash')}
                    {jobApplication.payment_method === "mobile_banking" && t('delivery.mobileBanking')}
                    {jobApplication.payment_method === "qr_code" && t('delivery.qrCode')}
                    {!jobApplication.payment_method && '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">{t('delivery.amount')}</div>
                  <div className="font-medium text-green-600 text-lg">฿{job?.price?.toLocaleString() || '-'}</div>
                </div>
              </div>
            </div>

            {/* POD Photo */}
            {presignedPodPhotoUrl && (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-2">{t('delivery.podPhoto')}</div>
                <img
                  src={presignedPodPhotoUrl}
                  alt="POD Document"
                  className="w-full h-48 object-contain rounded-lg border bg-gray-50"
                />
              </div>
            )}
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.contactName')}</div>
          <div className="text-base">{displayContactName}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.routeNumber')}</div>
          <div className="text-base">{displayLocation}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.address')}</div>
          <div className="text-base">{displayAddress}</div>
        </div>

        {/* Map */}
        {displayLatitude && displayLongitude ? (
          <GoogleMap 
            latitude={displayLatitude} 
            longitude={displayLongitude}
            markerLabel={displayCompanyName || displayLocation}
            showRoute={true}
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('delivery.map')}</p>
            </div>
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.productType')}</div>
          <div className="text-base">
            {job.destination_goods_type || '-'}
            {job.destination_goods_quantity && ` (${job.destination_goods_quantity})`}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.pickupTime')}</div>
          <div className="text-base">{displayDeliveryDate ? formatDate(displayDeliveryDate, language) : '-'} | {displayDeliveryTime}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('delivery.remarks')}</div>
          <div className="text-base">{displayNotes}</div>
        </div>

      </div>

      {/* Check-in Button - Hide after check-in */}
      {!isCheckedIn && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowConfirmDialog(true)}
          >
            <MapPin className="w-5 h-5 mr-2" />
            {t('delivery.checkIn')}
          </Button>
        </div>
      )}

      {/* SOP Button - Show after check-in for multi-destination */}
      {isCheckedIn && !isSopCompleted && destination && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => navigate(`/job/${jobId}/delivery-sop/${destinationId}`)}
          >
            {t('deliverySop.confirmSOP')}
          </Button>
        </div>
      )}

      {/* Payment Button - Show after check-in, hide after payment or POD completed (legacy) */}
      {!destination && jobApplication?.delivery_checked_in_at && !jobApplication?.payment_completed_at && !jobApplication?.delivery_sop_completed_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowPaymentDrawer(true)}
          >
            {t('delivery.makePayment')}
          </Button>
        </div>
      )}

      {/* POD Confirm Button - Show after payment, hide after POD completed (legacy) */}
      {!destination && jobApplication?.payment_completed_at && !jobApplication?.delivery_sop_completed_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowPodConfirmDialog(true)}
            disabled={!podPhoto && !jobApplication?.pod_photo_url}
          >
            {t('delivery.confirmPod')}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">{t('delivery.confirmStatusTitle')}</DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('delivery.confirmCheckInMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 h-11">
              {t('delivery.cancel')}
            </Button>
            <Button onClick={handleCheckIn} disabled={isCheckingIn} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
              {isCheckingIn ? 'กำลังเช็คอิน...' : t('delivery.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Drawer */}
      <Drawer open={showPaymentDrawer} onOpenChange={setShowPaymentDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">{t('delivery.makePayment')}</DrawerTitle>
            <DrawerDescription className="text-base mt-2">{t('delivery.paymentChannel')}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => setSelectedPaymentMethod("cash")}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === "cash"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPaymentMethod === "cash" ? "border-teal-500" : "border-gray-300"
                }`}
              >
                {selectedPaymentMethod === "cash" && <div className="w-3 h-3 rounded-full bg-teal-500" />}
              </div>
              <span className="text-base font-medium">{t('delivery.cash')}</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod("mobile_banking")}
              className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === "mobile_banking"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPaymentMethod === "mobile_banking" ? "border-teal-500" : "border-gray-300"
                  }`}
                >
                  {selectedPaymentMethod === "mobile_banking" && <div className="w-3 h-3 rounded-full bg-teal-500" />}
                </div>
                <span className="text-base font-medium">{t('delivery.mobileBanking')}</span>
              </div>
              <Phone className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => setSelectedPaymentMethod("qr_code")}
              className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === "qr_code"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedPaymentMethod === "qr_code" ? "border-teal-500" : "border-gray-300"
                  }`}
                >
                  {selectedPaymentMethod === "qr_code" && <div className="w-3 h-3 rounded-full bg-teal-500" />}
                </div>
                <span className="text-base font-medium">{t('delivery.qrCode')}</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>
          <DrawerFooter>
            <Button onClick={handlePaymentConfirm} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700">
              {t('delivery.confirmPayment')}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12 text-base">
                {t('delivery.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* POD Confirmation Dialog */}
      <Dialog open={showPodConfirmDialog} onOpenChange={setShowPodConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <DialogTitle className="text-xl text-center">{t('delivery.confirmStatusTitle')}</DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('delivery.confirmPodMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowPodConfirmDialog(false)} className="flex-1 h-11">
              {t('delivery.cancel')}
            </Button>
            <Button onClick={handlePodConfirm} disabled={isSubmittingPod} className="flex-1 h-11 bg-teal-600 hover:bg-teal-700">
              {isSubmittingPod ? t('delivery.submitting') : t('delivery.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
