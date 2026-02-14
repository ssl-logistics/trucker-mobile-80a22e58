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
import { useNativeCamera } from '@/hooks/useNativeCamera'; import { getDriverCheckins, getOcrContainerScans } from '@/lib/externalApi';
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
import checkInIcon from '@/assets/check-in-icon.png';

interface DriverCheckin {
  order_number: string;
  checkin_type: string;
  checked_in_at: string;
}
interface JobDestination {
  id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
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
  booking_no?: string | null;
  bl_no?: string | null;
  // Multiple destinations from API
  destinations?: JobDestination[];
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
  container_sop_completed_at?: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  status: string;
}

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
  const { isInternalDriver, isExternalDriver, canViewPrice } = useUserRole();
  const {
    t,
    language
  } = useLanguage();
  const card1Ref = useRef<HTMLDivElement>(null);
  const emptyContainerRef = useRef<HTMLDivElement>(null);
  const deliveryCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerReturnRef = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState<{ emptyContainer: number; card1: number; deliveryCards: Record<string, number>; containerReturn: number }>({
    emptyContainer: 0,
    card1: 0,
    deliveryCards: {},
    containerReturn: 0,
  });
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  // destinations state removed - job_destinations table no longer exists
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [pickupSopCompleted, setPickupSopCompleted] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [deliverySopCompleted, setDeliverySopCompleted] = useState(false);
  const [emptyContainerCheckedIn, setEmptyContainerCheckedIn] = useState(false);
  const [containerReturnCheckedIn, setContainerReturnCheckedIn] = useState(false);
  const [containerReturnConfirmed, setContainerReturnConfirmed] = useState(false);
  const [isLoadingCheckinStatus, setIsLoadingCheckinStatus] = useState(true);
  // Track check-in status for each destination by sequence number
  const [destinationCheckins, setDestinationCheckins] = useState<Record<number, { checked_in_at: string | null; sop_completed_at: string | null }>>({});
  const [showOcrDrawer, setShowOcrDrawer] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [showOcrConfirmDialog, setShowOcrConfirmDialog] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ container_number: string | null; seal_number: string | null } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedContainerNumber, setVerifiedContainerNumber] = useState<string | null>(null);
  const [verifiedSealNumber, setVerifiedSealNumber] = useState<string | null>(null);
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  const [verifiedLookupData, setVerifiedLookupData] = useState<any>(null);
  
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
      
      if (verifyResult?.found) {
        toast({
          title: t('containerSealVerification.verified') || 'ตรวจสอบสำเร็จ',
          description: verifyResult?.message || 'พบข้อมูลตู้คอนเทนเนอร์ในระบบ',
        });
        
        // Update local state with verified data
        setVerifiedContainerNumber(ocrResult.container_number);
        setVerifiedSealNumber(ocrResult.seal_number);
        setIsOcrVerified(true);
        setVerifiedLookupData(verifyResult);
        setShowOcrConfirmDialog(false);
        
      } else {
        toast({
          title: t('containerSealVerification.notMatched') || 'ไม่พบในระบบ',
          description: t('containerSealVerification.noContainerInDB') || 'ไม่พบเลขตู้นี้ในระบบ',
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

        const { data: checkinResult, error: checkinError } = await getDriverCheckins(
          userId,
          driverType,
          job.order_code
        );

        if (checkinError) {
          console.error('[DomesticJobDetail] getDriverCheckins error:', checkinError);
        }

        console.log('Fetched check-in status:', checkinResult);
        
        const allCheckinsRaw = (checkinResult as any)?.data || checkinResult || [];
        const allCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];
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
        // Support both new (container_pickup) and legacy (empty_container, container) types
        const hasContainerPickupCheckin = checkins.some((c: DriverCheckin) => 
          c.checkin_type === 'container_pickup' || c.checkin_type === 'empty_container' || c.checkin_type === 'container'
        );
        const hasContainerReturnCheckin = checkins.some((c: DriverCheckin) => c.checkin_type === 'container_return');
        const hasContainerReturnConfirmed = checkins.some((c: DriverCheckin) => c.checkin_type === 'container_return_confirmed');
        console.log('Status - Pickup:', hasPickupCheckin, 'Delivery:', hasDeliveryCheckin, 'Confirmed:', hasDeliveryConfirmed, 'ContainerPickup:', hasContainerPickupCheckin, 'ContainerReturn:', hasContainerReturnCheckin, 'ContainerReturnConfirmed:', hasContainerReturnConfirmed);
        
        setPickupCheckedIn(hasPickupCheckin);
        setDeliveryCheckedIn(hasDeliveryCheckin);
        setEmptyContainerCheckedIn(hasContainerPickupCheckin);
        setContainerReturnCheckedIn(hasContainerReturnCheckin);
        setContainerReturnConfirmed(hasContainerReturnConfirmed);
        
        
        // Extract destination-specific check-ins (delivery_1, delivery_2, etc.)
        // Also support format: delivery with destination_sequence_number
        // FALLBACK: If checkin_type is plain "delivery" without sequence, assume sequence 1
        const destCheckins: Record<number, { checked_in_at: string | null; sop_completed_at: string | null }> = {};
        checkins.forEach((c: any) => {
          // Match delivery_N format (e.g., delivery_1, delivery_2)
          const deliveryMatch = c.checkin_type?.match(/^delivery_(\d+)$/);
          if (deliveryMatch) {
            const seqNum = parseInt(deliveryMatch[1], 10);
            destCheckins[seqNum] = {
              checked_in_at: c.checked_in_at || c.created_at,
              sop_completed_at: destCheckins[seqNum]?.sop_completed_at || null,
            };
          }
          // Match delivery_confirmed_N format for SOP completion
          const confirmedMatch = c.checkin_type?.match(/^delivery_confirmed_(\d+)$/);
          if (confirmedMatch) {
            const seqNum = parseInt(confirmedMatch[1], 10);
            destCheckins[seqNum] = {
              checked_in_at: destCheckins[seqNum]?.checked_in_at || null,
              sop_completed_at: c.checked_in_at || c.created_at,
            };
          }
          // FALLBACK: Plain "delivery" without _N suffix and no destination_sequence_number
          // For multi-destination jobs, assume it's for sequence 1
          if (c.checkin_type === 'delivery' && !c.destination_sequence_number && !deliveryMatch) {
            if (!destCheckins[1]) {
              destCheckins[1] = { checked_in_at: null, sop_completed_at: null };
            }
            destCheckins[1].checked_in_at = c.checked_in_at || c.created_at;
          }
          // FALLBACK: Plain "delivery_confirmed" without _N suffix and no destination_sequence_number
          if (c.checkin_type === 'delivery_confirmed' && !c.destination_sequence_number && !confirmedMatch) {
            if (!destCheckins[1]) {
              destCheckins[1] = { checked_in_at: null, sop_completed_at: null };
            }
            destCheckins[1].sop_completed_at = c.checked_in_at || c.created_at;
          }
          // Also check destination_sequence_number field if present
          if (c.destination_sequence_number && (c.checkin_type === 'delivery' || c.checkin_type?.startsWith('delivery'))) {
            const seqNum = c.destination_sequence_number;
            if (!destCheckins[seqNum]) {
              destCheckins[seqNum] = { checked_in_at: null, sop_completed_at: null };
            }
            if (c.checkin_type === 'delivery' || c.checkin_type?.match(/^delivery_\d+$/)) {
              destCheckins[seqNum].checked_in_at = c.checked_in_at || c.created_at;
            }
            if (c.checkin_type === 'delivery_confirmed' || c.checkin_type?.match(/^delivery_confirmed_\d+$/)) {
              destCheckins[seqNum].sop_completed_at = c.checked_in_at || c.created_at;
            }
          }
        });
        
        // IMPORTANT: If delivery_confirmed exists but delivery check-in is missing for a sequence,
        // infer that check-in happened (POD completion implies check-in was done)
        Object.keys(destCheckins).forEach(seqKey => {
          const seqNum = parseInt(seqKey, 10);
          if (destCheckins[seqNum].sop_completed_at && !destCheckins[seqNum].checked_in_at) {
            destCheckins[seqNum].checked_in_at = destCheckins[seqNum].sop_completed_at;
          }
        });
        
        console.log('Destination checkins extracted (with inferred):', destCheckins);
        setDestinationCheckins(destCheckins);
        
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
        // Don't reset check-in states on error - they may have been set correctly before SOP fetch failed
        // Only reset SOP completed status since that's what likely failed
        setPickupSopCompleted(false);
      } finally {
        setIsLoadingCheckinStatus(false);
      }
    };
    
    if (userId && job.order_code) {
      fetchStatuses();
    }
  }, [userId, job.order_code, job.id, isInternalDriver, isExternalDriver]);

  // Fetch OCR container scan data from external API with polling
  useEffect(() => {
    const containerNo = job.container_number;
    const orderNumber = job.order_code;
    
    // Need at least one identifier to query
    if (!containerNo && !orderNumber) return;

    const fetchOcrScans = async () => {
      try {
        console.log('Fetching OCR scans for container:', containerNo, 'order:', orderNumber);
        const { data, error } = await getOcrContainerScans(containerNo || undefined, 10, orderNumber || undefined);
        
        if (error) {
          console.error('OCR scans fetch error:', error);
          return;
        }
        
        const scans = (data as any)?.data || [];
        if (scans.length > 0) {
          const latestScan = scans[0];
          setVerifiedContainerNumber(latestScan.container_no || containerNo);
          setVerifiedSealNumber(latestScan.seal_no || job.seal_number || null);
          setIsOcrVerified(true);
          setVerifiedLookupData(latestScan);
          console.log('OCR scan data loaded:', latestScan);
        }
      } catch (err) {
        console.error('OCR scans fetch exception:', err);
      }
    };

    // Fetch immediately
    fetchOcrScans();

    // Poll every 10 seconds if not yet verified
    if (!isOcrVerified) {
      const interval = setInterval(fetchOcrScans, 10000);
      return () => clearInterval(interval);
    }
  }, [job.container_number, job.seal_number, job.order_code, isOcrVerified]);

  useEffect(() => {
    // Calculate card heights for step positioning
    const newHeights: { emptyContainer: number; card1: number; deliveryCards: Record<string, number>; containerReturn: number } = {
      emptyContainer: emptyContainerRef.current?.offsetHeight || 0,
      card1: card1Ref.current?.offsetHeight || 0,
      deliveryCards: {},
      containerReturn: containerReturnRef.current?.offsetHeight || 0,
    };
    deliveryCardRefs.current.forEach((el, key) => {
      newHeights.deliveryCards[key] = el.offsetHeight;
    });
    setCardHeights(newHeights);
  }, [jobApplication, job.destinations, pickupSopCompleted, pickupCheckedIn, deliveryCheckedIn, deliverySopCompleted, destinationCheckins, isOcrVerified, emptyContainerCheckedIn, job.container_return_location]);

  // Use destinations from job props if available, otherwise empty array
  const destinations: JobDestination[] = job.destinations || [];

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
          {canViewPrice && (
            <Card className="p-2 bg-[#E8F5F4] border-0 flex flex-col items-center justify-center">
              <img src={coinsIcon} alt="price" className="w-6 h-6 mb-1" />
              <div className="text-base font-bold text-[#0A8778] whitespace-nowrap">฿ {(job.price ?? 0).toLocaleString()}</div>
            </Card>
          )}
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
              {job.booking_no
                ? `Booking : ${job.booking_no} (ขาออก)`
                : job.bl_no
                  ? `BL : ${job.bl_no} (ขาเข้า)`
                  : `${job.job_type === 'international' ? t('jobDetail.booking') : t('jobDetail.order')} : ${job.order_code}`}
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
              
              {/* Empty Container Circle - Only for international jobs */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && (
                <div className="relative flex justify-center mb-3" style={{
                  height: `${cardHeights.emptyContainer || 200}px`
                }}>
                  <div className="absolute top-0">
                    {isOcrVerified ? (
                      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : emptyContainerCheckedIn ? (
                      <div className="w-7 h-7 rounded-full border-[3px] border-purple-500 bg-white shadow-sm" />
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />
                    )}
                  </div>
                </div>
              )}

              {/* Step 1 Circle - Pickup Point (hidden for BL inbound jobs) */}
              {!job.bl_no && (
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {(pickupSopCompleted || jobApplication?.sop_completed_at) ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />}
                </div>
              </div>
              )}

              {/* Delivery Point Circles */}
              {(destinations.length > 0 ? destinations : [{
              id: 'fallback',
              sequence_number: 1
            }]).map((dest, index) => {
              // For destinations array, check destinationCheckins using sequence_number
              // For fallback single destination, use deliverySopCompleted/deliveryCheckedIn
              const seq = dest.sequence_number;
              const destCheckinData = destinationCheckins[seq];
              
              const isPodCompleted = dest.id === 'fallback' 
                ? deliverySopCompleted  // Use ONLY actual API check-in status
                : !!(destCheckinData?.sop_completed_at || dest.sop_completed_at);
              const isCheckedIn = dest.id === 'fallback'
                ? deliveryCheckedIn  // Use ONLY actual API check-in status
                : !!(destCheckinData?.checked_in_at || dest.checked_in_at);
              
              return <div key={dest.id} className="relative flex justify-center" style={{
                height: `${cardHeights.deliveryCards[dest.id] || 200}px`,
                marginBottom: '12px'
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

              {/* Container Return Circle - Only for international jobs with return data */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && 
                (job.container_return_location || job.container_return_latitude) && (
                <div className="relative flex justify-center" style={{
                  height: `${cardHeights.containerReturn || 200}px`,
                  marginBottom: '12px'
                }}>
                  <div className="absolute top-0">
                    {containerReturnConfirmed ? (
                      <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center shadow-sm">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    ) : containerReturnCheckedIn ? (
                      <div className="w-7 h-7 rounded-full border-[3px] border-blue-500 bg-white shadow-sm" />
                    ) : (
                      <div className="w-7 h-7 rounded-full border-[3px] border-orange-500 bg-white shadow-sm" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Empty Container Pickup Card - Only for international jobs */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && (
                <Card ref={emptyContainerRef} className="p-4 border-2 rounded-2xl border-teal-500 bg-[#F6FFFE]">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-[#225795]">{job.bl_no ? t('jobDetail.loadedContainerPickup') : t('jobDetail.emptyContainerPickup')}</h3>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 ${
                        isOcrVerified 
                          ? 'text-green-600 bg-green-50' 
                          : emptyContainerCheckedIn 
                            ? 'text-purple-600 bg-purple-50' 
                            : 'text-orange-500 bg-[#FFF7E6]'
                      }`}>
                        {isOcrVerified && <CheckCircle className="w-3 h-3" />}
                        {isOcrVerified 
                          ? t('jobDetail.completed') 
                          : emptyContainerCheckedIn 
                            ? t('jobDetail.waitingOCR') 
                            : t('jobDetail.waitingCheckIn')}
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
                      <div className={`rounded-lg p-3 space-y-1.5 text-sm ${isOcrVerified ? 'bg-green-50 border border-green-300' : 'bg-teal-50 border border-teal-200'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isOcrVerified ? 'bg-green-500' : 'bg-teal-500'} text-white text-[10px] font-bold`}>1</span>
                          <span className={`font-medium ${isOcrVerified ? 'text-green-700' : 'text-teal-700'}`}>{t('jobDetail.containerNumber')} : </span>
                          <span className="font-bold">{verifiedContainerNumber || job.container_number || '-'}</span>
                        </div>
                        <div className="ml-7">
                          <span className={`${isOcrVerified ? 'text-green-700' : 'text-teal-700'}`}>{t('jobDetail.sealNumber')} : </span>
                          <span className="font-bold">{verifiedSealNumber || job.seal_number || '-'}</span>
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
                      {isOcrVerified ? (
                        <div className="flex items-center justify-center gap-2 p-3 bg-green-100 rounded-lg border border-green-300">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{t('jobDetail.ocrCompleted') || 'สแกน OCR เสร็จสิ้น'}</span>
                        </div>
                      ) : (
                        <div>
                          <Button 
                            size="sm" 
                            className="w-full h-10 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white"
                            onClick={() => {
                              const fromParam = new URLSearchParams(location.search).get('from');
                               const queryString = fromParam ? `?from=${fromParam}` : '';
                               if (emptyContainerCheckedIn) {
                                 const isInboundJob = !!job.bl_no || job.transport_type?.includes('ขาเข้า');
                                 navigate(`/job/${job.order_code}/container-sop${queryString}`, { state: { jobData: job, checkinType: isInboundJob ? 'loaded_container' : 'empty_container' } });
                              } else {
                                navigate(`/job/${job.order_code}/container-checkin${queryString}`);
                              }
                            }}
                          >
                            <img src={statusIcon} alt="status" className="w-4 h-4" />
                            <span className="text-[10px] leading-tight text-center">{emptyContainerCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Pickup Point Card */}
              {/* For international jobs, pickup is locked until empty container is checked in */}
              {/* For BL (inbound) jobs, hide pickup card entirely */}
              {!job.bl_no && (() => {
                const isInternationalJob = job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ';
                // Lock pickup if: international job AND (not checked in OR checked in but OCR not verified)
                const isPickupLocked = isInternationalJob && (!emptyContainerCheckedIn || (emptyContainerCheckedIn && !isOcrVerified));
                
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
                          <span className="text-[#454545]">: {formatDate(job.start_date, language)} | {job.start_time ? job.start_time.substring(0, 5) : '-'}</span>
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
                          navigate(`/job/${job.order_code}/pickup-summary${queryString}`, { state: { jobData: job } });
                        } else if (pickupCheckedIn || jobApplication?.checked_in_at) {
                          navigate(`/job/${job.order_code}/sop${queryString}`, { state: { jobData: job } });
                        } else {
                          navigate(`/job/${job.order_code}/pickup${queryString}`, { state: { jobData: job } });
                        }
                      }} className="h-auto min-h-[40px] flex flex-col items-center justify-center gap-0.5 p-1 bg-[#225896] border-transparent" disabled={isPickupLocked || isLoadingCheckinStatus}>
                          {isLoadingCheckinStatus ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                          )}
                          <span className="text-[10px] leading-tight text-center">{(pickupSopCompleted || jobApplication?.sop_completed_at) ? t('jobDetail.viewInfo') : (pickupCheckedIn || jobApplication?.checked_in_at) ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })()}


              {/* Delivery Point Cards - Multiple destinations */}
              {destinations.length > 0 ? destinations.map((dest, index) => {
                // Get check-in status from destinationCheckins state (enriched from API)
                const destCheckin = destinationCheckins[dest.sequence_number];
                const isPodCompleted = !!(destCheckin?.sop_completed_at) || !!dest.sop_completed_at;
                const isCheckedIn = !!(destCheckin?.checked_in_at) || !!dest.checked_in_at;
                
                // Check if previous destination is completed (for sequential locking)
                // First destination requires pickup SOP to be completed
                // Subsequent destinations require previous destination's SOP to be completed
                const getPreviousCompleted = () => {
                  if (index === 0) {
                    // For BL (inbound) jobs, unlock after container SOP instead of pickup SOP
                    if (job.bl_no) {
                      return isOcrVerified || !!jobApplication?.container_sop_completed_at;
                    }
                    return pickupSopCompleted || !!jobApplication?.sop_completed_at;
                  }
                  const prevDest = destinations[index - 1];
                  const prevCheckin = destinationCheckins[prevDest?.sequence_number];
                  return !!(prevCheckin?.sop_completed_at) || !!prevDest?.sop_completed_at;
                };
                const isPreviousCompleted = getPreviousCompleted();
                
                // This destination is locked if previous step is not completed
                const isDestinationLocked = !isPreviousCompleted;
                
                // Determine status text and colors
                // Flow changed: Check-in → POD (no separate payment step)
                const getStatusInfo = () => {
                  if (isPodCompleted) {
                    return { text: t('jobDetail.podSuccess'), textColor: 'text-green-600', bgColor: 'bg-[#E6F7E6]' };
                  }
                  if (isCheckedIn) {
                    return { text: t('jobDetail.waitingPod'), textColor: 'text-blue-600', bgColor: 'bg-blue-50' };
                  }
                  return { text: t('jobDetail.waitingCheckIn'), textColor: 'text-orange-500', bgColor: 'bg-[#FFF7E6]' };
                };
                const statusInfo = getStatusInfo();
                
                return (
                  <Card key={dest.id} ref={(el) => { if (el) deliveryCardRefs.current.set(dest.id, el); else deliveryCardRefs.current.delete(dest.id); }} className={`p-4 border-2 rounded-2xl ${isPodCompleted ? 'border-green-500 bg-green-50' : isPreviousCompleted ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                    <div className={`${isDestinationLocked ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')} {destinations.length > 1 ? `#${dest.sequence_number}` : ''}</h3>
                          {dest.company_name && <span className="text-sm font-medium text-[#225795]">: {dest.company_name}</span>}
                        </div>
                        {isDestinationLocked ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-gray-500 bg-gray-100">
                            {t('jobDetail.waitingPreviousStep')}
                          </span>
                        ) : (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusInfo.textColor} ${statusInfo.bgColor}`}>
                            {statusInfo.text}
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
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.goodsType')}</span>
                          <span className="text-[#454545]">: {job.origin_goods_type || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                          <span className="text-[#454545]">: {dest.notes || '-'}</span>
                        </div>
                      </div>

                      <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        {!isFromHistory && (
                          <>
                            <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={isDestinationLocked || isPodCompleted}
                              onClick={() => {
                                const phone = dest.contact_phone;
                                if (phone) {
                                  window.location.href = `tel:${phone}`;
                                } else {
                                  toast({
                                    title: t('jobDetail.error'),
                                    description: t('jobDetail.noPhoneNumber'),
                                    variant: 'destructive'
                                  });
                                }
                              }}>
                              <Phone className="w-4 h-4" />
                              <span className="text-xs">{t('jobDetail.call')}</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={isDestinationLocked || isPodCompleted}
                              onClick={() => {
                                if (dest.address) {
                                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest.address)}`;
                                  window.open(url, '_blank');
                                } else if (dest.district && dest.province) {
                                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dest.district}, ${dest.province}`)}`;
                                  window.open(url, '_blank');
                                } else {
                                  toast({
                                    title: t('jobDetail.error'),
                                    description: t('jobDetail.noLocation'),
                                    variant: 'destructive'
                                  });
                                }
                              }}>
                              <img src={routeIcon} alt="route" className="w-4 h-4" />
                              <span className="text-xs">{t('jobDetail.route')}</span>
                            </Button>
                          </>
                        )}
                        <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-transparent bg-[#225896]" onClick={() => {
                          const fromParam = new URLSearchParams(location.search).get('from');
                          navigate(`/job/${job.order_code}/delivery/${dest.sequence_number}${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: job } });
                        }} disabled={isDestinationLocked}>
                          <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                          <span className="text-[10px] leading-tight text-center">{isPodCompleted ? t('jobDetail.viewInfo') : isCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
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
              // For BL (inbound) jobs, unlock after OCR/container SOP instead of pickup SOP
              const isFallbackUnlocked = job.bl_no
                ? (isOcrVerified || !!jobApplication?.container_sop_completed_at)
                : (pickupSopCompleted || !!jobApplication?.sop_completed_at);
              
              return (
                <Card ref={(el) => { if (el) deliveryCardRefs.current.set('fallback', el); else deliveryCardRefs.current.delete('fallback'); }} className={`p-4 border-2 rounded-2xl ${isPodCompleted ? 'border-green-500 bg-green-50' : isFallbackUnlocked ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                  <div className={`${!isFallbackUnlocked ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')}</h3>
                        {job.destination_company_name && <span className="text-sm font-medium text-[#225795]">: {job.destination_company_name}</span>}
                      </div>
                      {!isFallbackUnlocked ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-gray-500 bg-gray-100">
                          {t('jobDetail.waitingPreviousStep')}
                        </span>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isPodCompleted ? 'text-green-600 bg-[#E6F7E6]' : deliveryCheckedIn ? 'text-blue-600 bg-blue-50' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                          {isPodCompleted ? t('jobDetail.podSuccess') : deliveryCheckedIn ? t('jobDetail.waitingPod') : t('jobDetail.waitingCheckIn')}
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

                    <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      {!isFromHistory && (
                        <>
                          <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!isFallbackUnlocked || isPodCompleted}
                            onClick={() => {
                              const phone = job.destination_contact_phone;
                              if (phone) {
                                window.location.href = `tel:${phone}`;
                              } else {
                                toast({
                                  title: t('jobDetail.error'),
                                  description: t('jobDetail.noPhoneNumber'),
                                  variant: 'destructive'
                                });
                              }
                            }}>
                            <Phone className="w-4 h-4" />
                            <span className="text-xs">{t('jobDetail.call')}</span>
                          </Button>
                          <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!isFallbackUnlocked || isPodCompleted}
                            onClick={() => {
                              const lat = job.destination_latitude;
                              const lng = job.destination_longitude;
                              if (lat && lng) {
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                window.open(url, '_blank');
                              } else if (job.destination_address) {
                                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.destination_address)}`;
                                window.open(url, '_blank');
                              } else {
                                toast({
                                  title: t('jobDetail.error'),
                                  description: t('jobDetail.noLocation'),
                                  variant: 'destructive'
                                });
                              }
                            }}>
                            <img src={routeIcon} alt="route" className="w-4 h-4" />
                            <span className="text-xs">{t('jobDetail.route')}</span>
                          </Button>
                        </>
                      )}
                      <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-transparent bg-[#225896]" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        navigate(`/job/${job.order_code}/delivery${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: job } });
                      }} disabled={!isFallbackUnlocked}>
                        <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                        <span className="text-[10px] leading-tight text-center">{isPodCompleted ? t('jobDetail.viewInfo') : deliveryCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* Container Return Card - Only for international jobs, unlocked after all deliveries completed */}
            {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && 
              (job.container_return_location || job.container_return_latitude) && (() => {
                // Check if ALL destinations have completed POD
                const allDeliveriesCompleted = destinations.length > 0
                  ? destinations.every((dest) => {
                      const destCheckin = destinationCheckins[dest.sequence_number];
                      return !!(destCheckin?.sop_completed_at) || !!dest.sop_completed_at;
                    })
                  : deliverySopCompleted; // fallback for single destination

                return (
              <Card ref={containerReturnRef} className={`p-4 border-2 rounded-2xl ${containerReturnConfirmed ? 'border-green-500 bg-green-50' : containerReturnCheckedIn ? 'border-blue-500 bg-blue-50' : allDeliveriesCompleted ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                <div className={!allDeliveriesCompleted ? 'opacity-60' : ''}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-[#225795]">จุดคืนตู้คอนเทนเนอร์</h3>
                      {job.container_return_location && <span className="text-sm font-medium text-[#225795]">: {job.container_return_location}</span>}
                    </div>
                    {!allDeliveriesCompleted ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-gray-500 bg-gray-100">
                        {t('jobDetail.waitingPreviousStep')}
                      </span>
                    ) : containerReturnConfirmed ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-green-600 bg-[#E6F7E6]">
                        คืนตู้สำเร็จ
                      </span>
                    ) : containerReturnCheckedIn ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-blue-600 bg-blue-100">
                        รอแนบเอกสาร
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-orange-500 bg-[#FFF7E6]">
                        {t('jobDetail.waitingCheckIn')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    {job.container_return_address && (
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">ที่อยู่</span>
                        <span className="text-[#454545]">: {job.container_return_address}</span>
                      </div>
                    )}
                    {job.container_return_date && (
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">วันที่คืนตู้</span>
                        <span className="text-[#454545]">: {formatDate(job.container_return_date, language)}</span>
                      </div>
                    )}
                    {job.container_return_phone && (
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">เบอร์โทร</span>
                        <span className="text-[#454545]">: {job.container_return_phone}</span>
                      </div>
                    )}
                  </div>

                  <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                    {!isFromHistory && (
                      <>
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!allDeliveriesCompleted || containerReturnConfirmed}
                          onClick={() => {
                            if (job.container_return_phone) {
                              window.location.href = `tel:${job.container_return_phone}`;
                            } else {
                              toast({
                                title: t('jobDetail.error'),
                                description: t('jobDetail.noPhoneNumber'),
                                variant: 'destructive'
                              });
                            }
                          }}>
                          <Phone className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.call')}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!allDeliveriesCompleted || containerReturnConfirmed}
                          onClick={() => {
                            if (job.container_return_latitude && job.container_return_longitude) {
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${job.container_return_latitude},${job.container_return_longitude}`;
                              window.open(url, '_blank');
                            } else if (job.container_return_address) {
                              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.container_return_address)}`;
                              window.open(url, '_blank');
                            } else {
                              toast({
                                title: t('jobDetail.error'),
                                description: t('jobDetail.noLocation'),
                                variant: 'destructive'
                              });
                            }
                          }}>
                          <img src={routeIcon} alt="route" className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.route')}</span>
                        </Button>
                      </>
                    )}
                    <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-transparent bg-[#225896]" disabled={!allDeliveriesCompleted}
                        onClick={() => {
                          const fromParam = new URLSearchParams(location.search).get('from');
                          if (containerReturnConfirmed) {
                            // Already confirmed, go to summary page to view info
                            navigate(`/job/${job.order_code}/container-summary${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: job, checkinType: 'container_return' } });
                          } else if (containerReturnCheckedIn) {
                            // After check-in, go to Container SOP for document attachment & confirmation
                            navigate(`/job/${job.order_code}/container-sop${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: job, checkinType: 'container_return' } });
                          } else {
                            // Not yet checked in, go to check-in page
                            navigate(`/job/${job.order_code}/container-checkin${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: job, checkinType: 'container_return' } });
                          }
                        }}>
                        <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                        <span className="text-[10px] leading-tight text-center">{containerReturnConfirmed ? t('jobDetail.viewInfo') : containerReturnCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
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