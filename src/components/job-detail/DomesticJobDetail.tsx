import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { translateUnit } from '@/utils/apiDataTranslations';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Phone, Navigation, CheckCircle, Circle, Loader2, Scan, Camera, Image as ImageIcon, XCircle, MapPin, User, Package, Clock, FileText, Calendar, GripVertical, Repeat2, Eye, Mic, MicOff } from 'lucide-react';
import { useVoiceReorder } from '@/hooks/useVoiceReorder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import AccidentEvidenceModal from '@/components/job/AccidentEvidenceModal';
import { formatDate } from '@/lib/dateUtils';
import { useOCR } from '@/hooks/useOCR';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { getDriverCheckins, getOcrContainerScans } from '@/lib/externalApi';
import { getOptimisticCheckins, getLastCheckinSavedAt } from '@/utils/optimisticCheckins';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle } from
'@/components/ui/drawer';
import coinsIcon from '@/assets/coins-icon.png';
import routeIcon from '@/assets/route-icon.png';
import boxIcon from '@/assets/box-icon.png';
import statusIcon from '@/assets/status-icon.png';
import checkInIcon from '@/assets/check-in-icon.png';
import { ContainerReturnDeadlineBanner } from '@/components/job-detail/ContainerReturnDeadlineBanner';

interface DriverCheckin {
  order_number: string;
  checkin_type: string;
  checked_in_at: string;
}
interface DestinationProduct {
  product_name?: string;
  name?: string;
  product_weight?: number;
  weight?: number;
  weight_unit?: string;
  product_quantity?: number;
  quantity?: number;
  quantity_unit?: string;
  unit?: string;
  product_unit?: string;
  destination_id?: string;
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
  latitude: number | null;
  longitude: number | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
  goods_type: string | null;
  invoice_number?: string | null;
  products?: DestinationProduct[];
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
  destination_bill_of_lading: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_remarks: string | null;
  destination_time: string | null;
  destination_date: string | null;
  // Container info for international jobs
  container_checkpoint?: string | null;
  container_checkpoint_time?: string | null;
  empty_container_date?: string | null;
  empty_pickup_address?: string | null;
  empty_pickup_phone?: string | null;
  empty_pickup_date?: string | null;
  empty_pickup_time?: string | null;
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
  // Products array from API
  products?: Array<{
    product_name?: string;
    name?: string;
    product_weight?: number;
    weight?: number;
    weight_unit?: string;
    product_quantity?: number;
    quantity?: number;
    quantity_unit?: string;
    product_unit?: string;
    destination_id?: string;
  }>;
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
  isBidJob?: boolean;
}
export default function DomesticJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate,
  isBidJob = false
}: DomesticJobDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isFromHistory = new URLSearchParams(location.search).get('from') === 'history';
  const isTransferred = !!(location.state as any)?.jobData?.is_transferred || !!(location.state as any)?.is_transferred;
  // Merge is_transferred flag into job for state propagation to sub-pages
  const jobWithTransferFlag = isTransferred ? { ...job, is_transferred: true } : job;
  const { isInternalDriver, isExternalDriver, canViewPrice } = useUserRole();
  const {
    t,
    language
  } = useLanguage();
  const card1Ref = useRef<HTMLDivElement>(null);
  const emptyContainerRef = useRef<HTMLDivElement>(null);
  const deliveryCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerReturnRef = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState<{emptyContainer: number;card1: number;deliveryCards: Record<string, number>;containerReturn: number;}>({
    emptyContainer: 0,
    card1: 0,
    deliveryCards: {},
    containerReturn: 0
  });
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  // Accident evidence lock — read from job object (mapped from API field requires_accident_evidence)
  const requiresAccidentEvidence = !!(job as any)?.requires_accident_evidence;
  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [accidentLocked, setAccidentLocked] = useState(requiresAccidentEvidence);
  // Auto-open modal when job is locked, on entering page or when flag flips on
  useEffect(() => {
    if (requiresAccidentEvidence && !isFromHistory) {
      setAccidentLocked(true);
      setShowAccidentModal(true);
    } else {
      setAccidentLocked(false);
    }
  }, [requiresAccidentEvidence, isFromHistory]);
  // destinations state removed - job_destinations table no longer exists
  const [pickupCheckedIn, setPickupCheckedIn] = useState(false);
  const [pickupSopCompleted, setPickupSopCompleted] = useState(false);
  const [deliveryCheckedIn, setDeliveryCheckedIn] = useState(false);
  const [deliverySopCompleted, setDeliverySopCompleted] = useState(false);
  const [emptyContainerCheckedIn, setEmptyContainerCheckedIn] = useState(false);
  const [containerReturnCheckedIn, setContainerReturnCheckedIn] = useState(false);
  const [containerReturnConfirmed, setContainerReturnConfirmed] = useState(false);
  const [containerPickupConfirmed, setContainerPickupConfirmed] = useState(false);
  const [containerPickupAt, setContainerPickupAt] = useState<string | null>(null);
  // Timestamp of the LATEST EIR (Equipment Interchange Receipt) scan — used as the
  // anchor for the container-return deadline countdown on BL jobs.
  const [latestEirAt, setLatestEirAt] = useState<string | null>(null);
  const [isLoadingCheckinStatus, setIsLoadingCheckinStatus] = useState(true);
  // Track check-in status for each destination by sequence number
  const [destinationCheckins, setDestinationCheckins] = useState<Record<number, {checked_in_at: string | null;sop_completed_at: string | null;}>>({});
  // Reorder state for multi-destination (drag-and-drop, no toggle button)
  const [localDestOrder, setLocalDestOrder] = useState<JobDestination[]>([]);
  const [activeDestIdx, setActiveDestIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Long-press to start drag (mobile)
  const [longPressIdx, setLongPressIdx] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartY = useRef<number>(0);
  const dragItemRef = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);
  const [showOcrDrawer, setShowOcrDrawer] = useState(false);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [showOcrConfirmDialog, setShowOcrConfirmDialog] = useState(false);
  const [ocrResult, setOcrResult] = useState<{container_number: string | null;seal_number: string | null;} | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedContainerNumber, setVerifiedContainerNumber] = useState<string | null>(null);
  const [verifiedSealNumber, setVerifiedSealNumber] = useState<string | null>(null);
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  const [verifiedLookupData, setVerifiedLookupData] = useState<any>(null);
  const [showGoodsModal, setShowGoodsModal] = useState(false);
  const [goodsModalDestIndex, setGoodsModalDestIndex] = useState<number | null>(null);
  // Voice reorder state
  const [showVoiceMatch, setShowVoiceMatch] = useState<{ name: string; index: number } | null>(null);

  useEffect(() => {
    const isReorderLocked = longPressIdx !== null || dragIdx !== null;
    if (!isReorderLocked) return;

    const root = document.getElementById('root');
    const previousRootOverflow = root?.style.overflowY;
    const previousRootTouchAction = root?.style.touchAction;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;

    // Auto-scroll near edges while dragging
    let lastTouchY = 0;
    let rafId: number | null = null;
    const EDGE = 90; // px from top/bottom that triggers scroll
    const MAX_SPEED = 18; // px per frame

    const findScroller = (): HTMLElement | Window => {
      // Find nearest scrollable ancestor; fallback to window
      let el: HTMLElement | null = root;
      while (el) {
        const style = getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el;
        }
        el = el.parentElement;
      }
      return window;
    };
    const scroller = findScroller();

    const tick = () => {
      if (dragItemRef.current === null) { rafId = null; return; }
      const vh = window.innerHeight;
      let dy = 0;
      if (lastTouchY < EDGE) {
        dy = -Math.ceil(((EDGE - lastTouchY) / EDGE) * MAX_SPEED);
      } else if (lastTouchY > vh - EDGE) {
        dy = Math.ceil(((lastTouchY - (vh - EDGE)) / EDGE) * MAX_SPEED);
      }
      if (dy !== 0) {
        if (scroller === window) window.scrollBy(0, dy);
        else (scroller as HTMLElement).scrollTop += dy;
      }
      rafId = requestAnimationFrame(tick);
    };

    const preventPageDrag = (event: TouchEvent) => {
      if (dragItemRef.current !== null) {
        if (event.touches[0]) lastTouchY = event.touches[0].clientY;
        if (rafId === null) rafId = requestAnimationFrame(tick);
        if (event.cancelable) event.preventDefault();
      }
    };

    if (root) {
      root.style.touchAction = 'none';
      root.addEventListener('touchmove', preventPageDrag, { passive: false });
    }
    document.body.style.touchAction = 'none';
    document.addEventListener('touchmove', preventPageDrag, { passive: false });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (root) {
        root.style.overflowY = previousRootOverflow || '';
        root.style.touchAction = previousRootTouchAction || '';
        root.removeEventListener('touchmove', preventPageDrag);
      }
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
      document.removeEventListener('touchmove', preventPageDrag);
    };
  }, [longPressIdx, dragIdx]);
  // Container return slip OCR state
  const [showReturnSlipDrawer, setShowReturnSlipDrawer] = useState(false);
  const [isProcessingReturnSlipOcr, setIsProcessingReturnSlipOcr] = useState(false);
  const [returnSlipYardName, setReturnSlipYardName] = useState<string | null>(null);
  const [returnSlipOcrData, setReturnSlipOcrData] = useState<{ yard_name?: string | null; container_number?: string | null; seal_number?: string | null; return_date?: string | null } | null>(null);

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
        description: t('common.pleaseWait') || 'รอสักครู่...'
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
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: t('ocr.error'),
        description: t('ocr.errorDesc'),
        variant: "destructive"
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
        variant: "destructive"
      });
      setShowOcrConfirmDialog(false);
      return;
    }

    setIsVerifying(true);

    try {
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-container', {
        body: {
          container_no: ocrResult.container_number,
          seal_no: ocrResult.seal_number || null
        }
      });

      if (verifyError) {
        console.error('Verify container error:', verifyError);
        toast({
          title: t('containerSealVerification.verifyFailed') || 'ตรวจสอบไม่สำเร็จ',
          description: verifyError.message,
          variant: "destructive"
        });
        return;
      }

      console.log('Verify container result:', verifyResult);

      if (verifyResult?.found) {
        toast({
          title: t('containerSealVerification.verified') || 'ตรวจสอบสำเร็จ',
          description: verifyResult?.message || 'พบข้อมูลตู้คอนเทนเนอร์ในระบบ'
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
          variant: "destructive"
        });
      }
    } catch (verifyErr) {
      console.error('Verify container exception:', verifyErr);
      toast({
        title: t('containerSealVerification.verifyFailed') || 'ตรวจสอบไม่สำเร็จ',
        description: t('common.tryAgain') || 'กรุณาลองใหม่อีกครั้ง',
        variant: "destructive"
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

  // Handle return slip OCR photo selection
  const handleReturnSlipOcr = async (source: 'camera' | 'gallery') => {
    setShowReturnSlipDrawer(false);
    setIsProcessingReturnSlipOcr(true);

    try {
      let file: File | null = null;

      if (isNative) {
        if (source === 'camera') {
          file = await takePhoto();
        } else {
          file = await selectFromGallery();
        }
      }

      // Fallback to web input
      if (!file) {
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (source === 'camera') {
            input.capture = 'environment';
          }
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            resolve(target.files?.[0] || null);
          };
          input.oncancel = () => resolve(null);
          document.body.appendChild(input);
          input.click();
          document.body.removeChild(input);
        });
      }

      if (!file) {
        setIsProcessingReturnSlipOcr(false);
        return;
      }

      const result = await extractFromImage(file, 'container_return_slip');

      if (result.success && result.data) {
        setReturnSlipOcrData(result.data as any);
        if (result.data.yard_name) {
          setReturnSlipYardName(result.data.yard_name);
          toast({
            title: 'อ่านข้อมูลสำเร็จ',
            description: `พบชื่อลาน: ${result.data.yard_name}`,
          });
        } else {
          toast({
            title: 'ไม่พบชื่อลาน',
            description: 'ไม่สามารถอ่านชื่อลานจากรูปได้ กรุณาลองใหม่',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'อ่านข้อมูลไม่สำเร็จ',
          description: result.error || 'กรุณาลองถ่ายรูปใหม่',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Return slip OCR error:', err);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอ่านใบคืนตู้ได้',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingReturnSlipOcr(false);
    }
  };

  // Fetch check-in status and SOP status from external APIs
  const fetchStatuses = useCallback(async (showLoading: boolean = true) => {
    if (!userId || !job.order_code) return;

    if (showLoading) {
      // Reset all states first when job changes
      setPickupCheckedIn(false);
      setPickupSopCompleted(false);
      setDeliveryCheckedIn(false);
      setDeliverySopCompleted(false);
      setEmptyContainerCheckedIn(false);
      setContainerReturnCheckedIn(false);
      setContainerReturnConfirmed(false);
      setContainerPickupConfirmed(false);
      setContainerPickupAt(null);
      setDestinationCheckins({});
      setIsLoadingCheckinStatus(true);
    }

    try {
      console.log('Current userId:', userId, 'Order code:', job.order_code);

      // Fetch check-in status
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Use allDrivers ONLY for transferred jobs (server ignores order_number filter
      // when no driver_id is supplied → returns 1000-row cap of unrelated rows).
      // For normal jobs, scope to this driver so the API filters server-side correctly.
      const isTransferredJob = !!(job as any)?.is_transferred;
      const { data: checkinResult, error: checkinError } = await getDriverCheckins(
        userId,
        driverType,
        job.order_code,
        isTransferredJob ? { allDrivers: true } : undefined
      );

      if (checkinError) {
        console.error('[DomesticJobDetail] getDriverCheckins error:', checkinError);
      }

      console.log('Fetched check-in status:', checkinResult);

      let allCheckinsRaw = (checkinResult as any)?.data || checkinResult || [];
      let apiCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

      // Safety net: if driver-scoped fetch returned nothing (e.g. job was transferred
      // but flag missing), retry with allDrivers so previous drivers' checkins surface.
      if (!isTransferredJob && apiCheckins.length === 0) {
        const retry = await getDriverCheckins(userId, driverType, job.order_code, { allDrivers: true });
        const retryRaw = (retry.data as any)?.data || retry.data || [];
        if (Array.isArray(retryRaw) && retryRaw.length > 0) {
          apiCheckins = retryRaw.filter((c: any) =>
            c.transport_orders?.order_number === job.order_code ||
            c.order_number === job.order_code
          );
          console.log('[DomesticJobDetail] Fallback allDrivers fetch:', retryRaw.length, '→ filtered', apiCheckins.length);
        }
      }

      // Merge in optimistic check-ins for this order. The external API has a 1000-row
      // hard cap and may not return our just-saved record on the next fetch, so we
      // hydrate the UI from local cache (TTL 30 min) until the API catches up.
      const optimistic = getOptimisticCheckins(job.order_code).map((o) => ({
        ...o,
        order_number: o.order_number,
        transport_order_id: job.id,
      }));
      const allCheckins = [...apiCheckins, ...optimistic];
      console.log('All checkins from API:', apiCheckins.length, 'items (+', optimistic.length, 'optimistic)');
      console.log('Current job.id (transport_order_id to match):', job.id);

      // Filter checkins for this specific order (any driver - supports driver swap scenarios)
      const checkins = Array.isArray(allCheckins)
        ? allCheckins.filter((c: any) => {
            const matchesOrder =
              c.transport_order_id === job.id ||
              c.order_number === job.order_code ||
              c.transport_orders?.order_number === job.order_code;

            return matchesOrder;
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
      const hasContainerPickupConfirmed = checkins.some((c: DriverCheckin) => c.checkin_type === 'container_pickup_confirmed');
      console.log('Status - Pickup:', hasPickupCheckin, 'Delivery:', hasDeliveryCheckin, 'Confirmed:', hasDeliveryConfirmed, 'ContainerPickup:', hasContainerPickupCheckin, 'ContainerReturn:', hasContainerReturnCheckin, 'ContainerReturnConfirmed:', hasContainerReturnConfirmed, 'ContainerPickupConfirmed:', hasContainerPickupConfirmed);

      setPickupCheckedIn(hasPickupCheckin);
      setDeliveryCheckedIn(hasDeliveryCheckin);
      setDeliverySopCompleted(hasDeliveryConfirmed);
      setEmptyContainerCheckedIn(hasContainerPickupCheckin);
      setContainerReturnCheckedIn(hasContainerReturnCheckin);
      setContainerReturnConfirmed(hasContainerReturnConfirmed);
      setContainerPickupConfirmed(hasContainerPickupConfirmed);

      // Capture container pickup timestamp for return-deadline countdown.
      // Prefer the earliest pickup checkin; fall back to the confirmed event.
      const pickupRecord = (checkins.find((c: DriverCheckin) =>
        c.checkin_type === 'container_pickup' || c.checkin_type === 'empty_container' || c.checkin_type === 'container'
      ) as any) || (checkins.find((c: DriverCheckin) => c.checkin_type === 'container_pickup_confirmed') as any);
      setContainerPickupAt(pickupRecord?.checked_in_at || pickupRecord?.created_at || null);

      const statusLower = String((job as any)?.status || jobApplication?.status || '').toLowerCase();
      const jobCompletedByStatus = ['completed', 'closed', 'container_returned'].includes(statusLower) || isFromHistory;
      const completedFallbackTime = (job as any)?.updated_at || job.destination_date || job.start_date || new Date().toISOString();

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
        // IMPORTANT: Check delivery_confirmed BEFORE delivery to avoid the startsWith('delivery') ambiguity
        if (c.destination_sequence_number && c.checkin_type?.startsWith('delivery')) {
          const seqNum = c.destination_sequence_number;
          if (!destCheckins[seqNum]) {
            destCheckins[seqNum] = { checked_in_at: null, sop_completed_at: null };
          }
          // POD/confirmed: matches "delivery_confirmed" or "delivery_confirmed_N"
          if (c.checkin_type === 'delivery_confirmed' || c.checkin_type?.match(/^delivery_confirmed(_\d+)?$/)) {
            destCheckins[seqNum].sop_completed_at = c.checked_in_at || c.created_at || c.checkin_time;
          }
          // Plain check-in: matches "delivery" or "delivery_N" (but NOT delivery_confirmed*)
          else if (c.checkin_type === 'delivery' || c.checkin_type?.match(/^delivery_\d+$/)) {
            destCheckins[seqNum].checked_in_at = c.checked_in_at || c.created_at || c.checkin_time;
          }
        }
      });

      // IMPORTANT: If delivery_confirmed exists but delivery check-in is missing for a sequence,
      // infer that check-in happened (POD completion implies check-in was done)
      Object.keys(destCheckins).forEach((seqKey) => {
        const seqNum = parseInt(seqKey, 10);
        if (destCheckins[seqNum].sop_completed_at && !destCheckins[seqNum].checked_in_at) {
          destCheckins[seqNum].checked_in_at = destCheckins[seqNum].sop_completed_at;
        }
      });

      // History/completed orders can be returned by the job API without every POD
      // check-in row (pagination/driver transfer). Trust completed/closed state there
      // so the detail timeline does not show finished destinations as pending.
      if (jobCompletedByStatus && (job.destinations || []).length > 0) {
        (job.destinations || []).forEach((dest) => {
          const seqNum = dest.sequence_number;
          destCheckins[seqNum] = {
            checked_in_at: destCheckins[seqNum]?.checked_in_at || dest.checked_in_at || dest.sop_completed_at || completedFallbackTime,
            sop_completed_at: destCheckins[seqNum]?.sop_completed_at || dest.sop_completed_at || completedFallbackTime,
          };
        });
      }

      console.log('Destination checkins extracted (with inferred):', destCheckins);
      setDestinationCheckins(destCheckins);

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
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
        }
      );

      if (sopResponse.ok) {
        const sopResult = await sopResponse.json();
        console.log('Fetched SOP status:', sopResult);

        if (sopResult.success && sopResult.data) {
          // Check for pickup SOP - check both sop_type and status fields
          const pickupSOP = Array.isArray(sopResult.data)
            ? sopResult.data.find((s: any) => s.sop_type === 'pickup' || s.status === 'pickup')
            : sopResult.data.sop_type === 'pickup' || sopResult.data.status === 'pickup'
            ? sopResult.data
            : null;

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
      if (showLoading) {
        setIsLoadingCheckinStatus(false);
      }
    }
  }, [userId, job.order_code, job.id, isInternalDriver, isExternalDriver]);

  useEffect(() => {
    void fetchStatuses(true);
  }, [fetchStatuses]);

  // Re-fetch on tab focus / page becoming visible — covers the case where the user
  // returns to job detail after performing a check-in / POD on a sub-page.
  useEffect(() => {
    if (!job.order_code) return;
    const onFocus = () => void fetchStatuses(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchStatuses(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [job.order_code, fetchStatuses]);

  // Burst-poll the External API for ~30s after any recent check-in/POD so the UI
  // converges to real data quickly (the API has eventual consistency + 1000-row cap).
  useEffect(() => {
    if (!job.order_code) return;
    const lastSavedAt = getLastCheckinSavedAt(job.order_code);
    if (!lastSavedAt) return;
    const elapsed = Date.now() - lastSavedAt;
    if (elapsed > 60_000) return; // only when truly recent

    let cancelled = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (cancelled) return;
      await fetchStatuses(false);
      if (Date.now() - startedAt < 30_000 && !cancelled) {
        setTimeout(tick, 3000);
      }
    };
    // First tick after 1s (lets the POST response propagate)
    const t = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [job.order_code, fetchStatuses]);

  // Keep BL evidence status in sync after external checkin changes (e.g. manual delete)
  useEffect(() => {
    if (!job.bl_no) return;

    const interval = setInterval(() => {
      void fetchStatuses(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [job.bl_no, fetchStatuses]);

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

          // Find the LATEST scan that actually has EIR photos — this is the
          // anchor for the container-return deadline countdown.
          const hasEir = (s: any) => {
            const photos = s?.eir_photos;
            if (Array.isArray(photos)) return photos.length > 0;
            if (typeof photos === 'string') return photos.trim().length > 0;
            return false;
          };
          const eirScans = scans.filter(hasEir);
          if (eirScans.length > 0) {
            // Pick the most recent by scanned_at / created_at / updated_at
            const tsOf = (s: any) =>
              new Date(s?.scanned_at || s?.created_at || s?.updated_at || 0).getTime();
            const latestEir = eirScans.reduce((a: any, b: any) => (tsOf(b) > tsOf(a) ? b : a));
            const ts = latestEir?.scanned_at || latestEir?.created_at || latestEir?.updated_at || null;
            setLatestEirAt(ts);
          }
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
    const recalcHeights = () => {
      const newHeights: {emptyContainer: number;card1: number;deliveryCards: Record<string, number>;containerReturn: number;} = {
        emptyContainer: emptyContainerRef.current?.offsetHeight || 0,
        card1: card1Ref.current?.offsetHeight || 0,
        deliveryCards: {},
        containerReturn: containerReturnRef.current?.offsetHeight || 0
      };
      deliveryCardRefs.current.forEach((el, key) => {
        newHeights.deliveryCards[key] = el.offsetHeight;
      });
      setCardHeights(newHeights);
    };
    // Double RAF to ensure DOM has fully rendered after state change
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      recalcHeights();
      raf2 = requestAnimationFrame(recalcHeights);
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [jobApplication, job.destinations, pickupSopCompleted, pickupCheckedIn, deliveryCheckedIn, deliverySopCompleted, destinationCheckins, isOcrVerified, emptyContainerCheckedIn, job.container_return_location, localDestOrder]);

  // Use destinations from job props if available, otherwise empty array
  const destinations: JobDestination[] = job.destinations || [];

  // Container step is only "completed" if checkin exists AND evidence/OCR is done
  // For BL jobs: require container_pickup_confirmed checkin (evidence submitted)
  // For non-BL jobs: require OCR verified
  const isContainerStepCompleted = emptyContainerCheckedIn && (
    job.bl_no ? containerPickupConfirmed : isOcrVerified
  );

  // localStorage key for persisting reorder
  const reorderStorageKey = `dest_order_${job.order_code}`;

  // Sync localDestOrder when destinations change, restore saved order from localStorage
  useEffect(() => {
    if (destinations.length > 0) {
      try {
        const saved = localStorage.getItem(reorderStorageKey);
        if (saved) {
          const savedOrder: { id: string; sequence_number: number }[] = JSON.parse(saved);
          // Rebuild order from saved sequence: map saved id->sequence, then sort destinations by it
          const idToSeq = new Map(savedOrder.map(s => [s.id, s.sequence_number]));
          const reordered = [...destinations]
            .map(d => ({ ...d, sequence_number: idToSeq.get(d.id) ?? d.sequence_number }))
            .sort((a, b) => a.sequence_number - b.sequence_number);
          setLocalDestOrder(reordered);
          return;
        }
      } catch (e) {
        console.error('Error restoring dest order:', e);
      }
      setLocalDestOrder([...destinations]);
    }
  }, [JSON.stringify(destinations)]);

  // The display order for rendering (uses local reorder if available)
  const displayDestinations = localDestOrder.length > 0 ? localDestOrder : destinations;

  // Map checkin data by destination ID (not sequence_number) so it survives reordering
  // Original destinations from API have the original sequence numbers that match the checkin keys
  const destCheckinById = useMemo(() => {
    const map: Record<string, { checked_in_at: string | null; sop_completed_at: string | null }> = {};
    const origDests = job.destinations || [];
    origDests.forEach(d => {
      const checkin = destinationCheckins[d.sequence_number];
      if (checkin) {
        map[d.id] = checkin;
      }
    });
    return map;
  }, [destinationCheckins, job.destinations]);

  const handleSwapRequest = (fromIdx: number, toIdx: number) => {
    console.log('[Reorder] handleSwapRequest called', { fromIdx, toIdx, total: displayDestinations.length });
    if (toIdx < 0 || toIdx >= displayDestinations.length) {
      console.warn('[Reorder] BLOCKED: toIdx out of range', { toIdx, len: displayDestinations.length });
      return;
    }
    if (fromIdx === toIdx) {
      console.warn('[Reorder] BLOCKED: fromIdx === toIdx', { fromIdx });
      return;
    }
    // Prevent swapping destinations that are already checked in
    const fromDest = displayDestinations[fromIdx];
    const toDest = displayDestinations[toIdx];
    const fromCheckin = destCheckinById[fromDest.id];
    const toCheckin = destCheckinById[toDest.id];
    const fromCheckedIn = !!(fromCheckin?.checked_in_at || fromDest.checked_in_at);
    const toCheckedIn = !!(toCheckin?.checked_in_at || toDest.checked_in_at);
    console.log('[Reorder] checkin status', { fromId: fromDest.id, fromCheckedIn, toId: toDest.id, toCheckedIn });
    if (fromCheckedIn || toCheckedIn) {
      console.warn('[Reorder] BLOCKED: one side already checked in');
      toast({ title: t('jobDetail.cannotReorder') || 'สลับไม่ได้', description: t('jobDetail.cannotReorderCheckedIn') || 'จุดส่งที่เช็คอินแล้วไม่สามารถสลับได้', variant: 'destructive' });
      return;
    }
    console.log('[Reorder] -> performSwap');
    // Always exit reorder mode after a swap is initiated, regardless of how it was triggered.
    // Prevents UI from getting stuck with collapsed cards when swapping multiple times in a row.
    setLongPressIdx(null);
    setDragIdx(null);
    setDragOverIdx(null);
    dragOverIdxRef.current = null;
    dragItemRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Swap immediately without confirmation
    void performSwap(fromIdx, toIdx);
  };

  // Voice reorder hook
  const voiceReorder = useVoiceReorder({
    destinations: displayDestinations,
    language,
    onMatch: (result) => {
      // Handle numbered swap commands like "สลับจุด 2 กับจุด 3"
      if (result.swapCommand) {
        const { fromIndex, toIndex } = result.swapCommand;
        if (fromIndex >= 0 && fromIndex < displayDestinations.length && 
            toIndex >= 0 && toIndex < displayDestinations.length && fromIndex !== toIndex) {
          handleSwapRequest(fromIndex, toIndex);
          setShowVoiceMatch({ name: `จุด ${fromIndex + 1} ↔ จุด ${toIndex + 1}`, index: toIndex });
          setTimeout(() => setShowVoiceMatch(null), 3000);
        } else {
          toast({ title: 'หมายเลขจุดส่งไม่ถูกต้อง', description: `ได้ยิน: "${result.transcript}"`, variant: 'destructive' });
        }
        return;
      }

      if (result.matchedDestination) {
        const { matchedDestination } = result;
        const currentDests = displayDestinations;
        const firstUnfinishedIdx = currentDests.findIndex((d) => {
          const checkin = destCheckinById[d.id];
          return !(checkin?.checked_in_at || d.checked_in_at);
        });

        if (firstUnfinishedIdx >= 0 && matchedDestination.index !== firstUnfinishedIdx) {
          handleSwapRequest(matchedDestination.index, firstUnfinishedIdx);
          setShowVoiceMatch({ name: matchedDestination.name, index: matchedDestination.index });
          setTimeout(() => setShowVoiceMatch(null), 3000);
        } else if (matchedDestination.index === firstUnfinishedIdx) {
          toast({ title: `"${matchedDestination.name}" เป็นจุดถัดไปอยู่แล้ว` });
        }
      } else {
        toast({ title: 'ไม่พบจุดส่งที่ตรงกับเสียง', description: `ได้ยิน: "${result.transcript}"`, variant: 'destructive' });
      }
    },
  });

  const performSwap = async (fromIdx: number, toIdx: number) => {
    const newOrder = [...displayDestinations];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= newOrder.length || toIdx >= newOrder.length) return;
    // Save delivery_date/time from original positions so they stay in place
    const fromDate = newOrder[fromIdx].delivery_date;
    const fromTime = newOrder[fromIdx].delivery_time;
    const toDate = newOrder[toIdx].delivery_date;
    const toTime = newOrder[toIdx].delivery_time;
    // Swap destinations
    [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
    // Restore delivery_date/time to their original positions (don't swap them)
    newOrder[fromIdx].delivery_date = fromDate;
    newOrder[fromIdx].delivery_time = fromTime;
    newOrder[toIdx].delivery_date = toDate;
    newOrder[toIdx].delivery_time = toTime;
    // Reassign sequence_number to match new visual order so API calls use the correct sequence
    const resequenced = newOrder.map((dest, idx) => ({
      ...dest,
      sequence_number: idx + 1,
    }));
    setLocalDestOrder(resequenced);
    // Persist to localStorage so order survives navigation
    try {
      localStorage.setItem(reorderStorageKey, JSON.stringify(resequenced.map(d => ({ id: d.id, sequence_number: d.sequence_number }))));
    } catch (e) {
      console.error('Error saving dest order:', e);
    }
    toast({ title: t('jobDetail.swapSuccess') || 'สลับจุดส่งสำเร็จ' });

    // Send reorder to API (fire-and-forget, localStorage is the primary persistence)
    try {
      const payload = {
        order_number: job.order_code,
        destinations: resequenced.map(d => ({ id: d.id, sequence_number: d.sequence_number })),
      };
      console.log('[Reorder] invoking edge function reorder-destinations', payload);
      const { data, error } = await supabase.functions.invoke('reorder-destinations', {
        body: payload,
      });
      if (error) {
        console.error('[Reorder] API error:', error);
      } else {
        console.log('[Reorder] API success:', data);
      }
    } catch (e) {
      console.error('[Reorder] API exception:', e);
    }

    // Update tracking waypoints if GPS tracking is active (direct external API call)
    try {
      const trackingStateStr = localStorage.getItem('gps_tracking_state');
      if (trackingStateStr) {
        const trackingState = JSON.parse(trackingStateStr);
        if (trackingState.isTracking && trackingState.roomCode) {
          const waypoints = resequenced
            .filter(d => d.latitude && d.longitude && d.latitude !== 0 && d.longitude !== 0)
            .map(d => ({ lat: d.latitude!, lng: d.longitude! }));
          
          if (waypoints.length > 0) {
            const { data: wpData, error: wpError } = await supabase.functions.invoke('update-tracking-waypoints', {
              body: {
                room_code: trackingState.roomCode,
                waypoints,
              },
            });
            if (wpError) {
              console.error('Update tracking waypoints error:', wpError);
            } else {
              console.log('Update tracking waypoints success:', wpData);
            }
          }
        }
      }
    } catch (e) {
      console.error('Update tracking waypoints exception:', e);
    }
  };

  const scrollToDestination = (destId: string) => {
    const el = deliveryCardRefs.current.get(destId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="text-white px-4 py-3 sticky top-0 z-50 bg-[#dbedff]">
        <div className="flex items-center gap-3">
          <button onClick={() => {
          navigate(isFromHistory ? '/job-history' : '/current-jobs');
        }} className="p-1 -ml-1 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-black" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate bg-inherit text-black">
              {job.order_code}
              {job.transport_type?.includes('ขาเข้า') && ` (${t('jobDetail.inbound')})`}
              {job.transport_type?.includes('ขาออก') && ` (${t('jobDetail.outbound')})`}
            </h1>
          </div>
          <Badge
          variant="secondary"
          className={`text-black text-xs shrink-0 ${
          job.job_type === 'international' ? 'bg-orange-500/80' : 'bg-blue-400/80'}`
          }>

            {job.job_type === 'international' ? t('jobDetail.international') : t('jobDetail.domestic')}
          </Badge>
        </div>
        {job.booking_number &&
      <p className="text-[10px] text-white/50 mt-1 ml-7">{t('jobDetail.bookingNumber')}: {job.booking_number}</p>
      }
      </header>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Transferred Job Banner */}
        {isTransferred && isFromHistory && (
          <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-300 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></div>
            <span className="text-sm font-medium text-gray-600">{t('jobHistory.statusTransferred')}</span>
          </div>
        )}
        {/* Accident Evidence Lock Banner */}
        {accidentLocked && (
          <button
            type="button"
            onClick={() => setShowAccidentModal(true)}
            className="w-full flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl hover:bg-destructive/15 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
              <span className="text-destructive text-lg">⚠️</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-destructive">
                {t('accidentEvidence.title')}
              </div>
              <div className="text-xs text-destructive/80 mt-0.5">
                {t('accidentEvidence.subtitle')}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-destructive flex-shrink-0" />
          </button>
        )}
        <div className="flex items-center gap-2">
          {canViewPrice &&
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-base font-semibold">
              <span>฿</span>
              <span>{(job.price ?? 0).toLocaleString()}</span>
            </div>
        }
          <div className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-sm">
            <MapPin className="w-3.5 h-3.5" />
            <span>{destinations.length > 0 ? destinations.length + 1 : 2} {t('jobDetail.pickupDeliveryPoints')}</span>
          </div>
          {job.job_type !== 'international' &&
        <div className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-sm">
              <Package className="w-3.5 h-3.5" />
              <span>{job.origin_goods_quantity || '-'}</span>
            </div>
        }
        </div>

        {/* Report Problem Button - Hidden when viewing from history */}
        {new URLSearchParams(location.search).get('from') !== 'history' &&
      <button
        onClick={() => setIsReportDrawerOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium text-foreground">

            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M0 3.5C0 1.568 1.568 0 3.5 0H28.5C30.432 0 32 1.568 32 3.5V22.5C32 23.4283 31.6313 24.3185 30.9749 24.9749C30.3185 25.6313 29.4283 26 28.5 26H16.12L10.974 31.146C10.5661 31.5524 10.047 31.8289 9.48224 31.9407C8.91743 32.0525 8.33217 31.9946 7.80023 31.7743C7.26828 31.5539 6.81346 31.1811 6.49309 30.7027C6.17272 30.2243 6.00115 29.6618 6 29.086V26H3.5C2.57174 26 1.6815 25.6313 1.02513 24.9749C0.368749 24.3185 0 23.4283 0 22.5L0 3.5ZM3.5 3C3.36739 3 3.24021 3.05268 3.14645 3.14645C3.05268 3.24021 3 3.36739 3 3.5V22.5C3 22.776 3.224 23 3.5 23H7.5C7.89782 23 8.27936 23.158 8.56066 23.4393C8.84196 23.7206 9 24.1022 9 24.5V28.88L14.44 23.44C14.721 23.1586 15.1023 23.0004 15.5 23H28.5C28.6326 23 28.7598 22.9473 28.8536 22.8536C28.9473 22.7598 29 22.6326 29 22.5V3.5C29 3.36739 28.9473 3.24021 28.8536 3.14645C28.7598 3.05268 28.6326 3 28.5 3H3.5ZM17.5 7.5V12.5C17.5 12.8978 17.342 13.2794 17.0607 13.5607C16.7794 13.842 16.3978 14 16 14C15.6022 14 15.2206 13.842 14.9393 13.5607C14.658 13.2794 14.5 12.8978 14.5 12.5V7.5C14.5 7.10218 14.658 6.72064 14.9393 6.43934C15.2206 6.15804 15.6022 6 16 6C16.3978 6 16.7794 6.15804 17.0607 6.43934C17.342 6.72064 17.5 7.10218 17.5 7.5ZM18 18C18 18.5304 17.7893 19.0391 17.4142 19.4142C17.0391 19.7893 16.5304 20 16 20C15.4696 20 14.9609 19.7893 14.5858 19.4142C14.2107 19.0391 14 18.5304 14 18C14 17.4696 14.2107 16.9609 14.5858 16.5858C14.9609 16.2107 15.4696 16 16 16C16.5304 16 17.0391 16.2107 17.4142 16.5858C17.7893 16.9609 18 17.4696 18 18Z" fill="currentColor" className="text-muted-foreground" />
            </svg>
            <span>{t('jobDetail.reportProblem')}</span>
          </button>
      }

        {/* Container Return Deadline Banner — show whenever this is a container
            job and the driver has picked up the container but not returned it.
            Anchor: timestamp of the LATEST EIR scan; fallback to container pickup check-in.
            Default to 2 days if office didn't fill `container_free_days`. */}
        <ContainerReturnDeadlineBanner
          show={
            (!!job.bl_no || !!job.container_number || containerPickupConfirmed || emptyContainerCheckedIn) &&
            !!(latestEirAt || containerPickupAt) &&
            !containerReturnConfirmed
          }
          pickupAt={latestEirAt || containerPickupAt}
          containerFreeDays={
            (job as any).container_free_days ??
            (job as any).containerFreeDays ??
            (job as any).free_days ??
            2
          }
        />

        {/* Route Info */}
        <div>
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              {job.booking_no ? <>
                <FileText className="w-4 h-4 text-[#225795] shrink-0" />
                <span>Booking : {job.booking_no} ({t('jobDetail.outbound') || 'ขาออก'})</span>
              </> :
              job.bl_no ? <>
                <FileText className="w-4 h-4 text-[#225795] shrink-0" />
                <span>BL : {job.bl_no} ({t('jobDetail.inbound') || 'ขาเข้า'})</span>
              </> : <>
                <FileText className="w-4 h-4 text-[#225795] shrink-0" />
                <span>{job.job_type === 'international' ? t('jobDetail.booking') : t('jobDetail.order')} : {job.order_code}</span>
              </>}
            </h2>
          </div>

          {/* Quick-Nav Pills for Multi-Destination */}
          {!job.booking_no && displayDestinations.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <div className="flex items-center gap-1 flex-wrap flex-1">
                {displayDestinations.map((dest, idx) => {
                  const destCheckin = destCheckinById[dest.id];
                  const isPodDone = !!destCheckin?.sop_completed_at || !!dest.sop_completed_at;
                  return (
                    <button
                      key={dest.id}
                      onClick={() => { setActiveDestIdx(idx); scrollToDestination(dest.id); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                        activeDestIdx === idx ? 'bg-[#225795] text-white' :
                        isPodDone ? 'bg-green-100 text-green-700 border border-green-300' :
                        'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {t('jobDetail.deliveryPoint') || 'จุดส่ง'} {idx + 1}
                    </button>
                  );
                })}
              </div>
              {!isFromHistory && (
                <div className="flex items-center gap-1.5">
                  {voiceReorder.isSupported && displayDestinations.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={voiceReorder.isListening ? voiceReorder.stopListening : voiceReorder.startListening}
                      className={`h-7 w-7 p-0 rounded-lg shadow-sm ${
                        voiceReorder.isListening 
                          ? 'bg-red-500 text-white border-red-500 hover:bg-red-600 animate-pulse' 
                          : 'bg-white text-[#225795] border-[#225795]/40 hover:bg-[#225795]/5'
                      }`}
                      title="สั่งลำดับด้วยเสียง"
                    >
                      {voiceReorder.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  {/* Swap toggle button removed — drag-and-drop is always active.
                      Long-press 3s on a delivery card and drag it onto another card to swap. */}
                </div>
              )}
            </div>
          )}

          {/* Voice listening indicator */}
          {voiceReorder.isListening && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 animate-pulse">
              <Mic className="w-4 h-4 text-red-500" />
              <div className="flex-1">
                <p className="text-xs font-medium text-red-700">กำลังฟัง... พูดชื่อจุดส่งที่ต้องการ</p>
                {voiceReorder.transcript && (
                  <p className="text-[10px] text-red-500 mt-0.5">ได้ยิน: "{voiceReorder.transcript}"</p>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-600" onClick={voiceReorder.stopListening}>หยุด</Button>
            </div>
          )}

          {voiceReorder.error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
              {voiceReorder.error}
            </div>
          )}

          {showVoiceMatch && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs font-medium text-green-700">จะสลับ "{showVoiceMatch.name}" เป็นจุดถัดไป</p>
            </div>
          )}

          {/* Step Tracker + Content Wrapper */}
          <div className="relative flex gap-3">
            {/* Left Timeline Column with Continuous Line */}
            <div className="relative flex flex-col" style={{
            width: '28px',
            paddingTop: '8px'
          }}>
              {/* Continuous Vertical Line - only when multiple steps */}
              {(() => {
              const isInternational = job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ';
              const hasEmptyContainer = isInternational;
              const hasPickup = !job.bl_no;
              const hasDelivery = !job.booking_no;
              const deliveryCount = hasDelivery ? (destinations.length > 0 ? destinations.length : 1) : 0;
              const hasContainerReturn = isInternational && (job.container_return_location || job.container_return_latitude);
              const totalSteps = (hasEmptyContainer ? 1 : 0) + (hasPickup ? 1 : 0) + deliveryCount + (hasContainerReturn ? 1 : 0);
              return totalSteps > 1 ?
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300" style={{
                top: '8px',
                height: `calc(100% - 16px)`
              }} /> :
              null;
            })()}
              
              {/* Empty Container Circle - Only for international jobs */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') &&
            <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.emptyContainer || 200}px`
            }}>
                  <div className="absolute top-0">
                    {isContainerStepCompleted ?
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div> :
                emptyContainerCheckedIn ?
                <div className="w-7 h-7 rounded-full border-[3px] border-purple-500 bg-white shadow-sm" /> :

                <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />
                }
                  </div>
                </div>
            }

              {/* Step 1 Circle - Pickup Point (hidden for BL inbound jobs) */}
              {!job.bl_no &&
            <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {pickupSopCompleted || jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />}
                </div>
              </div>
            }

              {/* Delivery Point Circles - Hidden for Booking (outbound) jobs */}
              {!job.booking_no && (displayDestinations.length > 0 ? displayDestinations : [{
              id: 'fallback',
              sequence_number: 1
            }]).map((dest, index) => {
              const seq = dest.sequence_number;
              const destCheckinData = destCheckinById[dest.id];

              const isPodCompleted = dest.id === 'fallback' ?
              deliverySopCompleted
              : !!(destCheckinData?.sop_completed_at || dest.sop_completed_at);
              const isCheckedIn = dest.id === 'fallback' ?
              deliveryCheckedIn
              : !!(destCheckinData?.checked_in_at || dest.checked_in_at);

              return <div key={dest.id} className="relative flex justify-center" style={{
                height: `${cardHeights.deliveryCards[dest.id] || 200}px`,
                marginBottom: '12px'
              }}>
                  <div className="absolute top-0">
                    {isPodCompleted ?
                  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div> :
                  isCheckedIn ?
                  <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> :
                  pickupSopCompleted || jobApplication?.sop_completed_at ?
                  <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> :

                  <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />
                  }
                  </div>
                </div>;
            })}

              {/* Container Return Circle - Only for international jobs with return data */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && (
            job.container_return_location || job.container_return_latitude) &&
            <div className="relative flex justify-center" style={{
              height: `${cardHeights.containerReturn || 200}px`,
              marginBottom: '12px'
            }}>
                  <div className="absolute top-0">
                    {containerReturnConfirmed ?
                <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center shadow-sm">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div> :
                containerReturnCheckedIn ?
                <div className="w-7 h-7 rounded-full border-[3px] border-blue-500 bg-white shadow-sm" /> :

                <div className="w-7 h-7 rounded-full border-[3px] border-orange-500 bg-white shadow-sm" />
                }
                  </div>
                </div>
            }
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Empty Container Pickup Card - Only for international jobs */}
              {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') &&
            <Card ref={emptyContainerRef} className={`overflow-hidden border-2 rounded-2xl ${isContainerStepCompleted ? 'border-green-500' : emptyContainerCheckedIn ? 'border-purple-500' : 'border-teal-500'}`}>
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isContainerStepCompleted ? 'bg-green-500' : emptyContainerCheckedIn ? 'bg-purple-500' : 'bg-teal-600'}`}>
                    <h3 className="font-semibold text-sm text-white">{job.bl_no ? t('jobDetail.loadedContainerPickup') : t('jobDetail.emptyContainerPickup')}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20 inline-flex items-center gap-1">
                      {isContainerStepCompleted && <CheckCircle className="w-3 h-3" />}
                      {isContainerStepCompleted ?
                  t('jobDetail.completed') :
                  emptyContainerCheckedIn ?
                  (job.bl_no ? t('jobDetail.waitingEvidence') : t('jobDetail.waitingOCR')) :
                  t('jobDetail.waitingCheckIn')}
                    </span>
                  </div>
                  <div className="p-4 bg-white">
                    {(() => {
                      const isBl = !!job.bl_no;
                      const j: any = job;
                      const headline =
                        job.container_checkpoint ||
                        (isBl ? (j.container_return_location || j.container_return_address) : null) ||
                        job.empty_pickup_address ||
                        '-';
                      const dateValue = job.empty_pickup_date || job.empty_container_date || (isBl ? j.sender_pickup_date : null);
                      const timeValue = job.empty_pickup_time || (isBl ? j.sender_pickup_time : null);
                      const addressValue = job.empty_pickup_address || (isBl ? (j.container_return_address || j.container_return_location) : null);
                      return (
                        <>
                          <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                              <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.location')}</span>
                              <span className="font-semibold text-[#225795]">{headline}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                              <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.dateTime')}</span>
                              <span>{dateValue ? formatDate(dateValue, language) : '-'}{timeValue ? ` ${timeValue}` : ''}</span>
                            </div>
                            {addressValue && addressValue !== headline && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                                <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.address')}</span>
                                <span>{addressValue}</span>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                      <div className="hidden" />

                      {job.empty_pickup_phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.contactPerson') || 'ติดต่อ'}</span>
                          <span>{job.empty_pickup_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Container/Seal info - hide for BL (inbound) jobs */}
                    {!job.bl_no && (
                    <div className="space-y-2">
                      {/* Container 1 */}
                      <div className={`rounded-lg p-3 space-y-1.5 text-sm ${isContainerStepCompleted ? 'bg-green-50 border border-green-300' : 'bg-teal-50 border border-teal-200'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isContainerStepCompleted ? 'bg-green-500' : 'bg-teal-500'} text-white text-[10px] font-bold`}>1</span>
                          <span className={`font-medium ${isContainerStepCompleted ? 'text-green-700' : 'text-teal-700'}`}>{t('jobDetail.containerNumber')} : </span>
                          <span className="font-bold">{verifiedContainerNumber || job.container_number || '-'}</span>
                        </div>
                        <div className="ml-7">
                          <span className={`${isContainerStepCompleted ? 'text-green-700' : 'text-teal-700'}`}>{t('jobDetail.sealNumber')} : </span>
                          <span className="font-bold">{verifiedSealNumber || job.seal_number || '-'}</span>
                        </div>
                      </div>
                      
                      {/* Container 2 - only show if there's data */}
                      {(job.container_number_2 || job.seal_number_2) &&
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
                  }
                    </div>
                    )}

                    <div className="mt-3">
                      {isContainerStepCompleted ?
                  <div 
                    className="flex items-center justify-center gap-2 p-3 bg-green-100 rounded-lg border border-green-300 cursor-pointer hover:bg-green-150 active:bg-green-200 transition-colors"
                    onClick={() => {
                      const fromParam = new URLSearchParams(location.search).get('from');
                      const queryString = fromParam ? `?from=${fromParam}` : '';
                      navigate(`/job/${job.order_code}/container-summary${queryString}`, { state: { jobData: jobWithTransferFlag, checkinType: job.bl_no ? 'loaded_container' : 'empty_container', isBidJob } });
                    }}
                  >
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">{job.bl_no ? 'แนบหลักฐานสำเร็จแล้ว' : (t('jobDetail.ocrCompleted') || 'สแกน OCR เสร็จสิ้น')}</span>
                          <ChevronRight className="w-4 h-4 text-green-600 ml-auto" />
                        </div> :

                  <Button
                    size="sm"
                    className="w-full h-9 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white"
                    disabled={isTransferred && isFromHistory}
                    onClick={() => {
                      const fromParam = new URLSearchParams(location.search).get('from');
                      const queryString = fromParam ? `?from=${fromParam}` : '';
                      if (emptyContainerCheckedIn) {
                        const isInboundJob = !!job.bl_no || job.transport_type?.includes('ขาเข้า');
                        navigate(`/job/${job.order_code}/container-sop${queryString}`, { state: { jobData: jobWithTransferFlag, checkinType: isInboundJob ? 'loaded_container' : 'empty_container', isBidJob } });
                      } else {
                        navigate(`/job/${job.order_code}/container-checkin${queryString}`, { state: { jobData: jobWithTransferFlag, isBidJob } });
                      }
                    }}>

                          <img src={statusIcon} alt="status" className="w-3.5 h-3.5 hidden sm:block" />
                          <span className="text-xs">{emptyContainerCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                        </Button>
                  }
                    </div>
                  </div>
                </Card>
            }

              {/* Pickup Point Card */}
              {/* For international jobs, pickup is locked until empty container is checked in */}
              {/* For BL (inbound) jobs, hide pickup card entirely */}
              {!job.bl_no && (() => {
              const isInternationalJob = job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ';
              // Lock pickup if: international job AND (not checked in OR checked in but OCR not verified)
              const isPickupLocked = accidentLocked || (isInternationalJob && (!emptyContainerCheckedIn || emptyContainerCheckedIn && !isContainerStepCompleted));

              return (
                <Card ref={card1Ref} className={`overflow-hidden border-2 rounded-2xl ${pickupSopCompleted || jobApplication?.sop_completed_at ? 'border-green-500' : pickupCheckedIn ? 'border-teal-500' : isPickupLocked ? 'border-gray-300' : 'border-teal-500'}`}>
                    <div className={`px-4 py-2.5 flex items-center justify-between ${pickupSopCompleted || jobApplication?.sop_completed_at ? 'bg-green-500' : pickupCheckedIn ? 'bg-teal-600' : isPickupLocked ? 'bg-gray-400' : 'bg-teal-600'}`}>
                      <h3 className="font-semibold text-sm text-white">{t('jobDetail.pickupPoint')}</h3>
                      {isLoadingCheckinStatus ?
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white/80 bg-white/20">
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                          {t('common.checking')}
                        </span> :
                    isPickupLocked ?
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white/80 bg-white/20">
                          {t('jobDetail.waitingPreviousStep')}
                        </span> :

                    <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">
                          {pickupSopCompleted || jobApplication?.sop_completed_at ? t('jobDetail.sopSuccess') : pickupCheckedIn ? t('jobDetail.waitingSop') : t('jobDetail.waitingCheckIn')}
                        </span>
                    }
                    </div>
                    <div className={`p-4 ${isPickupLocked ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                      {job.origin_company_name &&
                    <p className="font-semibold text-sm text-[#225795] mb-2">{job.origin_company_name}</p>
                    }

                      <div className="space-y-1.5 text-xs text-foreground mb-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span><strong className="text-foreground">{t('jobDetail.location')}:</strong> {job.origin_location || '-'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span><strong className="text-foreground">{t('jobDetail.contactPerson')}:</strong> {(() => { const v = job.origin_contact_person; const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver']; return v && !generic.includes(v.trim()) ? v : '-'; })()}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span><strong className="text-foreground">{t('jobDetail.dateTime')}:</strong> {formatDate(job.start_date, language)} | {job.start_time ? job.start_time.substring(0, 5) : '-'}</span>
                        </div>
                        {job.origin_goods_type && job.origin_goods_type !== '-' &&
                      <div className="flex items-start gap-2">
                            <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                            <div className="flex-1 flex flex-wrap items-center gap-1">
                              <strong className="text-foreground mr-1">{t('jobDetail.goodsType')}:</strong>
                              {(() => {
                                const items = job.origin_goods_type!.split(/[,，、\/]/).map(s => s.trim()).filter(Boolean);
                                const display = items.slice(0, 3);
                                const remaining = items.length - 3;
                                return (
                                  <>
                                    {display.map((item, i) => (
                                      <span key={i} className="inline-block bg-blue-50 text-[#225795] text-xs px-2 py-0.5 rounded-full border border-blue-100 truncate max-w-[140px]">
                                        {item}
                                      </span>
                                    ))}
                                    {remaining > 0 && (
                                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                        +{remaining}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowGoodsModal(true)}
                              className="shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
                              aria-label="ดูสินค้าทั้งหมด"
                            >
                              <Eye className="w-4 h-4 text-[#225795]" />
                            </button>
                          </div>
                      }
                        {job.origin_remarks && job.origin_remarks !== '-' &&
                      <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                            <span>{job.origin_remarks}</span>
                          </div>
                      }
                      </div>

                      <div className={`grid gap-2 ${new URLSearchParams(location.search).get('from') === 'history' ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        {new URLSearchParams(location.search).get('from') !== 'history' &&
                      <>
                            <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5"
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
                          }}>

                              <Phone className="w-3.5 h-3.5" />
                              <span className="text-xs">{t('jobDetail.call')}</span>
                            </Button>
                            <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5"
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
                          }}>

                              <Navigation className="w-3.5 h-3.5" />
                              <span className="text-xs">{t('jobDetail.route')}</span>
                            </Button>
                          </>
                      }
                        <Button size="sm" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        const queryString = fromParam ? `?from=${fromParam}` : '';
                        if (pickupSopCompleted || jobApplication?.sop_completed_at) {
                          navigate(`/job/${job.order_code}/pickup-summary${queryString}`, { state: { jobData: jobWithTransferFlag, isBidJob } });
                        } else if (pickupCheckedIn || jobApplication?.checked_in_at) {
                          navigate(`/job/${job.order_code}/sop${queryString}`, { state: { jobData: jobWithTransferFlag, isBidJob } });
                        } else {
                          navigate(`/job/${job.order_code}/pickup${queryString}`, { state: { jobData: jobWithTransferFlag, isBidJob } });
                        }
                      }} className="h-9 flex items-center justify-center gap-1.5 p-1 bg-[#225896] border-transparent hover:bg-[#1a4578]" disabled={isPickupLocked || isLoadingCheckinStatus || (isTransferred && isFromHistory && !pickupCheckedIn && !pickupSopCompleted && !jobApplication?.checked_in_at && !jobApplication?.sop_completed_at)}>
                          {isLoadingCheckinStatus ?
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> :

                        <img src={statusIcon} alt="status" className="w-3.5 h-3.5 brightness-0 invert hidden sm:block" />
                        }
                          <span className="text-xs">{pickupSopCompleted || jobApplication?.sop_completed_at ? t('jobDetail.viewInfo') : pickupCheckedIn || jobApplication?.checked_in_at ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>);

            })()}


              {/* Delivery Point Cards - Hidden for Booking (outbound) jobs */}
              {!job.booking_no && (displayDestinations.length > 0 ? displayDestinations.map((dest, index) => {
              // Get check-in status from destinationCheckins state (enriched from API)
              const destCheckin = destCheckinById[dest.id];
              const isPodCompleted = !!destCheckin?.sop_completed_at || !!dest.sop_completed_at;
              const isCheckedIn = !!destCheckin?.checked_in_at || !!dest.checked_in_at;

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
                const prevDest = displayDestinations[index - 1];
                const prevCheckin = destCheckinById[prevDest?.id];
                return !!prevCheckin?.sop_completed_at || !!prevDest?.sop_completed_at;
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

              const canDrag = displayDestinations.length > 1 && !isCheckedIn && !isPodCompleted && !isFromHistory;
              const isDragging = dragIdx === index;
              const isDragTarget = dragOverIdx === index && dragIdx !== null && dragIdx !== index;
              const isLongPressActive = longPressIdx === index;
              const isReorderMode = longPressIdx !== null || dragIdx !== null;

              const clearLongPress = () => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
                setLongPressIdx(null);
                setDragIdx(null);
                setDragOverIdx(null);
                dragOverIdxRef.current = null;
                dragItemRef.current = null;
              };

              return (
                <Card
                  key={dest.id}
                  ref={(el) => {if (el) deliveryCardRefs.current.set(dest.id, el);else deliveryCardRefs.current.delete(dest.id);}}
                  data-reorder-idx={index}
                  draggable={canDrag && isLongPressActive && !('ontouchstart' in window)}
                  onMouseDown={(e) => {
                    if (!canDrag) return;
                    // Only handle non-touch (mouse) — touch handled by onTouchStart
                    if ((e as any).pointerType === 'touch') return;
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                     longPressTimerRef.current = setTimeout(() => {
                       setLongPressIdx(index);
                       if (navigator.vibrate) navigator.vibrate(50);
                       requestAnimationFrame(() => {
                         requestAnimationFrame(() => {
                           const el = deliveryCardRefs.current.get(dest.id);
                           el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         });
                       });
                      }, 500);
                   }}
                   onMouseUp={() => {
                    if (longPressTimerRef.current && dragItemRef.current === null) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    if (longPressTimerRef.current && dragItemRef.current === null) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onDragStart={(e) => {
                    if (!canDrag || !isLongPressActive) { e.preventDefault(); return; }
                    setDragIdx(index);
                    dragItemRef.current = index;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (dragItemRef.current === null) return;
                    if (isCheckedIn || isPodCompleted) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverIdx(index);
                     dragOverIdxRef.current = index;
                  }}
                  onDragLeave={() => {
                     if (dragOverIdx === index) {
                       setDragOverIdx(null);
                       dragOverIdxRef.current = null;
                     }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isCheckedIn || isPodCompleted) return;
                    const fromIdx = dragItemRef.current;
                    if (fromIdx !== null && fromIdx !== index) {
                      handleSwapRequest(fromIdx, index);
                    }
                    setDragIdx(null);
                    setDragOverIdx(null);
                     dragOverIdxRef.current = null;
                    dragItemRef.current = null;
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDragOverIdx(null);
                     dragOverIdxRef.current = null;
                    dragItemRef.current = null;
                    setLongPressIdx(null);
                  }}
                  onTouchStart={(e) => {
                    if (!canDrag) return;
                    dragStartY.current = e.touches[0].clientY;
                    // Start long-press timer to enable drag
                    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                     longPressTimerRef.current = setTimeout(() => {
                       setLongPressIdx(index);
                       setDragIdx(index);
                       dragItemRef.current = index;
                       // Haptic feedback if available
                       if (navigator.vibrate) navigator.vibrate(50);
                       // Scroll the active card into view since other cards collapse
                       requestAnimationFrame(() => {
                         requestAnimationFrame(() => {
                           const el = deliveryCardRefs.current.get(dest.id);
                           el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         });
                       });
                      }, 500);
                   }}
                  onTouchMove={(e) => {
                    // If user moves significantly before 3s, cancel long-press (treat as scroll)
                    if (dragItemRef.current === null) {
                      const dy = Math.abs(e.touches[0].clientY - dragStartY.current);
                      if (dy > 10 && longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      return;
                    }
                     e.preventDefault();
                    // Drag in progress: detect target
                    const touch = e.touches[0];
                    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
                    const cardEl = elements.map(el => el.closest('[data-reorder-idx]')).find(Boolean);
                    if (cardEl) {
                      const overIdx = parseInt(cardEl.getAttribute('data-reorder-idx')!, 10);
                      setDragOverIdx(overIdx);
                       dragOverIdxRef.current = overIdx;
                    }
                  }}
                  onTouchEnd={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                    if (dragItemRef.current !== null) {
                      const fromIdx = dragItemRef.current;
                       const toIdx = dragOverIdxRef.current;
                       if (toIdx !== null && fromIdx !== toIdx) {
                         handleSwapRequest(fromIdx, toIdx);
                      }
                    }
                    setDragIdx(null);
                    setDragOverIdx(null);
                     dragOverIdxRef.current = null;
                    dragItemRef.current = null;
                    setLongPressIdx(null);
                  }}
                  onTouchCancel={clearLongPress}
                  onContextMenu={(e) => { if (canDrag) e.preventDefault(); }}
                  onClick={() => {
                    // Tap-to-swap when in reorder mode: tap another card to swap with the selected one
                    if (isReorderMode && longPressIdx !== null && longPressIdx !== index && canDrag) {
                      handleSwapRequest(longPressIdx, index);
                      setDragIdx(null);
                      setDragOverIdx(null);
                       dragOverIdxRef.current = null;
                      dragItemRef.current = null;
                      setLongPressIdx(null);
                    }
                  }}
                  style={{
                    touchAction: isReorderMode ? 'none' : undefined,
                    WebkitUserSelect: canDrag ? 'none' : undefined,
                    userSelect: canDrag ? 'none' : undefined,
                    WebkitTouchCallout: canDrag ? 'none' : undefined,
                  } as React.CSSProperties}
                  className={`overflow-hidden border-2 rounded-xl transition-all ${
                    isPodCompleted ? 'border-green-500' : isPreviousCompleted ? 'border-teal-500' : 'border-gray-300'
                  } ${isDragging ? 'opacity-80 shadow-2xl scale-[1.02] z-10' : ''} ${isDragTarget ? 'ring-2 ring-orange-400 ring-offset-1' : ''} ${isLongPressActive ? 'ring-2 ring-blue-400' : ''} ${isReorderMode && !isLongPressActive ? 'cursor-pointer hover:bg-orange-50' : ''} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                    <div className={`px-3 py-1.5 flex items-center justify-between ${isPodCompleted ? 'bg-green-500' : isPreviousCompleted ? 'bg-teal-600' : 'bg-gray-400'}`}>
                      <h3 className="font-medium text-xs text-white truncate">
                        {t('jobDetail.deliveryPoint')} {displayDestinations.length > 1 ? `#${index + 1}` : ''}
                        {isReorderMode && (() => {
                          const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver'];
                          const company = dest.company_name && !generic.includes(dest.company_name.trim()) ? dest.company_name : null;
                          const contact = dest.contact_name && !generic.includes(dest.contact_name.trim()) ? dest.contact_name : null;
                          const locationLabel = dest.district && dest.province ? `${dest.district}, ${dest.province}` : (dest.province || dest.district || null);
                          const rawLabel = company || contact || locationLabel;
                          const label = rawLabel && rawLabel.length > 20 ? `${rawLabel.slice(0, 20)}...` : rawLabel;
                          return label ? <span className="ml-2 font-normal opacity-90">· {label}</span> : null;
                        })()}
                      </h3>
                      {isDestinationLocked ?
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white/80 bg-white/20">
                          {t('jobDetail.waitingPreviousStep')}
                        </span> :
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">
                          {statusInfo.text}
                        </span>
                    }
                    </div>
                    {(!isReorderMode || isLongPressActive || isDragging) && (
                    <div className={`p-3 ${isDestinationLocked ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                      <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.location') || 'ที่อยู่'}</span>
                          <span>{(() => {
                            const placeName = (dest as any).location_name || (dest as any).name || dest.company_name;
                            return placeName || (dest.district && dest.province ? `${dest.district}, ${dest.province}` : (dest.province || dest.district || (dest as any).address || '-'));
                          })()}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.contactPerson') || 'ผู้ติดต่อ'}</span>
                          <span>{(() => { const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver']; const contact = dest.contact_name && !generic.includes(dest.contact_name.trim()) ? dest.contact_name : null; return contact || '-'; })()}</span>
                        </div>
                        {dest.invoice_number && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span className="font-medium text-[#454545] min-w-[50px]">{t('job.invoice') || 'INV'}</span>
                          <span>{dest.invoice_number}</span>
                        </div>
                        )}
                        <div className="flex items-start gap-2">
                          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.dateTime') || 'เวลา'}</span>
                          <span>{dest.delivery_date ? formatDate(dest.delivery_date, language) : '-'} | {dest.delivery_time ? dest.delivery_time.substring(0, 5) : '-'}</span>
                        </div>
                        {(() => {
                          // Collect all product items for this destination
                          let allItems: { label: string }[] = [];
                          if (Array.isArray(dest.products) && dest.products.length > 0) {
                            allItems = dest.products.map((p) => ({ label: p.product_name || p.name || '-' }));
                          } else {
                            const goodsStr = dest.goods_type || job.origin_goods_type;
                            if (goodsStr) {
                              allItems = goodsStr.split(/[,，、\/]/).map(s => s.trim()).filter(Boolean).map(s => ({ label: s }));
                            }
                          }
                          const maxShow = 3;
                          const display = allItems.slice(0, maxShow);
                          const remaining = allItems.length - maxShow;
                          return (
                            <div className="flex items-start gap-2">
                              <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                              <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.goodsType') || 'สินค้า'}</span>
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="inline-flex items-center justify-center bg-[#225795] text-white text-xs font-semibold px-2 py-0.5 rounded-full min-w-[24px]">
                                  {allItems.length}
                                </span>
                                {display.length > 0 ? display.map((item, i) => (
                                  <span key={i} className="inline-block bg-blue-50 text-[#225795] text-xs px-2 py-0.5 rounded-full border border-blue-100 truncate max-w-[140px]">
                                    {item.label}
                                  </span>
                                )) : <span>-</span>}
                                {remaining > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGoodsModalDestIndex(index);
                                    }}
                                    className="inline-flex items-center gap-1 bg-blue-50 text-[#225795] text-xs px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    +{remaining}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        {dest.notes && dest.notes !== '-' &&
                      <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                            <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.remarks') || 'หมายเหตุ'}</span>
                            <span>{dest.notes}</span>
                          </div>
                      }
                      </div>

                      <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        {!isFromHistory &&
                      <>
                            <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={isDestinationLocked || isPodCompleted}
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
                              <Phone className="w-3.5 h-3.5" />
                              <span className="text-xs">{t('jobDetail.call')}</span>
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={isDestinationLocked || isPodCompleted}
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
                              <Navigation className="w-3.5 h-3.5" />
                              <span className="text-xs">{t('jobDetail.route')}</span>
                            </Button>
                          </>
                      }
                        <Button size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-transparent bg-[#225896] hover:bg-[#1a4578]" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        navigate(`/job/${job.order_code}/delivery/${dest.sequence_number}${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: jobWithTransferFlag, destId: dest.id, reorderedSequence: dest.sequence_number, isBidJob } });
                      }} disabled={isDestinationLocked || (isTransferred && isFromHistory && !isCheckedIn && !isPodCompleted)}>
                          <img src={statusIcon} alt="status" className="w-3.5 h-3.5 brightness-0 invert hidden sm:block" />
                          <span className="text-xs">{isPodCompleted ? t('jobDetail.viewInfo') : isCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                    )}
                  </Card>);

            }) :
            // Fallback to original single destination from jobs table
            (() => {
              // Use ONLY actual check-in status from API, NOT jobApplication data
              const isPodCompleted = deliverySopCompleted;
              // For BL (inbound) jobs, unlock after OCR/container SOP instead of pickup SOP
              const isFallbackUnlocked = job.bl_no ?
              isOcrVerified || !!jobApplication?.container_sop_completed_at :
              pickupSopCompleted || !!jobApplication?.sop_completed_at;

              return (
                <Card ref={(el) => {if (el) deliveryCardRefs.current.set('fallback', el);else deliveryCardRefs.current.delete('fallback');}} className={`overflow-hidden border-2 rounded-2xl ${isPodCompleted ? 'border-green-500' : isFallbackUnlocked ? 'border-teal-500' : 'border-gray-300'}`}>
                  <div className={`px-4 py-2.5 flex items-center justify-between ${isPodCompleted ? 'bg-green-500' : isFallbackUnlocked ? 'bg-teal-600' : 'bg-gray-400'}`}>
                    <h3 className="font-semibold text-sm text-white">{t('jobDetail.deliveryPoint')}</h3>
                    {!isFallbackUnlocked ?
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white/80 bg-white/20">
                        {t('jobDetail.waitingPreviousStep')}
                      </span> :

                    <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">
                        {isPodCompleted ? t('jobDetail.podSuccess') : deliveryCheckedIn ? t('jobDetail.waitingPod') : t('jobDetail.waitingCheckIn')}
                      </span>
                    }
                  </div>
                  <div className={`p-4 ${!isFallbackUnlocked ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                    {job.destination_company_name &&
                    <p className="font-semibold text-sm text-[#225795] mb-2">{job.destination_company_name}</p>
                    }

                    <div className="space-y-1.5 text-xs text-foreground mb-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                        <span><strong className="text-foreground">{t('jobDetail.location')}:</strong> {job.destination_location || '-'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                        <span><strong className="text-foreground">{t('jobDetail.contactPerson')}:</strong> {job.destination_contact_person || '-'}</span>
                      </div>
                      {job.destination_bill_of_lading && job.destination_bill_of_lading !== '-' && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span><strong className="text-foreground">{t('job.invoice') || 'ใบแจ้งหนี้'}:</strong> {job.destination_bill_of_lading}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                        <span><strong className="text-foreground">{t('jobDetail.dateTime')}:</strong> {job.destination_date ? formatDate(job.destination_date, language) : formatDate(job.start_date, language)} | {job.destination_time ? job.destination_time.substring(0, 5) : '-'}</span>
                      </div>
                      {(job.destination_goods_type || job.origin_goods_type) && (
                        <div className="flex items-start gap-2">
                          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span>
                            <strong className="text-foreground">{t('jobDetail.goodsType') || 'สินค้า'}:</strong>{' '}
                            {(() => {
                              // Show from products array if available
                              if (job.products && job.products.length > 0) {
                                return job.products.map((p, i) => {
                                  const name = p.product_name || p.name || '-';
                                  const qty = p.product_quantity || p.quantity;
                                  const weight = p.product_weight || p.weight;
                                  const unit = p.quantity_unit || p.product_unit || '';
                                  const weightUnit = p.weight_unit || 'กก.';
                                  let label = name;
                                  if (qty) label += ` x${qty}${unit ? ' ' + translateUnit(unit, language) : ''}`;
                                  if (weight) label += ` (${weight} ${translateUnit(weightUnit, language)})`;
                                  return <span key={i}>{i > 0 ? ', ' : ''}{label}</span>;
                                });
                              }
                              // Fallback to goods_type string
                              const goodsStr = job.destination_goods_type || job.origin_goods_type;
                              if (!goodsStr || goodsStr === '-') return '-';
                              const qtyStr = job.destination_goods_quantity || job.origin_goods_quantity;
                              return qtyStr ? `${goodsStr} (${qtyStr})` : goodsStr;
                            })()}
                          </span>
                        </div>
                      )}
                      {job.destination_remarks && job.destination_remarks !== '-' && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#225795]" />
                          <span><strong className="text-foreground">{t('jobDetail.remarks') || 'หมายเหตุ'}:</strong> {job.destination_remarks}</span>
                        </div>
                      )}
                    </div>

                    <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      {!isFromHistory &&
                      <>
                          <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={!isFallbackUnlocked || isPodCompleted}
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
                            <Phone className="w-3.5 h-3.5" />
                            <span className="text-xs">{t('jobDetail.call')}</span>
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={!isFallbackUnlocked || isPodCompleted}
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
                            <Navigation className="w-3.5 h-3.5" />
                            <span className="text-xs">{t('jobDetail.route')}</span>
                          </Button>
                        </>
                      }
                      <Button size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-transparent bg-[#225896] hover:bg-[#1a4578]" onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        navigate(`/job/${job.order_code}/delivery${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: jobWithTransferFlag, isBidJob } });
                      }} disabled={!isFallbackUnlocked || (isTransferred && isFromHistory && !deliveryCheckedIn && !isPodCompleted)}>
                        <img src={statusIcon} alt="status" className="w-3.5 h-3.5 brightness-0 invert hidden sm:block" />
                        <span className="text-xs">{isPodCompleted ? t('jobDetail.viewInfo') : deliveryCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                      </Button>
                    </div>
                  </div>
                </Card>);

            })())}

            {/* Container Return Card - Only for international jobs, unlocked after all deliveries completed */}
            {(job.job_type === 'international' || job.job_type === 'ภายนอกประเทศ' || job.job_type === 'นอกประเทศ') && (
            job.container_return_location || job.container_return_latitude) && (() => {
              // For booking (outbound) jobs without delivery, unlock after pickup SOP
              const allDeliveriesCompleted = job.booking_no
                ? (pickupSopCompleted || !!jobApplication?.sop_completed_at)
                : (displayDestinations.length > 0 ?
                  displayDestinations.every((dest) => {
                    const destCheckin = destCheckinById[dest.id];
                    return !!destCheckin?.sop_completed_at || !!dest.sop_completed_at;
                  }) :
                  deliverySopCompleted);

              return (
                <Card ref={containerReturnRef} className={`overflow-hidden border-2 rounded-2xl ${containerReturnConfirmed ? 'border-green-500' : containerReturnCheckedIn ? 'border-blue-500' : allDeliveriesCompleted ? 'border-teal-500' : 'border-gray-300'}`}>
                <div className={`px-4 py-2.5 flex items-center justify-between ${containerReturnConfirmed ? 'bg-green-500' : containerReturnCheckedIn ? 'bg-blue-500' : allDeliveriesCompleted ? 'bg-teal-600' : 'bg-gray-400'}`}>
                  <h3 className="font-semibold text-sm text-white">จุดคืนตู้คอนเทนเนอร์</h3>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">
                    {!allDeliveriesCompleted ? t('jobDetail.waitingPreviousStep') : containerReturnConfirmed ? 'คืนตู้สำเร็จ' : containerReturnCheckedIn ? 'รอแนบเอกสาร' : t('jobDetail.waitingCheckIn')}
                  </span>
                </div>
                <div className={`p-4 ${!allDeliveriesCompleted ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                  {/* Show yard name - either from OCR or from job data */}
                  {returnSlipYardName ? (
                    <div className="flex items-center gap-2 mb-2">
                      <Scan className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="font-semibold text-sm text-green-700">{returnSlipYardName}</p>
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">OCR</span>
                    </div>
                  ) : job.container_return_location ? (
                    <p className="font-semibold text-sm text-[#225795] mb-2">{job.container_return_location}</p>
                  ) : null}

                  {/* Show OCR scan button when yard is not specified */}
                  {(!job.container_return_location || job.container_return_location === 'ดูลานที่หน้างาน' || job.container_return_location === '-') && !returnSlipYardName && !isFromHistory && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs text-amber-700 mb-2 flex items-center gap-1.5">
                        <Scan className="w-3.5 h-3.5" />
                        ยังไม่ระบุลานคืนตู้ — สแกนใบคืนตู้เพื่ออ่านชื่อลาน
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 border-amber-400 text-amber-700 hover:bg-amber-100"
                        disabled={!allDeliveriesCompleted || isProcessingReturnSlipOcr || extracting}
                        onClick={() => setShowReturnSlipDrawer(true)}
                      >
                        {isProcessingReturnSlipOcr || extracting ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> กำลังอ่านข้อมูล...</>
                        ) : (
                          <><Scan className="w-4 h-4 mr-1.5" /> สแกนใบคืนตู้</>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Show OCR extracted data */}
                  {returnSlipOcrData && (returnSlipOcrData.container_number || returnSlipOcrData.return_date) && (
                    <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-xl space-y-1 text-xs">
                      {returnSlipOcrData.container_number && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-700 font-medium">เลขตู้:</span>
                          <span className="text-green-800 font-semibold">{returnSlipOcrData.container_number}</span>
                        </div>
                      )}
                      {returnSlipOcrData.seal_number && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-700 font-medium">เลขซีล:</span>
                          <span className="text-green-800 font-semibold">{returnSlipOcrData.seal_number}</span>
                        </div>
                      )}
                      {returnSlipOcrData.return_date && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-700 font-medium">วันที่คืน:</span>
                          <span className="text-green-800">{returnSlipOcrData.return_date}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#225795] mt-0.5 shrink-0" />
                      <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.location') || 'ที่อยู่'}</span>
                      <span className="text-[#454545]">{job.container_return_address || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#225795] shrink-0" />
                      <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.dateTime') || 'วันที่'}</span>
                      <span className="text-[#454545]">{job.container_return_date ? formatDate(job.container_return_date, language) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#225795] shrink-0" />
                      <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.contactPerson') || 'ติดต่อ'}</span>
                      <span className="text-[#454545]">{job.container_return_phone || '-'}</span>
                    </div>
                  </div>

                  <div className={`grid gap-2 ${isFromHistory ? 'grid-cols-1' : 'grid-cols-3'}`}>
                    {!isFromHistory &&
                      <>
                        <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={!allDeliveriesCompleted || containerReturnConfirmed}
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
                          <Phone className="w-3.5 h-3.5" />
                          <span className="text-xs">{t('jobDetail.call')}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-[#225795]/30 text-[#225795] hover:bg-[#225795]/5" disabled={!allDeliveriesCompleted || containerReturnConfirmed}
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
                          <Navigation className="w-3.5 h-3.5" />
                          <span className="text-xs">{t('jobDetail.route')}</span>
                        </Button>
                      </>
                      }
                    <Button size="sm" className="h-9 flex items-center justify-center gap-1.5 p-1 border-transparent bg-[#225896] hover:bg-[#1a4578]" disabled={!allDeliveriesCompleted || (isTransferred && isFromHistory && !containerReturnCheckedIn && !containerReturnConfirmed)}
                      onClick={() => {
                        const fromParam = new URLSearchParams(location.search).get('from');
                        if (containerReturnConfirmed) {
                          navigate(`/job/${job.order_code}/container-summary${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: jobWithTransferFlag, checkinType: 'container_return', isBidJob } });
                        } else if (containerReturnCheckedIn) {
                          navigate(`/job/${job.order_code}/container-sop${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: jobWithTransferFlag, checkinType: 'container_return', isBidJob } });
                        } else {
                          navigate(`/job/${job.order_code}/container-checkin${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: jobWithTransferFlag, checkinType: 'container_return', isBidJob } });
                        }
                      }}>
                        <img src={statusIcon} alt="status" className="w-3.5 h-3.5 brightness-0 invert hidden sm:block" />
                        <span className="text-xs">{containerReturnConfirmed ? t('jobDetail.viewInfo') : containerReturnCheckedIn ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
                      </Button>
                  </div>
                </div>
              </Card>);

            })()}
            </div>
          </div>
        </div>
      </div>


      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={job.id} orderNumber={job.order_code} />

      {/* Accident Evidence — auto-opened when job is locked */}
      <AccidentEvidenceModal
        open={showAccidentModal}
        onOpenChange={setShowAccidentModal}
        orderId={job.id}
        orderNumber={job.order_code}
        onSuccess={() => {
          setAccidentLocked(false);
          // Mutate flag in-place so re-render reflects unlocked state without refetch
          (job as any).requires_accident_evidence = false;
          onUpdate?.();
        }}
      />
      
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
            disabled={isProcessingOcr || extracting}>

              <Camera className="w-6 h-6" />
              {t('sop.takePhoto')}
            </Button>
            <Button
            variant="outline"
            className="w-full h-14 text-base justify-start gap-3"
            onClick={() => handleOcrPhotoSelect('gallery')}
            disabled={isProcessingOcr || extracting}>

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
                onChange={(e) => setOcrResult((prev) => prev ? { ...prev, container_number: e.target.value } : { container_number: e.target.value, seal_number: null })}
                placeholder={t('ocr.enterContainerNumber') || 'กรอกเลขตู้'}
                className="text-lg font-bold bg-white" />

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
                onChange={(e) => setOcrResult((prev) => prev ? { ...prev, seal_number: e.target.value } : { container_number: null, seal_number: e.target.value })}
                placeholder={t('ocr.enterSealNumber') || 'กรอกเลขซีล'}
                className="text-lg font-bold bg-white" />

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
            disabled={isVerifying}>

              <XCircle className="w-5 h-5" />
              {t('ocr.retake') || 'ถ่ายใหม่'}
            </Button>
            <Button
            className="flex-1 h-12 gap-2 bg-teal-500 hover:bg-teal-600 text-white"
            onClick={handleConfirmOcr}
            disabled={isVerifying || !ocrResult?.container_number}>

              {isVerifying ?
            <Loader2 className="w-5 h-5 animate-spin" /> :

            <CheckCircle className="w-5 h-5" />
            }
              {isVerifying ? t('containerSealVerification.verifying') || 'กำลังตรวจสอบ...' : t('ocr.confirm') || 'ยืนยัน'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Return Slip OCR Drawer */}
      <Drawer open={showReturnSlipDrawer} onOpenChange={setShowReturnSlipDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">สแกนใบคืนตู้</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 text-center text-sm text-muted-foreground">
            ถ่ายรูปหรือเลือกรูปใบคืนตู้เพื่ออ่านชื่อลาน
          </div>
          <DrawerFooter className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2"
              onClick={() => handleReturnSlipOcr('camera')}
            >
              <Camera className="w-5 h-5" />
              ถ่ายรูป
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 gap-2"
              onClick={() => handleReturnSlipOcr('gallery')}
            >
              <ImageIcon className="w-5 h-5" />
              เลือกรูป
            </Button>
          </DrawerFooter>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="ghost">ยกเลิก</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Swap is now instant via drag-and-drop — no confirmation dialog */}

      {/* Goods Detail Modal */}
      <Dialog open={showGoodsModal} onOpenChange={setShowGoodsModal}>
        <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#225795]">
              <Package className="w-5 h-5" />
              {t('jobDetail.goodsType') || 'สินค้า'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Check if destinations have per-destination products */}
            {(() => {
              const destinations = job.destinations || [];
              const hasDestProducts = destinations.some(d => Array.isArray(d.products) && d.products.length > 0);

              if (hasDestProducts) {
                // Show products grouped by destination
                return (
                  <>
                    {/* Pickup point header */}
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="font-semibold text-sm text-foreground">{t('jobDetail.pickupPoint') || 'จุดรับสินค้า'}</span>
                    </div>
                    {(() => {
                      const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver'];
                      const name = job.origin_company_name && !generic.includes(job.origin_company_name.trim()) ? job.origin_company_name : (job.origin_location || null);
                      return name ? <p className="text-sm font-medium text-foreground ml-6">{name}</p> : null;
                    })()}

                    {destinations.map((dest, destIdx) => {
                      const destProducts = Array.isArray(dest.products) ? dest.products : [];
                      if (destProducts.length === 0) return null;
                      return (
                        <div key={destIdx} className="space-y-2">
                          <div className="flex items-center gap-2 mt-3">
                            <MapPin className="w-4 h-4 text-red-500" />
                            <span className="font-semibold text-sm text-foreground">
                              {t('job.destination')} #{dest.sequence_number || destIdx + 1}
                            </span>
                          </div>
                          {dest.company_name && (
                            <p className="text-xs text-muted-foreground ml-6">{dest.company_name}</p>
                          )}
                          <div className="space-y-2 ml-6">
                            {destProducts.map((product: any, idx: number) => {
                              const name = product.product_name || product.name || '-';
                              const weight = product.product_weight || product.weight;
                              const weightUnit = translateUnit(product.weight_unit || 'kg', language);
                              const qty = product.product_quantity || product.quantity;
                              const qtyUnit = translateUnit(product.quantity_unit || product.product_unit || product.unit || 'pcs', language);
                              return (
                                <div key={idx} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    {name}
                                  </p>
                                  <div className="flex gap-4 text-xs text-muted-foreground">
                                    <span>{t('jobDetail.weight') || 'น้ำหนัก'}: {weight ? `${weight} ${weightUnit}` : '-'}</span>
                                    <span>{t('jobDetail.quantity') || 'จำนวน'}: {qty ? `${qty} ${qtyUnit}` : '-'}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              }

              // Fallback: show top-level products or parsed goods_type
              return (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-sm text-foreground">{t('jobDetail.pickupPoint') || 'จุดรับสินค้า'}</span>
                  </div>
                  {job.origin_company_name && (
                    <p className="text-sm font-medium text-foreground ml-6">{job.origin_company_name}</p>
                  )}
                  {job.products && job.products.length > 0 ? (
                    <div className="space-y-2 ml-6">
                      {job.products.map((product, idx) => {
                        const name = product.product_name || product.name || '-';
                        const weight = product.product_weight || product.weight;
                        const weightUnit = translateUnit(product.weight_unit || 'kg', language);
                        const qty = product.product_quantity || product.quantity;
                        const qtyUnit = translateUnit(product.quantity_unit || product.product_unit || 'pcs', language);
                        return (
                          <div key={idx} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {t('jobDetail.goodsType') || 'สินค้า'} {job.products!.length > 1 ? idx + 1 : ''}: {name}
                            </p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>{t('jobDetail.weight') || 'น้ำหนัก'}: {weight ? `${weight} ${weightUnit}` : '-'}</span>
                              <span>{t('jobDetail.quantity') || 'จำนวน'}: {qty ? `${qty} ${qtyUnit}` : '-'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 ml-6">
                      {job.origin_goods_type && job.origin_goods_type !== '-' ? (
                        job.origin_goods_type.split(/[,，、\/]/).map((s: string) => s.trim()).filter(Boolean).map((item: string, idx: number) => (
                          <div key={idx} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {t('jobDetail.goodsType') || 'สินค้า'} {idx + 1}: {item}
                            </p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>{t('jobDetail.weight') || 'น้ำหนัก'}: -</span>
                              <span>{t('jobDetail.quantity') || 'จำนวน'}: {job.origin_goods_quantity || '-'}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('common.noData') || 'ไม่มีข้อมูล'}</p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
      {/* Destination Goods Modal */}
      <Dialog open={goodsModalDestIndex !== null} onOpenChange={(open) => { if (!open) setGoodsModalDestIndex(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {t('job.goods') || 'สินค้า'} - {t('job.destination') || 'ปลายทาง'} #{(goodsModalDestIndex ?? 0) + 1}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(() => {
              if (goodsModalDestIndex === null) return null;
              const destinations = Array.isArray(job.destinations) ? job.destinations : [];
              const dest = destinations[goodsModalDestIndex];
              if (!dest) return <p className="text-sm text-muted-foreground">{t('common.noData') || 'ไม่มีข้อมูล'}</p>;

              let items: { label: string; qty?: string; weight?: string }[] = [];
              if (Array.isArray(dest.products) && dest.products.length > 0) {
                items = dest.products.map((p: any) => ({
                  label: p.product_name || p.name || '-',
                  qty: p.quantity || p.qty || null,
                  weight: p.weight || null,
                }));
              } else {
                const goodsStr = dest.goods_type || job.origin_goods_type;
                if (goodsStr) {
                  items = goodsStr.split(/[,，、\/]/).map((s: string) => s.trim()).filter(Boolean).map((s: string) => ({ label: s }));
                }
              }

              if (items.length === 0) return <p className="text-sm text-muted-foreground">{t('common.noData') || 'ไม่มีข้อมูล'}</p>;

              return items.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{i + 1}. {item.label}</p>
                  {(item.qty || item.weight) && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {item.weight && <span>{t('jobDetail.weight') || 'น้ำหนัก'}: {item.weight}</span>}
                      {item.qty && <span>{t('jobDetail.quantity') || 'จำนวน'}: {item.qty}</span>}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}