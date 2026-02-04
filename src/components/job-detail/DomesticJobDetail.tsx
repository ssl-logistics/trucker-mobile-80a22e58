import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Phone, Navigation, CheckCircle, Circle, Loader2, Scan, Camera, Image as ImageIcon, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { formatDate } from '@/lib/dateUtils';
import { useOCR } from '@/hooks/useOCR';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import coinsIcon from '@/assets/coins-icon.png';
import routeIcon from '@/assets/route-icon.png';
import boxIcon from '@/assets/box-icon.png';
import statusIcon from '@/assets/status-icon.png';

interface DriverCheckin {
  order_number: string;
  checkin_type: string;
  checked_in_at: string;
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
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_contact_person: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_remarks: string | null;
  destination_time: string | null;
  destination_date: string | null;
  // Container info for international jobs
  container_checkpoint?: string | null;
  container_checkpoint_time?: string | null;
  empty_container_date?: string | null;
  equipment_list?: string | null;
  container_number?: string | null;
  container_number_2?: string | null;
  seal_number?: string | null;
  seal_number_2?: string | null;
  booking_number?: string | null;
}
interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  status: string;
}
// JobDestination interface removed - table no longer exists
interface DomesticJobDetailProps {
  job: JobDetail;
  jobApplication: JobApplication | null;
  userId: string;
  onUpdate: () => void;
}
export default function DomesticJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate
}: DomesticJobDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const {
    t,
    language
  } = useLanguage();
  const card1Ref = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState({
    card1: 0,
    card2: 0
  });
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  // destinations state removed - job_destinations table no longer exists
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [pickupSopCompleted, setPickupSopCompleted] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [deliverySopCompleted, setDeliverySopCompleted] = useState(false);
  const [emptyContainerCheckedIn, setEmptyContainerCheckedIn] = useState(false);
  const [isLoadingCheckinStatus, setIsLoadingCheckinStatus] = useState(true);
  const [showOcrDrawer, setShowOcrDrawer] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [showOcrConfirmDialog, setShowOcrConfirmDialog] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ container_number: string | null; seal_number: string | null } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // OCR hooks
  const { extractFromImage, extracting } = useOCR();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();

  // Handle OCR photo selection
  const handleOcrPhotoSelect = async (source: 'camera' | 'gallery') => {
    setShowOcrDrawer(false);
    setIsProcessingOcr(true);
    
    try {
      let file: File | null = null;
      
      // Try native camera first (for Capacitor apps)
      if (isNative) {
        if (source === 'camera') {
          file = await takePhoto();
        } else {
          file = await selectFromGallery();
        }
      }
      
      // Fallback to web file input if native didn't return a file
      if (!file) {
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (source === 'camera') {
            input.capture = 'environment';
          }
          
          input.onchange = (e) => {
            const selectedFile = (e.target as HTMLInputElement).files?.[0];
            resolve(selectedFile || null);
          };
          
          input.oncancel = () => resolve(null);
          input.click();
        });
      }
      
      if (!file) {
        setIsProcessingOcr(false);
        return;
      }
      
      // Run OCR extraction
      toast({
        title: t('ocr.processing'),
        description: t('common.pleaseWait') || 'รอสักครู่...',
      });
      
      const result = await extractFromImage(file, 'container_seal');
      
      if (result.success && result.data) {
        const containerNo = result.data.container_number || null;
        const sealNo = result.data.seal_number || null;
        
        // Store OCR result and show confirmation dialog
        setOcrResult({ container_number: containerNo, seal_number: sealNo });
        setShowOcrConfirmDialog(true);
      } else if (result.error) {
        toast({
          title: t('ocr.failed'),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: t('ocr.error'),
        description: t('ocr.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Handle OCR confirmation - verify with API
  const handleConfirmOcr = async () => {
    if (!ocrResult?.container_number) {
      toast({
        title: t('ocr.noContainerFound') || 'ไม่พบเลขตู้',
        description: t('ocr.tryAgain') || 'กรุณาถ่ายรูปใหม่',
        variant: "destructive",
      });
      setShowOcrConfirmDialog(false);
      return;
    }

    setIsVerifying(true);
    
    try {
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-container', {
        body: {
          order_number: job.order_code,
          container_no: ocrResult.container_number,
          seal_no: ocrResult.seal_number || null,
        },
      });
      
      if (verifyError) {
        console.error('Verify container error:', verifyError);
        toast({
          title: t('containerSealVerification.verifyFailed') || 'ตรวจสอบไม่สำเร็จ',
          description: verifyError.message,
          variant: "destructive",
        });
        return;
      }
      
      console.log('Verify container result:', verifyResult);
      
      if (verifyResult?.matched) {
        toast({
          title: t('containerSealVerification.verified') || 'ตรวจสอบสำเร็จ',
          description: t('containerSealVerification.matchedMessage') || 'เลขตู้และซีลตรงกับระบบ',
        });
        
        setShowOcrConfirmDialog(false);
        // Navigate to container SOP page to complete the process
        navigate(`/container-sop/${job.order_code}`);
      } else {
        // Show mismatch error
        const mismatchMessage = verifyResult?.has_containers_in_db 
          ? (t('containerSealVerification.containerMismatch') || 'เลขตู้/ซีลไม่ตรงกับระบบ')
          : (t('containerSealVerification.noContainerInDb') || 'ยังไม่มีเลขตู้ลงทะเบียนในระบบ');
        
        toast({
          title: t('containerSealVerification.notMatched') || 'ไม่ตรงกัน',
          description: mismatchMessage,
          variant: "destructive",
        });
      }
    } catch (verifyErr) {
      console.error('Verify container exception:', verifyErr);
      toast({
        title: t('containerSealVerification.verifyFailed') || 'ตรวจสอบไม่สำเร็จ',
        description: t('common.tryAgain') || 'กรุณาลองใหม่อีกครั้ง',
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle cancel OCR confirmation
  const handleCancelOcr = () => {
    setShowOcrConfirmDialog(false);
    setOcrResult(null);
  };

  // Fetch check-in status and SOP status from external APIs
  useEffect(() => {
    const fetchStatuses = async () => {
      // Reset all states first when job changes
      setPickupCheckedIn(false);
      setPickupSopCompleted(false);
      setDeliveryCheckedIn(false);
      setDeliverySopCompleted(false);
      setEmptyContainerCheckedIn(false);
      setIsLoadingCheckinStatus(true);
      
      try {
        console.log('Current userId:', userId, 'Order code:', job.order_code);
        
        // Fetch check-in status
        const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        const checkinUrl =
          (isInternalDriver || isExternalDriver)
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?driver_id=${encodeURIComponent(
                userId
              )}&driver_type=${driverType}&order_number=${encodeURIComponent(job.order_code)}`
            : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?freelance_driver_id=${encodeURIComponent(
                userId
              )}&order_number=${encodeURIComponent(job.order_code)}`;

        const checkinResponse = await fetch(checkinUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(isInternalDriver || isExternalDriver
              ? { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
              : {}),
          },
        });
        const checkinResult = await checkinResponse.json();
        console.log('Fetched check-in status:', checkinResult);
        
        const allCheckins = checkinResult?.data || checkinResult || [];
        console.log('All checkins from API:', allCheckins.length, 'items');
        console.log('Current job.id (transport_order_id to match):', job.id);
        
        // Filter checkins for this specific order & current driver (support internal/external/freelance)
        const checkins = Array.isArray(allCheckins)
          ? allCheckins.filter((c: any) => {
              const matchesUser = isInternalDriver
                ? c.internal_driver_id === userId
                : isExternalDriver
                  ? c.external_driver_id === userId
                  : c.freelance_driver_id === userId;

              const matchesOrder =
                c.transport_order_id === job.id ||
                c.order_number === job.order_code ||
                c.transport_orders?.order_number === job.order_code;

              console.log(
                'Checkin transport_order_id:',
                c.transport_order_id,
                'job.id:',
                job.id,
                'matchesOrder:',
                matchesOrder,
                'matchesUser:',
                matchesUser
              );

              return matchesUser && matchesOrder;
            })
          : [];
        console.log('Filtered checkins for current order:', checkins.length, 'items');
        
        // Check for different checkin types - only from filtered checkins for this specific order
        const hasPickupCheckin = checkins.some((c: DriverCheckin) => c.checkin_type === 'pickup');
        const hasDeliveryCheckin = checkins.some((c: DriverCheckin) => c.checkin_type === 'delivery');
        const hasDeliveryConfirmed = checkins.some((c: DriverCheckin) => c.checkin_type === 'delivery_confirmed');
        const hasEmptyContainerCheckin = checkins.some((c: DriverCheckin) => c.checkin_type === 'empty_container');
        console.log('Status - Pickup:', hasPickupCheckin, 'Delivery:', hasDeliveryCheckin, 'Confirmed:', hasDeliveryConfirmed, 'EmptyContainer:', hasEmptyContainerCheckin);
        
        setPickupCheckedIn(hasPickupCheckin);
        setDeliveryCheckedIn(hasDeliveryCheckin);
        setEmptyContainerCheckedIn(hasEmptyContainerCheckin);
        
        // If delivery_confirmed exists for THIS order, set deliverySopCompleted to true
        if (hasDeliveryConfirmed) {
          setDeliverySopCompleted(true);
        }

        // Fetch SOP status from external API (role-aware driver id param)
        const sopDriverIdParam = isInternalDriver
          ? `internal_driver_id=${encodeURIComponent(userId)}`
          : isExternalDriver
            ? `external_driver_id=${encodeURIComponent(userId)}`
            : `freelance_driver_id=${encodeURIComponent(userId)}`;

        const sopResponse = await fetch(
          `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop?${sopDriverIdParam}&order_number=${encodeURIComponent(job.order_code)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
            }
          }
        );
        
        if (sopResponse.ok) {
          const sopResult = await sopResponse.json();
          console.log('Fetched SOP status:', sopResult);
          
        if (sopResult.success && sopResult.data) {
            // Check for pickup SOP - check both sop_type and status fields
            const pickupSOP = Array.isArray(sopResult.data)
              ? sopResult.data.find((s: any) => s.sop_type === 'pickup' || s.status === 'pickup')
              : (sopResult.data.sop_type === 'pickup' || sopResult.data.status === 'pickup') ? sopResult.data : null;
            
            setPickupSopCompleted(!!pickupSOP);
            // Note: deliverySopCompleted is ONLY set from hasDeliveryConfirmed (delivery_confirmed checkin)
            // Do NOT set it from delivery SOP record existence - that doesn't mean POD is completed
          }
        }
      } catch (error) {
        console.error('Error fetching statuses:', error);
        setPickupCheckedIn(false);
        setPickupSopCompleted(false);
      } finally {
        setIsLoadingCheckinStatus(false);
      }
    };
    
    if (userId && job.order_code) {
      fetchStatuses();
    }
  }, [userId, job.order_code, job.id, isInternalDriver, isExternalDriver]);

  useEffect(() => {
    // Calculate card heights for step positioning
    if (card1Ref.current) {
      setCardHeights({
        card1: card1Ref.current.offsetHeight,
        card2: 200
      });
    }
  }, [jobApplication]);

  // Empty destinations array - job_destinations table no longer exists
  const destinations: { id: string; sequence_number: number; company_name: string | null; contact_name: string | null; contact_phone: string | null; address: string | null; province: string | null; district: string | null; delivery_date: string | null; delivery_time: string | null; notes: string | null; checked_in_at: string | null; sop_completed_at: string | null }[] = [];

  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            // If from history page or POD is completed, go to home instead of current-jobs
            const isPodCompleted = !!(deliverySopCompleted || jobApplication?.delivery_sop_completed_at);
            navigate((isFromHistory || isPodCompleted) ? '/home' : '/current-jobs');
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">
              {job.order_code}
              {job.transport_type?.includes('ขาเข้า') && ` (${t('jobDetail.inbound')})`}
              {job.transport_type?.includes('ขาออก') && ` (${t('jobDetail.outbound')})`}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge 
                variant="secondary" 
                className={`text-white text-xs ${
                  job.job_type === 'international' ? 'bg-orange-500' : 'bg-blue-500'
                }`}
              >
                {job.job_type === 'international' ? t('jobDetail.international') : t('jobDetail.domestic')}
              </Badge>
            </div>
            {job.booking_number && (
              <div className="text-xs text-white/80 mt-1">
                {t('jobDetail.bookingNumber')}: {job.booking_number}
              </div>
            )}
          </div>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className={`grid gap-2 ${job.job_type === 'international' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <Card className="p-2 bg-[#E8F5F4] border-0 flex flex-col items-center justify-center">
            <img src={coinsIcon} alt="price" className="w-6 h-6 mb-1" />
            <div className="text-base font-bold text-[#0A8778] whitespace-nowrap">฿ {job.price.toLocaleString()}</div>
          </Card>
          <Card className="p-2 bg-[#E8E8E8] border-0 flex flex-col items-center justify-center">
            <img src={routeIcon} alt="route" className="w-5 h-5 mb-1" />
            <div className="text-xs text-gray-700 text-center">{t('jobDetail.pickupDeliveryPoints')} : <span className="font-semibold">{destinations.length > 0 ? destinations.length + 1 : 2}</span></div>
          </Card>
          {job.job_type !== 'international' && (
            <Card className="p-2 bg-[#E8E8E8] border-0 flex flex-col items-center justify-center">
              <img src={boxIcon} alt="goods" className="w-5 h-5 mb-1" />
              <div className="text-xs text-gray-700 text-center">{t('jobDetail.totalGoods')} : <span className="font-semibold">{job.origin_goods_quantity || '-'}</span></div>
            </Card>
          )}
        </div>

        {/* Report Problem Button - Hidden when viewing from history */}
        {new URLSearchParams(location.search).get('from') !== 'history' && (
          <Button variant="outline" className="w-full h-12 border-2 border-gray-300 bg-white hover:bg-gray-50 hover:text-inherit" onClick={() => setIsReportDrawerOpen(true)}>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M0 3.5C0 1.568 1.568 0 3.5 0H28.5C30.432 0 32 1.568 32 3.5V22.5C32 23.4283 31.6313 24.3185 30.9749 24.9749C30.3185 25.6313 29.4283 26 28.5 26H16.12L10.974 31.146C10.5661 31.5524 10.047 31.8289 9.48224 31.9407C8.91743 32.0525 8.33217 31.9946 7.80023 31.7743C7.26828 31.5539 6.81346 31.1811 6.49309 30.7027C6.17272 30.2243 6.00115 29.6618 6 29.086V26H3.5C2.57174 26 1.6815 25.6313 1.02513 24.9749C0.368749 24.3185 0 23.4283 0 22.5L0 3.5ZM3.5 3C3.36739 3 3.24021 3.05268 3.14645 3.14645C3.05268 3.24021 3 3.36739 3 3.5V22.5C3 22.776 3.224 23 3.5 23H7.5C7.89782 23 8.27936 23.158 8.56066 23.4393C8.84196 23.7206 9 24.1022 9 24.5V28.88L14.44 23.44C14.721 23.1586 15.1023 23.0004 15.5 23H28.5C28.6326 23 28.7598 22.9473 28.8536 22.8536C28.9473 22.7598 29 22.6326 29 22.5V3.5C29 3.36739 28.9473 3.24021 28.8536 3.14645C28.7598 3.05268 28.6326 3 28.5 3H3.5ZM17.5 7.5V12.5C17.5 12.8978 17.342 13.2794 17.0607 13.5607C16.7794 13.842 16.3978 14 16 14C15.6022 14 15.2206 13.842 14.9393 13.5607C14.658 13.2794 14.5 12.8978 14.5 12.5V7.5C14.5 7.10218 14.658 6.72064 14.9393 6.43934C15.2206 6.15804 15.6022 6 16 6C16.3978 6 16.7794 6.15804 17.0607 6.43934C17.342 6.72064 17.5 7.10218 17.5 7.5ZM18 18C18 18.5304 17.7893 19.0391 17.4142 19.4142C17.0391 19.7893 16.5304 20 16 20C15.4696 20 14.9609 19.7893 14.5858 19.4142C14.2107 19.0391 14 18.5304 14 18C14 17.4696 14.2107 16.9609 14.5858 16.5858C14.9609 16.2107 15.4696 16 16 16C16.5304 16 17.0391 16.2107 17.4142 16.5858C17.7893 16.9609 18 17.4696 18 18Z" fill="#0A8778" />
              </svg>
              <span className="font-medium">{t('jobDetail.reportProblem')}</span>
            </div>
          </Button>
        )}

        {/* Route Info */}
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">
              {t('jobDetail.booking')} : {job.order_code}
            </h2>
            <p className="text-base font-medium text-[#005E53]">
              {t('jobDetail.employer')} : {job.employer_name}
            </p>
          </div>

          {/* Step Tracker + Content Wrapper */}
          <div className="relative flex gap-3">
            {/* Left Timeline Column with Continuous Line */}
            <div className="relative flex flex-col" style={{
            width: '28px',
            paddingTop: '8px'
          }}>
              {/* Continuous Vertical Line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300" style={{
              top: '8px',
              height: `calc(100% - 16px)`
            }} />
              
              {/* Step 1 Circle - Pickup Point */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {(pickupSopCompleted || jobApplication?.sop_completed_at) ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />}
                </div>
              </div>

              {/* Delivery Point Circles */}
              {(destinations.length > 0 ? destinations : [{
              id: 'fallback',
              sequence_number: 1
            }]).map((dest, index) => {
              // For fallback, use ONLY actual check-in status from API
              // NOT jobApplication data which is derived from external API status and may be incorrect for Bid Jobs
              const isPodCompleted = dest.id === 'fallback' 
                ? deliverySopCompleted  // Use ONLY actual API check-in status
                : !!dest.sop_completed_at;
              const isCheckedIn = dest.id === 'fallback'
                ? deliveryCheckedIn  // Use ONLY actual API check-in status
                : !!dest.checked_in_at;
              
              return <div key={dest.id} className="relative flex justify-center" style={{
                height: '200px',
                marginBottom: index < (destinations.length > 0 ? destinations.length - 1 : 0) ? '12px' : '0'
              }}>
                  <div className="absolute top-0">
                    {isPodCompleted ? (
                      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : isCheckedIn ? (
                      <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />
                    ) : (pickupSopCompleted || jobApplication?.sop_completed_at) ? (
                      <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />
                    )}
                  </div>
                </div>;
            })}
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Empty Container Pickup Card - Only for international jobs */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && (
                <Card className="p-4 border-2 rounded-2xl border-teal-500 bg-[#F6FFFE]">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.emptyContainerPickup')}</h3>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${emptyContainerCheckedIn ? 'text-purple-600 bg-purple-50' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                        {emptyContainerCheckedIn ? t('jobDetail.waitingOCR') : t('jobDetail.waitingCheckIn')}
                      </span>
                    </div>
                    
                    <div className="text-sm font-medium text-[#225795] mb-2">
                      {job.container_checkpoint || '-'}
                    </div>

                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex">
                        <span className="text-[#454545] min-w-[130px]">{t('jobDetail.shipArrivalDateTime')}</span>
                        <span className="text-[#454545]">: {job.container_checkpoint_time ? formatDate(job.container_checkpoint_time, language) : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[130px]">{t('jobDetail.emptyContainerPickupDate')}</span>
                        <span className="text-[#454545]">: {job.empty_container_date ? formatDate(job.empty_container_date, language) : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[130px]">{t('jobDetail.receiver')}</span>
                        <span className="text-[#454545]">: {job.origin_company_name || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[130px]">{t('jobDetail.containerTypeQty')}</span>
                        <span className="text-[#454545]">: {job.equipment_list || '-'}</span>
                      </div>
                    </div>

                    {/* Container/Seal info */}
                    <div className="space-y-2">
                      {/* Container 1 */}
                      <div className="rounded-lg p-3 space-y-1.5 text-sm bg-teal-50 border border-teal-200">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-bold">1</span>
                          <span className="font-medium text-teal-700">{t('jobDetail.containerNumber')} : </span>
                          <span className="font-bold">{job.container_number || '-'}</span>
                        </div>
                        <div className="ml-7">
                          <span className="text-teal-700">{t('jobDetail.sealNumber')} : </span>
                          <span className="font-bold">{job.seal_number || '-'}</span>
                        </div>
                      </div>
                      
                      {/* Container 2 - only show if there's data */}
                      {(job.container_number_2 || job.seal_number_2) && (
                        <div className="rounded-lg p-3 space-y-1.5 text-sm bg-teal-50 border border-teal-200">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-bold">2</span>
                            <span className="font-medium text-teal-700">{t('jobDetail.containerNumber')} : </span>
                            <span className="font-bold">{job.container_number_2 || '-'}</span>
                          </div>
                          <div className="ml-7">
                            <span className="text-teal-700">{t('jobDetail.sealNumber')} : </span>
                            <span className="font-bold">{job.seal_number_2 || '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      {emptyContainerCheckedIn ? (
                        <Button 
                          size="sm" 
                          className="w-full h-10 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => setShowOcrDrawer(true)}
                          disabled={isProcessingOcr || extracting}
                        >
                          {(isProcessingOcr || extracting) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Scan className="w-4 h-4" />
                          )}
                          <span className="text-xs">
                            {(isProcessingOcr || extracting) ? t('ocr.processing') : t('ocr.scanButton')}
                          </span>
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-10 flex items-center justify-center gap-2 border-[#153860]"
                            onClick={() => {
                              if (job.container_checkpoint) {
                                const query = encodeURIComponent(job.container_checkpoint);
                                window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                              } else {
                                toast({
                                  title: t('jobDetail.error'),
                                  description: t('containerCheckin.noLocationFound'),
                                  variant: 'destructive'
                                });
                              }
                            }}
                          >
                            <img src={routeIcon} alt="route" className="w-4 h-4" />
                            <span className="text-xs text-[#153860]">{t('jobDetail.route')}</span>
                          </Button>
                          <Button 
                            size="sm" 
                            className="h-10 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white"
                            onClick={() => {
                              navigate(`/job/${job.order_code}/container-checkin`);
                            }}
                          >
                            <img src={statusIcon} alt="status" className="w-4 h-4" />
                            <span className="text-xs">{t('jobDetail.updateStatus')}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Pickup Point Card */}
              {/* For international jobs, pickup is locked until empty container is checked in */}
              {(() => {
                const isInternationalJob = job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ';
                const isPickupLocked = isInternationalJob && !emptyContainerCheckedIn;
                
                return (
                  <Card ref={card1Ref} className={`p-4 border-2 rounded-2xl ${(pickupSopCompleted || jobApplication?.sop_completed_at) ? 'border-green-500 bg-green-50' : pickupCheckedIn ? 'border-teal-500 bg-[#F6FFFE]' : isPickupLocked ? 'border-gray-300 bg-gray-50' : 'border-teal-500 bg-[#F6FFFE]'}`}>
                    <div className={isPickupLocked ? 'opacity-60' : ''}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.pickupPoint')}</h3>
                          {job.origin_company_name && <span className="text-sm font-medium text-[#225795]">: {job.origin_company_name}</span>}
                        </div>
                        {isLoadingCheckinStatus ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-gray-500 bg-gray-100">
                            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                            {t('common.checking')}
                          </span>
                        ) : isPickupLocked ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-gray-500 bg-gray-100">
                            {t('jobDetail.waitingPreviousStep')}
                          </span>
                        ) : (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${(pickupSopCompleted || jobApplication?.sop_completed_at) ? 'text-green-600 bg-[#E6F7E6]' : pickupCheckedIn ? 'text-orange-500 bg-[#FFF7E6]' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                            {(pickupSopCompleted || jobApplication?.sop_completed_at) ? t('jobDetail.sopSuccess') : pickupCheckedIn ? t('jobDetail.waitingSop') : t('jobDetail.waitingCheckIn')}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm mb-3">
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                          <span className="text-[#454545]">: {job.origin_contact_person || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                          <span className="text-[#454545]">: {job.origin_location || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.goodsType')}</span>
                          <span className="text-[#454545]">: {job.origin_goods_type ? `${job.origin_goods_type}${job.origin_goods_quantity ? ` (${job.origin_goods_quantity})` : ''}` : '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.pickupTime')}</span>
                          <span className="text-[#454545]">: {formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                          <span className="text-[#454545]">: {job.origin_remarks || '-'}</span>
                        </div>
                      </div>


                      <div className={`grid gap-2 ${new URLSearchParams(location.search).get('from') === 'history' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        {new URLSearchParams(location.search).get('from') !== 'history' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]"
                              disabled={isPickupLocked || pickupSopCompleted || !!jobApplication?.sop_completed_at}
                              onClick={() => {
                                const phone = job.origin_contact_phone;
                                if (phone) {
                                  window.location.href = `tel:${phone}`;
                                } else {
                                  toast({
                                    title: t('jobDetail.error'),
                                    description: t('jobDetail.noPhoneNumber'),
                                    variant: 'destructive'
                                  });
                                }
                              }}
                            >
                              <Phone className="w-4 h-4" />
                              <span className="text-xs">{t('jobDetail.call')}</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]"
                              disabled={isPickupLocked || pickupSopCompleted || !!jobApplication?.sop_completed_at}
                              onClick={() => {
                                const lat = job.origin_latitude;
                                const lng = job.origin_longitude;
                                if (lat && lng) {
                                  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                  window.open(url, '_blank');
                                } else if (job.origin_address) {
                                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.origin_address)}`;
                                  window.open(url, '_blank');
                                } else {
                                  toast({
                                    title: t('jobDetail.error'),
                                    description: t('jobDetail.noLocation'),
                                    variant: 'destructive'
                                  });
                                }
                              }}
                            >
                              <img src={routeIcon} alt="route" className="w-4 h-4" />
                              <span className="text-xs">{t('jobDetail.route')}</span>
                            </Button>
                          </>
                        )}
                        <Button size="sm" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        const queryString = fromParam ? `?from=${fromParam}` : '';
                        if (pickupSopCompleted || jobApplication?.sop_completed_at) {
                          navigate(`/job/${job.order_code}/pickup-summary${queryString}`);
                        } else if (pickupCheckedIn || jobApplication?.checked_in_at) {
                          // Already checked in (from API or local state), go to SOP page
                          navigate(`/job/${job.order_code}/sop${queryString}`);
                        } else {
                          // Not checked in yet, go to check-in page
                          navigate(`/job/${job.order_code}/pickup${queryString}`);
                        }
                      }} className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 bg-[#225896] border-transparent" disabled={isPickupLocked || isLoadingCheckinStatus}>
                          {isLoadingCheckinStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                          )}
                          <span className="text-xs">{(pickupSopCompleted || jobApplication?.sop_completed_at) ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })()}


              {/* Delivery Point Cards - Multiple destinations */}
              {destinations.length > 0 ? destinations.map((dest, index) => {
                const isPodCompleted = !!dest.sop_completed_at;
                
                return (
                  <Card key={dest.id} className={`p-4 border-2 rounded-2xl ${isPodCompleted ? 'border-green-500 bg-green-50' : (pickupSopCompleted || jobApplication?.sop_completed_at) ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                    <div className={`${!(pickupSopCompleted || jobApplication?.sop_completed_at) ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')} {destinations.length > 1 ? `#${dest.sequence_number}` : ''}</h3>
                          {dest.company_name && <span className="text-sm font-medium text-[#225795]">: {dest.company_name}</span>}
                        </div>
                        {(pickupSopCompleted || jobApplication?.sop_completed_at) && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isPodCompleted ? 'text-green-600 bg-[#E6F7E6]' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                            {isPodCompleted ? t('jobDetail.podSuccess') : t('jobDetail.waitingCheckIn')}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm mb-3">
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                          <span className="text-[#454545]">: {dest.contact_name || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                          <span className="text-[#454545]">: {dest.district && dest.province ? `${dest.district}, ${dest.province}` : dest.province || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.deliveryTime')}</span>
                          <span className="text-[#454545]">: {dest.delivery_date ? formatDate(dest.delivery_date, language) : '-'} | {dest.delivery_time ? dest.delivery_time.substring(0, 5) : '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                          <span className="text-[#454545]">: {dest.notes || '-'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                          <Phone className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.call')}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                          <img src={routeIcon} alt="route" className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.route')}</span>
                        </Button>
                        <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-transparent bg-[#225896]" onClick={() => {
                          const fromParam = new URLSearchParams(location.search).get('from');
                          navigate(`/job/${job.order_code}/delivery/${dest.id}${fromParam ? `?from=${fromParam}` : ''}`);
                        }} disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                          <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                          <span className="text-xs">{isPodCompleted ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              }) :
            // Fallback to original single destination from jobs table
            (() => {
              // Use ONLY actual check-in status from API, NOT jobApplication data
              const isPodCompleted = deliverySopCompleted;
              
              return (
                <Card className={`p-4 border-2 rounded-2xl ${isPodCompleted ? 'border-green-500 bg-green-50' : (pickupSopCompleted || jobApplication?.sop_completed_at) ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                  <div className={`${!(pickupSopCompleted || jobApplication?.sop_completed_at) ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')}</h3>
                        {job.destination_company_name && <span className="text-sm font-medium text-[#225795]">: {job.destination_company_name}</span>}
                      </div>
                      {(pickupSopCompleted || jobApplication?.sop_completed_at) && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isPodCompleted ? 'text-green-600 bg-[#E6F7E6]' : deliveryCheckedIn ? 'text-blue-600 bg-blue-50' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                          {isPodCompleted ? t('jobDetail.podSuccess') : deliveryCheckedIn ? t('jobDetail.waitingPayment') : t('jobDetail.waitingCheckIn')}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                        <span className="text-[#454545]">: {job.destination_contact_person || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                        <span className="text-[#454545]">: {job.destination_location || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.goodsType')}</span>
                        <span className="text-[#454545]">: {job.destination_goods_type ? `${job.destination_goods_type}${job.destination_goods_quantity ? ` (${job.destination_goods_quantity})` : ''}` : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.deliveryTime')}</span>
                        <span className="text-[#454545]">: {job.destination_date ? formatDate(job.destination_date, language) : formatDate(job.start_date, language)} | {job.destination_time ? job.destination_time.substring(0, 5) : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                        <span className="text-[#454545]">: {job.destination_remarks || '-'}</span>
                      </div>
                    </div>

                    <div className={`grid gap-2 ${new URLSearchParams(location.search).get('from') === 'history' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      {new URLSearchParams(location.search).get('from') !== 'history' && (
                        <>
                          <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                            <Phone className="w-4 h-4" />
                            <span className="text-xs">{t('jobDetail.call')}</span>
                          </Button>
                          <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                            <img src={routeIcon} alt="route" className="w-4 h-4" />
                            <span className="text-xs">{t('jobDetail.route')}</span>
                          </Button>
                        </>
                      )}
                      <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-transparent bg-[#225896]" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        navigate(`/job/${job.order_code}/delivery${fromParam ? `?from=${fromParam}` : ''}`);
                      }} disabled={!(pickupSopCompleted || jobApplication?.sop_completed_at)}>
                        <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                        <span className="text-xs">{isPodCompleted ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })()}
            </div>
          </div>
        </div>
      </div>


      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={job.id} orderNumber={job.order_code} />
      
      {/* OCR Photo Selection Drawer */}
      <Drawer open={showOcrDrawer} onOpenChange={setShowOcrDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('sop.selectSource')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handleOcrPhotoSelect('camera')}
              disabled={isProcessingOcr || extracting}
            >
              <Camera className="w-6 h-6" />
              {t('sop.takePhoto')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handleOcrPhotoSelect('gallery')}
              disabled={isProcessingOcr || extracting}
            >
              <ImageIcon className="w-6 h-6" />
              {t('sop.selectFromGallery')}
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12">
                {t('sop.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* OCR Confirmation Dialog */}
      <Drawer open={showOcrConfirmDialog} onOpenChange={setShowOcrConfirmDialog}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('ocr.confirmTitle') || 'ยืนยันข้อมูล OCR'}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-teal-700 font-medium flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-700 font-bold text-xs">1</span>
                  </div>
                  {t('ocr.containerNumber') || 'เลขตู้คอนเทนเนอร์'}
                </label>
                <Input
                  value={ocrResult?.container_number || ''}
                  onChange={(e) => setOcrResult(prev => prev ? { ...prev, container_number: e.target.value } : { container_number: e.target.value, seal_number: null })}
                  placeholder={t('ocr.enterContainerNumber') || 'กรอกเลขตู้'}
                  className="text-lg font-bold bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-teal-700 font-medium flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-700 font-bold text-xs">2</span>
                  </div>
                  {t('ocr.sealNumber') || 'เลขซีล'}
                </label>
                <Input
                  value={ocrResult?.seal_number || ''}
                  onChange={(e) => setOcrResult(prev => prev ? { ...prev, seal_number: e.target.value } : { container_number: null, seal_number: e.target.value })}
                  placeholder={t('ocr.enterSealNumber') || 'กรอกเลขซีล'}
                  className="text-lg font-bold bg-white"
                />
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              {t('ocr.editablePrompt') || 'สามารถแก้ไขได้หากไม่ถูกต้อง'}
            </p>
          </div>
          <DrawerFooter className="flex-row gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12 gap-2"
              onClick={handleCancelOcr}
              disabled={isVerifying}
            >
              <XCircle className="w-5 h-5" />
              {t('ocr.retake') || 'ถ่ายใหม่'}
            </Button>
            <Button 
              className="flex-1 h-12 gap-2 bg-teal-500 hover:bg-teal-600 text-white"
              onClick={handleConfirmOcr}
              disabled={isVerifying || !ocrResult?.container_number}
            >
              {isVerifying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {isVerifying ? (t('containerSealVerification.verifying') || 'กำลังตรวจสอบ...') : (t('ocr.confirm') || 'ยืนยัน')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>;
}