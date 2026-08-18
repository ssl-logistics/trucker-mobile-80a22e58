import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle, Image as ImageIcon, Scan, Loader2, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getDriverAssignedJobs, getFreelanceAcceptedJobs, submitOcrScan, verifyOcrContainer, driverCheckin, updateOrderStatus, getExpenses, getDriverCheckins, getOcrContainerScans } from '@/lib/externalApi';
import { addOptimisticCheckin } from '@/utils/optimisticCheckins';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { useOCR } from "@/hooks/useOCR";
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { compressImage } from '@/utils/imageCompression';

interface ContainerDetail {
  containerNo?: string;
  sealNo?: string;
}

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  container_checkpoint: string;
  container_number: string;
  seal_number: string;
  container_number_2?: string;
  seal_number_2?: string;
  start_date: string;
  start_time: string;
  bl_no?: string;
  booking_no?: string;
  transport_type?: string;
  container_details: ContainerDetail[];
  container_return_location?: string;
  closing_time?: string;
}

type PhotoSlot = 'container' | 'seal' | 'eir' | 'bl_angle' | 'bl_eir' | 'trailer_plate';
type ActiveEirIndex = number | 'new';

const ContainerSOPPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const { t, language } = useLanguage();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();
  const { extractFromImage, extracting } = useOCR();
  
  const navState = location.state as { 
    verifiedContainer?: string; 
    verifiedSeal?: string; 
    ocrVerified?: boolean;
    jobData?: any;
    checkinType?: string;
  } | null;
  const isContainerReturn = navState?.checkinType === 'container_return';
  const checkinTypeFromState = navState?.checkinType;
  
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  
  const isInboundFromJobData = !!jobDetail?.bl_no || jobDetail?.transport_type?.includes('ขาเข้า');
  const isLoadedContainer = checkinTypeFromState === 'loaded_container' || (!isContainerReturn && checkinTypeFromState !== 'empty_container' && isInboundFromJobData);
  const isEmptyContainer = !isContainerReturn && !isLoadedContainer;
  const isBLJob = !!jobDetail?.bl_no;
  const isBookingJob = !!jobDetail?.booking_no;
  const showTrailerPlateSection = (isBLJob || isBookingJob) && !isContainerReturn;
  const needsOCR = isEmptyContainer || isLoadedContainer;
  const needsApiVerify = isLoadedContainer;
  
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [activePhotoSlot, setActivePhotoSlot] = useState<PhotoSlot>('container');
  
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());
  
  // 3 photo slots
  const [containerPhotoFile, setContainerPhotoFile] = useState<File | null>(null);
  const [containerPhotoPreview, setContainerPhotoPreview] = useState<string>("");
  const [sealPhotoFile, setSealPhotoFile] = useState<File | null>(null);
  const [sealPhotoPreview, setSealPhotoPreview] = useState<string>("");
  const [eirPhotoFiles, setEirPhotoFiles] = useState<File[]>([]);
  const [eirPhotoPreviews, setEirPhotoPreviews] = useState<string[]>([]);
  const [activeEirIndex, setActiveEirIndex] = useState<number>(0);
  // Separate BL EIR state (independent from D/O)
  const [blEirPhotoFile, setBlEirPhotoFile] = useState<File | null>(null);
  const [blEirPhotoPreview, setBlEirPhotoPreview] = useState<string>("");
  // Multiple D/O photos support
  const [doPhotoFiles, setDoPhotoFiles] = useState<File[]>([]);
  const [doPhotoPreviews, setDoPhotoPreviews] = useState<string[]>([]);
  // BL job: flexible container photos (unlimited)
  const [blContainerPhotoFiles, setBlContainerPhotoFiles] = useState<File[]>([]);
  const [blContainerPhotoPreviews, setBlContainerPhotoPreviews] = useState<string[]>([]);
  const [activeBlAngleIndex, setActiveBlAngleIndex] = useState<number>(0);

  // Trailer license plate (BL/Booking jobs - optional, multi-photo with OCR)
  const [trailerPlatePhotoFiles, setTrailerPlatePhotoFiles] = useState<File[]>([]);
  const [trailerPlatePhotoPreviews, setTrailerPlatePhotoPreviews] = useState<string[]>([]);
  const [trailerPlateOcrResults, setTrailerPlateOcrResults] = useState<(string | null)[]>([]);
  const [pendingTrailerPlateOcr, setPendingTrailerPlateOcr] = useState<(string | null)[]>([]);
  const [activeTrailerPlateIndex, setActiveTrailerPlateIndex] = useState<number>(0);
  const [isProcessingTrailerPlateOcr, setIsProcessingTrailerPlateOcr] = useState(false);
  
  // OCR state
  const [isProcessingContainerOcr, setIsProcessingContainerOcr] = useState(false);
  const [isProcessingSealOcr, setIsProcessingSealOcr] = useState(false);
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [isContainerOcrDone, setIsContainerOcrDone] = useState(false);
  const [isSealOcrDone, setIsSealOcrDone] = useState(false);
  
  const [pendingContainerOcr, setPendingContainerOcr] = useState<string | null>(null);
  const [pendingSealOcr, setPendingSealOcr] = useState<string | null>(null);
  // Container weight markings (MAX GROSS / TARE / NET) from CSC plate
  const [pendingMaxGross, setPendingMaxGross] = useState<string>('');
  const [pendingTareWeight, setPendingTareWeight] = useState<string>('');
  const [pendingNetWeight, setPendingNetWeight] = useState<string>('');
  const [ocrMaxGross, setOcrMaxGross] = useState<string>('');
  const [ocrTareWeight, setOcrTareWeight] = useState<string>('');
  const [ocrNetWeight, setOcrNetWeight] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [ocrImageUrl, setOcrImageUrl] = useState<string | undefined>(undefined);

  const [containerNumber] = useState(navState?.verifiedContainer || "");
  const [sealNumber] = useState(navState?.verifiedSeal || "");
  
  // OCR return slip state (for unknown yard)
  const [returnSlipYardName, setReturnSlipYardName] = useState<string | null>(null);
  const [isProcessingReturnSlipOcr, setIsProcessingReturnSlipOcr] = useState(false);
  const [showReturnSlipDrawer, setShowReturnSlipDrawer] = useState(false);
  const [pendingReturnSlipYard, setPendingReturnSlipYard] = useState<string | null>(null);
  const [checkingExpenses, setCheckingExpenses] = useState(false);
  const [showMissingExpenseDialog, setShowMissingExpenseDialog] = useState(false);
  const [missingExpenseTypes, setMissingExpenseTypes] = useState<string[]>([]);

  // EIR BL/Booking verification (first EIR photo on pickup or return)
  const [isProcessingEirBlOcr, setIsProcessingEirBlOcr] = useState(false);
  const [eirBlOcrResult, setEirBlOcrResult] = useState<{ bl_no?: string | null; booking_no?: string | null; container_number?: string | null; seal_number?: string | null } | null>(null);
  const [eirBlMatchStatus, setEirBlMatchStatus] = useState<'match' | 'mismatch' | 'not_found' | null>(null);
  const [eirContainerMatchStatus, setEirContainerMatchStatus] = useState<'match' | 'mismatch' | 'not_found' | null>(null);
  const [eirSealMatchStatus, setEirSealMatchStatus] = useState<'match' | 'mismatch' | 'not_found' | null>(null);

  const runReturnSlipOcrFromEir = async (file: File) => {
    setIsProcessingReturnSlipOcr(true);
    try {
      toast({ title: 'กำลังอ่านชื่อลานจาก EIR...', description: 'รอสักครู่...' });
      const result = await extractFromImage(file, 'container_return_slip');
      if (result.success && result.data?.yard_name) {
        setPendingReturnSlipYard(result.data.yard_name);
        toast({ title: 'อ่านชื่อลานสำเร็จ', description: `ลาน: ${result.data.yard_name}` });
      } else {
        setPendingReturnSlipYard('');
        toast({ title: 'ไม่สามารถอ่านชื่อลานได้', description: 'กรุณากรอกชื่อลานด้วยตนเอง', variant: 'destructive' });
      }
    } catch (error) {
      console.error('EIR return slip OCR error:', error);
      setPendingReturnSlipYard('');
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถอ่านใบคืนตู้ได้', variant: 'destructive' });
    } finally {
      setIsProcessingReturnSlipOcr(false);
    }
  };

  const normalizeRef = (s: string | null | undefined) =>
    (s || '').toString().toUpperCase().replace(/[\s\-_./]/g, '');

  type EirMatchStatus = 'match' | 'mismatch' | 'not_found';

  const extractContainerNumberFromOcrData = (data: any): string | null => {
    const directValue =
      data?.container_number ||
      data?.container_no ||
      data?.containerNo ||
      data?.cntr_no ||
      data?.cntrNo ||
      data?.container;

    if (directValue) return String(directValue);

    const rawText = String(data?.raw_text || '');
    const match = rawText.toUpperCase().match(/[A-Z]{4}[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d/);
    return match ? match[0].replace(/[\s\-]/g, '') : null;
  };

  const getAssignedContainerForEir = () =>
    normalizeRef(
      containerNumber ||
      jobDetail?.container_number ||
      jobDetail?.container_details?.find((detail) => detail?.containerNo)?.containerNo ||
      (jobDetail as any)?.container_no ||
      (jobDetail as any)?.containerNo
    );

  const getExpectedContainerForEir = (override?: string | null) =>
    normalizeRef(override) || (needsOCR && isContainerOcrDone ? normalizeRef(ocrContainerNumber) : '') || getAssignedContainerForEir();

  // Seal number expected on the EIR: prefer the confirmed seal-photo OCR, then manual/job value
  const getExpectedSealForEir = () =>
    (isSealOcrDone ? normalizeRef(ocrSealNumber) : '') ||
    normalizeRef(sealNumber) ||
    normalizeRef(jobDetail?.seal_number);

  const showEirBlockingToast = (
    refStatus: EirMatchStatus | null,
    containerStatus: EirMatchStatus | null,
    result: { bl_no?: string | null; booking_no?: string | null; container_number?: string | null } | null,
  ) => {
    if (refStatus === 'mismatch') {
      const jobRef = jobDetail?.bl_no || jobDetail?.booking_no || '-';
      const ocrRef = result?.bl_no || result?.booking_no || '-';
      toast({
        title: 'เลข BL/Booking ใน EIR ไม่ตรงกับงาน',
        description: `งานนี้: ${jobRef} | อ่านจาก EIR: ${ocrRef} — กรุณาตรวจสอบว่าถ่ายรูป EIR ถูกงานหรือไม่`,
        variant: 'destructive',
      });
      return true;
    }

    if (refStatus === 'not_found' && (jobDetail?.bl_no || jobDetail?.booking_no)) {
      toast({
        title: 'ไม่พบเลข BL/Booking ใน EIR',
        description: 'กรุณาถ่ายรูป EIR ใหม่ให้เห็นเลข BL หรือ Booking ชัดเจนก่อนยืนยัน',
        variant: 'destructive',
      });
      return true;
    }

    if (containerStatus === 'mismatch') {
      const expectedCn = getExpectedContainerForEir();
      const ocrCn = result?.container_number || '-';
      toast({
        title: 'เลขตู้ใน EIR ไม่ตรงกับงาน',
        description: `ตู้ที่ต้องตรงกับงาน: ${expectedCn || '-'} | อ่านจาก EIR: ${ocrCn} — กรุณาตรวจสอบว่าถ่ายรูป EIR ถูกตู้หรือไม่`,
        variant: 'destructive',
      });
      return true;
    }

    if (containerStatus !== 'match') {
      if (needsOCR && result?.container_number && !isContainerOcrDone) {
        toast({
          title: 'รอเลขตู้จากรูปตู้',
          description: 'ระบบอ่านเลขตู้จาก EIR แล้ว กรุณาอัปโหลด/ยืนยัน OCR รูปเลขตู้ก่อนยืนยันงาน',
          variant: 'destructive',
        });
        return true;
      }

      toast({
        title: 'ไม่พบเลขตู้ใน EIR',
        description: 'กรุณาถ่ายรูป EIR ใหม่ให้เห็นเลขตู้ชัดเจน ระบบต้องเทียบเลขตู้จาก EIR ก่อนยืนยัน',
        variant: 'destructive',
      });
      return true;
    }

    return false;
  };

  const evaluateEirMatches = (
    result: { bl_no?: string | null; booking_no?: string | null; container_number?: string | null; seal_number?: string | null } | null,
    expectedContainerOverride?: string | null,
  ): { refStatus: EirMatchStatus; containerStatus: EirMatchStatus; sealStatus: EirMatchStatus } => {
    const jobBl = normalizeRef(jobDetail?.bl_no);
    const jobBk = normalizeRef(jobDetail?.booking_no);
    const ocrBl = normalizeRef(result?.bl_no);
    const ocrBk = normalizeRef(result?.booking_no);

    const jobRefs = [jobBl, jobBk].filter(Boolean);
    const ocrRefs = [ocrBl, ocrBk].filter(Boolean);

    let refStatus: EirMatchStatus = 'match';
    if (jobRefs.length > 0) {
      refStatus = 'not_found';
      if (ocrRefs.length > 0) {
        refStatus = ocrRefs.some(ref => jobRefs.includes(ref)) ? 'match' : 'mismatch';
      }
    }

    // Seal comparison (warning only — never blocks confirmation)
    const expectedSeal = getExpectedSealForEir();
    const ocrSeal = normalizeRef(result?.seal_number);
    let sealStatus: EirMatchStatus = !expectedSeal ? 'match' : 'not_found';
    if (expectedSeal && ocrSeal) {
      sealStatus = ocrSeal === expectedSeal ? 'match' : 'mismatch';
    }

    const expectedContainer = getExpectedContainerForEir(expectedContainerOverride);
    const ocrCn = normalizeRef(result?.container_number);

    if (needsOCR && !isContainerOcrDone) {
      return { refStatus, containerStatus: 'not_found', sealStatus };
    }

    // If the job has no assigned/confirmed container number, skip container comparison (treat as match)
    let containerStatus: EirMatchStatus = !expectedContainer ? 'match' : 'not_found';
    if (expectedContainer && ocrCn) {
      containerStatus = ocrCn === expectedContainer ? 'match' : 'mismatch';
    }

    return { refStatus, containerStatus, sealStatus };
  };

  const getEirFileForOcr = async (): Promise<File | null> => {
    const file: File | null = eirPhotoFiles[0] || blEirPhotoFile || null;
    if (file) return file;
    const preview = eirPhotoPreviews[0] || blEirPhotoPreview || '';
    if (!preview) return null;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      return new File([blob], 'eir.jpg', { type: blob.type || 'image/jpeg' });
    } catch (e) {
      console.error('Failed to load EIR preview for OCR:', e);
      return null;
    }
  };

  const runEirBlOcr = async (file: File): Promise<{ refStatus: EirMatchStatus; containerStatus: EirMatchStatus; sealStatus: EirMatchStatus; result: { bl_no?: string | null; booking_no?: string | null; container_number?: string | null; seal_number?: string | null } } | null> => {
    setIsProcessingEirBlOcr(true);
    setEirBlOcrResult(null);
    setEirBlMatchStatus(null);
    setEirContainerMatchStatus(null);
    setEirSealMatchStatus(null);
    try {
      toast({ title: 'กำลังตรวจสอบ EIR...', description: 'รอสักครู่...' });
      const result = await extractFromImage(file, 'eir_document');
      if (result.success && result.data) {
        const bl = result.data.bl_no || null;
        const bk = result.data.booking_no || null;
        const cn = extractContainerNumberFromOcrData(result.data);
        const sn = (result.data as any)?.seal_number || null;
        const ocrResult = { bl_no: bl, booking_no: bk, container_number: cn, seal_number: sn };
        const { refStatus, containerStatus, sealStatus } = evaluateEirMatches(ocrResult);

        setEirBlOcrResult(ocrResult);
        setEirBlMatchStatus(refStatus);
        setEirContainerMatchStatus(containerStatus);
        setEirSealMatchStatus(sealStatus);


        if (refStatus === 'match' && containerStatus === 'match' && sealStatus === 'match') {
          toast({ title: 'ตรงกันทั้งหมด ✓', description: 'เลข BL/Booking เลขตู้ และเลขซีลตรงกับงาน' });
        } else if (refStatus === 'mismatch') {
          toast({ title: 'เลข BL/Booking ใน EIR ไม่ตรงกับงาน ❌', description: 'ไม่สามารถยืนยันได้ กรุณาตรวจสอบว่าถ่าย EIR ถูกงานหรือไม่', variant: 'destructive' });
        } else if (containerStatus === 'mismatch') {
          toast({ title: 'เลขตู้ใน EIR ไม่ตรงกับงาน ❌', description: 'ไม่สามารถยืนยันได้ กรุณาตรวจสอบว่าถ่าย EIR ถูกตู้หรือไม่', variant: 'destructive' });
        } else if (containerStatus === 'not_found' && !cn) {
          toast({ title: 'ไม่พบเลขตู้ใน EIR', description: 'ต้องอ่านเลขตู้จากใบ EIR ให้ได้ก่อนยืนยัน', variant: 'destructive' });
        } else if (containerStatus === 'not_found') {
          toast({ title: 'อ่านเลขตู้จาก EIR แล้ว', description: `เลขตู้ใน EIR: ${cn} — กรุณาถ่ายรูปเลขตู้เพื่อเทียบอีกครั้ง` });
        } else {
          toast({ title: 'อ่าน EIR สำเร็จบางส่วน', description: 'กรุณาตรวจสอบด้วยตนเอง' });
        }

        // Seal warnings (non-blocking)
        if (sealStatus === 'mismatch') {
          toast({
            title: 'เลขซีลใน EIR ไม่ตรงกับที่ถ่าย ⚠️',
            description: `ซีลที่ถ่าย/ในงาน: ${getExpectedSealForEir() || '-'} | ใน EIR: ${sn || '-'} — ยืนยันต่อได้ แต่โปรดตรวจสอบ`,
            variant: 'destructive',
          });
        } else if (sealStatus === 'not_found' && getExpectedSealForEir()) {
          toast({
            title: 'ไม่พบเลขซีลใน EIR ⚠️',
            description: 'แนะนำให้ถ่าย EIR ใหม่ให้เห็นเลขซีลชัดเจน หรือกรอกเลขซีลเอง',
          });
        }

        return { refStatus, containerStatus, sealStatus, result: ocrResult };

      } else {
        setEirBlMatchStatus('not_found');
        setEirContainerMatchStatus('not_found');
        setEirSealMatchStatus('not_found');
        toast({ title: 'อ่าน EIR ไม่สำเร็จ', description: 'กรุณาถ่าย EIR ใหม่ ระบบต้องอ่านเลขตู้จาก EIR ก่อนยืนยัน', variant: 'destructive' });
        return null;
      }
    } catch (error) {
      console.error('EIR BL/Booking OCR error:', error);
      setEirBlMatchStatus('not_found');
      setEirContainerMatchStatus('not_found');
      setEirSealMatchStatus('not_found');
      return null;
    } finally {
      setIsProcessingEirBlOcr(false);
    }
  };



  useEffect(() => {
    if (jobId && user) {
      loadJobDetail();
    }
  }, [jobId, user]);

  useEffect(() => {
    if (!eirBlOcrResult) return;
    const { refStatus, containerStatus, sealStatus } = evaluateEirMatches(eirBlOcrResult);
    setEirBlMatchStatus(refStatus);
    setEirContainerMatchStatus(containerStatus);
    setEirSealMatchStatus(sealStatus);
  }, [eirBlOcrResult, ocrContainerNumber, isContainerOcrDone, containerNumber, ocrSealNumber, isSealOcrDone, sealNumber, jobDetail?.bl_no, jobDetail?.booking_no, jobDetail?.container_number, jobDetail?.seal_number]);

  const loadJobDetail = async () => {
    try {
      const extractRawContainerDetails = (job: any) =>
        job?.containers ??
        job?.container_details ??
        job?.containerDetails ??
        job?.route_calculation?.containers ??
        job?.job_data?.containers;

      const parseContainerArray = (job: any) => {
        let rawDetails = extractRawContainerDetails(job);
        if (typeof rawDetails === 'string') {
          try {
            rawDetails = JSON.parse(rawDetails);
          } catch {
            rawDetails = [];
          }
        }
        return Array.isArray(rawDetails) ? rawDetails : [];
      };

      let foundJob: any = null;
      const stateJob = navState?.jobData;
      if (stateJob) {
        foundJob = stateJob;
      }

      const shouldFetchFromApi = !foundJob || parseContainerArray(foundJob).length === 0;

      if (shouldFetchFromApi) {
        try {
          let apiJob: any = null;

          if (isInternalDriver || isExternalDriver) {
            const driverType = isInternalDriver ? 'internal' : 'external';
            const [acceptedRes, arrivedAtPickupRes, inProgressRes, inTransitRes, deliveredRes, returningContainerRes, atContainerReturnRes, containerReturnedRes, completedRes] = await Promise.all([
              getDriverAssignedJobs(user!.id, driverType, 50, 'accepted'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'arrived_at_pickup'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'in_progress'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'in_transit'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'delivered'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'returning_container'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'at_container_return'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'container_returned'),
              getDriverAssignedJobs(user!.id, driverType, 50, 'completed'),
            ]);
            apiJob = [
              ...((acceptedRes.data as any)?.data || []),
              ...((arrivedAtPickupRes.data as any)?.data || []),
              ...((inProgressRes.data as any)?.data || []),
              ...((inTransitRes.data as any)?.data || []),
              ...((deliveredRes.data as any)?.data || []),
              ...((returningContainerRes.data as any)?.data || []),
              ...((atContainerReturnRes.data as any)?.data || []),
              ...((containerReturnedRes.data as any)?.data || []),
              ...((completedRes.data as any)?.data || []),
            ].find((j: any) => j.order_number === jobId || j.order_code === jobId || j.id === jobId);
          } else {
            const { data: result } = await getFreelanceAcceptedJobs(user!.id);
            if (result?.data) {
              apiJob = result.data.find((j: any) => j.order_number === jobId || j.order_code === jobId || j.id === jobId);
            }
          }

          if (apiJob) {
            foundJob = foundJob ? { ...foundJob, ...apiJob } : apiJob;
          }
        } catch (apiFetchError) {
          console.warn('[ContainerSOPPage] API fetch failed, using state data as fallback:', apiFetchError);
        }
      }

      if (foundJob) {
        const rawDetails = parseContainerArray(foundJob);

        const containerDetails: ContainerDetail[] = Array.isArray(rawDetails)
          ? rawDetails
              .filter((item: any) =>
                item?.containerNo ||
                item?.container_no ||
                item?.container_number ||
                item?.sealNo ||
                item?.seal_no ||
                item?.seal_number
              )
              .map((item: any) => ({
                containerNo: item.containerNo || item.container_no || item.container_number || '',
                sealNo: item.sealNo || item.seal_no || item.seal_number || ''
              }))
          : [];

        const firstContainerDetail = containerDetails.find((item) => item?.containerNo || item?.sealNo) || null;

        const fallbackContainerNumber =
          foundJob.container_number ||
          foundJob.container_no_1 ||
          foundJob.container_no_2 ||
          firstContainerDetail?.containerNo ||
          '';

        const fallbackSealNumber =
          foundJob.seal_number ||
          foundJob.seal_no_1 ||
          foundJob.seal_no_2 ||
          firstContainerDetail?.sealNo ||
          '';

        setJobDetail({
          id: foundJob.id || jobId || '',
          order_code: foundJob.order_code || foundJob.order_number || jobId || '',
          employer_name: foundJob.employer_name || foundJob.factory_name || foundJob.sender_name || '',
          container_checkpoint: foundJob.container_checkpoint || foundJob.empty_pickup_depot || '',
          container_number: fallbackContainerNumber,
          seal_number: fallbackSealNumber,
          container_number_2: foundJob.container_number_2 || '',
          seal_number_2: foundJob.seal_number_2 || '',
          start_date: foundJob.start_date || foundJob.sender_pickup_date || '',
          start_time: foundJob.start_time || foundJob.sender_pickup_time || '',
          bl_no: foundJob.bl_no || '',
          booking_no: foundJob.booking_no || foundJob.booking_number || '',
          transport_type: foundJob.transport_type || '',
          container_details: containerDetails,
          container_return_location: foundJob.container_return_location || foundJob.return_container_at || '',
          closing_time: foundJob.closing_time || foundJob.closingTime || foundJob.closing_date || '',
        });
      } else {
        throw new Error('Job not found');
      }
    } catch (error) {
      console.error('Error loading job details:', error);
      toast({
        title: t('containerSop.error'),
        description: t('containerSop.loadError'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine if yard is unknown for container return
  const isYardUnknown = isContainerReturn && (
    !jobDetail?.container_return_location || 
    jobDetail.container_return_location === 'ดูลานที่หน้างาน' ||
    jobDetail.container_return_location.includes('ดูลานที่หน้างาน') ||
    jobDetail.container_return_location.includes('ไม่สามารถระบุลานได้') ||
    jobDetail.container_return_location.trim() === ''
  );

  const handleReturnSlipOcr = async (source: 'camera' | 'gallery') => {
    setShowReturnSlipDrawer(false);
    setIsProcessingReturnSlipOcr(true);
    
    try {
      let file: File | null = null;
      if (isNative) {
        file = source === 'camera' ? await takePhoto() : await selectFromGallery();
      } else {
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          if (source === 'camera') input.capture = 'environment';
          input.onchange = (e) => {
            const f = (e.target as HTMLInputElement).files?.[0] || null;
            resolve(f);
          };
          input.click();
        });
      }
      
      if (!file) {
        setIsProcessingReturnSlipOcr(false);
        return;
      }

      const result = await extractFromImage(file, 'container_return_slip');
      if (result.success && result.data?.yard_name) {
        setPendingReturnSlipYard(result.data.yard_name);
      } else {
        setPendingReturnSlipYard('');
        toast({
          title: 'ไม่สามารถอ่านชื่อลานได้',
          description: 'กรุณากรอกชื่อลานด้วยตนเอง',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Return slip OCR error:', error);
      setPendingReturnSlipYard('');
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถอ่านใบคืนตู้ได้',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingReturnSlipOcr(false);
    }
  };

  const confirmReturnSlipYard = () => {
    if (pendingReturnSlipYard !== null && pendingReturnSlipYard.trim()) {
      setReturnSlipYardName(pendingReturnSlipYard.trim());
      setPendingReturnSlipYard(null);
      toast({ title: 'บันทึกชื่อลานสำเร็จ', description: `ลาน: ${pendingReturnSlipYard.trim()}` });
    }
  };

  // Check whether required expenses are missing before container return doc submission.
  // BL (inbound) return: requires ค่าคืนตู้
  // Booking (outbound) return: requires ค่ารับตู้ + ค่าผ่านท่า
  // Returns true if missing (and opens the dialog), false otherwise.
  const checkMissingExpensesForReturn = async (): Promise<boolean> => {
    if (!isContainerReturn || !user) return false;
    if (!isBLJob && !isBookingJob) return false;
    setCheckingExpenses(true);
    try {
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
      const { data: expensesData } = await getExpenses(jobId || '', user.id, driverType);

      const expenseList = Array.isArray(expensesData)
        ? expensesData
        : Array.isArray((expensesData as any)?.expenses)
          ? (expensesData as any).expenses
          : Array.isArray((expensesData as any)?.data?.expenses)
            ? (expensesData as any).data.expenses
            : [];

      const existingTypes = new Set<string>();
      const normalizeExpenseType = (value: string) =>
        value
          .trim()
          .toLowerCase()
          .replace(/[()]/g, '')
          .replace(/[^\wก-๙]+/g, '_')
          .replace(/^_+|_+$/g, '');

      for (const exp of expenseList) {
        const raw = String(exp.expense_type || exp.expense_name || '');
        if (!raw.trim()) continue;
        const stripSuffix = (s: string) => {
          const trimmed = s.trim();
          if (trimmed.endsWith(')')) {
            const idx = trimmed.lastIndexOf('(');
            if (idx > 0) return trimmed.slice(0, idx).trim();
          }
          return trimmed;
        };
        const baseRaw = stripSuffix(raw);
        const normalized = normalizeExpenseType(baseRaw);
        existingTypes.add(normalized);
        existingTypes.add(normalizeExpenseType(raw));

        const variationMap: Record<string, string> = {
          'ค่าคืนตู้': 'return_container',
          'ค่าผ่านท่า': 'port_fee',
          'ค่ารับตู้': 'pickup_container',
          'ค่ารับตู้เปล่า': 'pickup_container',
          'ค่ารับตู้มีสินค้า': 'pickup_container',
          'container_return': 'return_container',
          'return_container': 'return_container',
          'port_fee': 'port_fee',
          'pickup_container': 'pickup_container',
          'pickup_empty_container': 'pickup_container',
          'pickup_loaded_container': 'pickup_container',
        };
        const mapped = variationMap[baseRaw] || variationMap[normalized];
        if (mapped) existingTypes.add(mapped);
      }

      const requiredTypes = isBLJob
        ? [{ key: 'return_container', label: t('expense.returnContainer') }]
        : [
            { key: 'pickup_container', label: t('expense.pickupContainer') },
            { key: 'port_fee', label: t('expense.portFee') },
          ];
      const missing = requiredTypes.filter(rt => !existingTypes.has(rt.key));
      if (missing.length > 0) {
        setMissingExpenseTypes(missing.map(m => m.label));
        setShowMissingExpenseDialog(true);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[ContainerSOP] Failed to check expenses:', err);
      return false;
    } finally {
      setCheckingExpenses(false);
    }
  };

  const openPhotoDrawer = async (slot: PhotoSlot, eirIndex: number = 0) => {
    if (!isContainerReturn && slot !== 'eir' && eirPhotoFiles.length === 0) {
      toast({
        title: 'กรุณาถ่ายรูป EIR ก่อน',
        description: 'ต้องอ่านเลขตู้จากใบ EIR ก่อนถ่ายรูปตู้/ซีล',
        variant: 'destructive',
      });
      return;
    }

    // Mandatory expense check temporarily disabled for BL/Booking container returns
    // if (slot === 'eir' && isContainerReturn && (isBLJob || isBookingJob)) {
    //   const missing = await checkMissingExpensesForReturn();
    //   if (missing) return;
    // }

    setActivePhotoSlot(slot);
    setActiveEirIndex(eirIndex);
    setShowPhotoDrawer(true);
  };

  const handlePhotoSelect = async (source: 'camera' | 'gallery') => {
    setShowPhotoDrawer(false);
    
    let file: File | null = null;
    
    if (isNative) {
      if (source === 'camera') {
        file = await takePhoto();
      } else {
        file = await selectFromGallery();
      }
    }
    
    if (!file) {
      // Web fallback
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') {
        input.setAttribute('capture', 'environment');
      }
      
      // Must append to DOM for iOS Safari to work reliably
      input.style.position = 'fixed';
      input.style.top = '-9999px';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      
      await new Promise<void>((resolve) => {
        let settled = false;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('focus', handleFocus);
          input.onchange = null;
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
          resolve();
        };

        input.onchange = async (e) => {
          file = (e.target as HTMLInputElement).files?.[0] || null;
          if (file) {
            await processFileForSlot(file, activePhotoSlot);
          }
          cleanup();
        };

        // Cleanup if user cancels
        const handleFocus = () => {
          setTimeout(() => {
            if (!input.files?.length) {
              cleanup();
            }
          }, 500);
        };

        window.addEventListener('focus', handleFocus);
        input.click();
      });
      return;
    }
    
    if (file) {
      await processFileForSlot(file, activePhotoSlot);
    }
  };

  const processFileForSlot = async (file: File, slot: PhotoSlot) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      if (slot === 'bl_angle') {
        const idx = activeBlAngleIndex;
        if (idx >= blContainerPhotoFiles.length) {
          // Adding new photo
          setBlContainerPhotoFiles(prev => [...prev, file]);
          setBlContainerPhotoPreviews(prev => [...prev, preview]);
        } else {
          // Replacing existing photo
          setBlContainerPhotoFiles(prev => { const n = [...prev]; n[idx] = file; return n; });
          setBlContainerPhotoPreviews(prev => { const n = [...prev]; n[idx] = preview; return n; });
        }
      } else if (slot === 'container') {
        setContainerPhotoFile(file);
        setContainerPhotoPreview(preview);
      } else if (slot === 'seal') {
        setSealPhotoFile(file);
        setSealPhotoPreview(preview);
      } else if (slot === 'bl_eir') {
        // BL job: separate EIR document (independent state)
        setBlEirPhotoFile(file);
        setBlEirPhotoPreview(preview);
      } else if (slot === 'trailer_plate') {
        const idx = activeTrailerPlateIndex;
        setTrailerPlatePhotoFiles(prev => {
          if (idx >= prev.length) return [...prev, file];
          const n = [...prev]; n[idx] = file; return n;
        });
        setTrailerPlatePhotoPreviews(prev => {
          if (idx >= prev.length) return [...prev, preview];
          const n = [...prev]; n[idx] = preview; return n;
        });
        setTrailerPlateOcrResults(prev => {
          if (idx >= prev.length) return [...prev, null];
          const n = [...prev]; n[idx] = null; return n;
        });
      } else {
        // EIR: multiple photos support - use functional update to avoid stale closure
        const eirIdx = activeEirIndex;
        setEirPhotoFiles(prev => {
          if (eirIdx >= prev.length) {
            return [...prev, file];
          }
          const n = [...prev]; n[eirIdx] = file; return n;
        });
        setEirPhotoPreviews(prev => {
          if (eirIdx >= prev.length) {
            return [...prev, preview];
          }
          const n = [...prev]; n[eirIdx] = preview; return n;
        });
      }
    };
    reader.readAsDataURL(file);

    // Run OCR for container and seal slots (skip for BL jobs)
    if (needsOCR) {
      if (slot === 'container') {
        await runContainerOcr(file);
      } else if (slot === 'seal') {
        await runSealOcr(file);
      }
    }
    
    // Auto OCR for EIR photo during container return with unknown yard
    if (slot === 'eir' && isContainerReturn && isYardUnknown && !returnSlipYardName) {
      await runReturnSlipOcrFromEir(file);
    }

    // Auto OCR for first EIR photo to verify BL/Booking + container (pickup & return)
    if (slot === 'eir' && activeEirIndex === 0) {
      await runEirBlOcr(file);
    }

    // Auto OCR for trailer plate photo (optional, runs in background)
    if (slot === 'trailer_plate') {
      await runTrailerPlateOcr(file, activeTrailerPlateIndex);
    }
  };

  const runTrailerPlateOcr = async (file: File, idx: number) => {
    setIsProcessingTrailerPlateOcr(true);
    try {
      const result = await extractFromImage(file, 'trailer_plate' as any);
      const plateRaw = (result?.data as any)?.license_plate || (result?.data as any)?.plate_number || '';
      const province = (result?.data as any)?.province || '';
      const plate = [plateRaw, province].filter(Boolean).join(' ').trim();
      setPendingTrailerPlateOcr(prev => {
        const n = [...prev];
        while (n.length <= idx) n.push(null);
        n[idx] = plate || '';
        return n;
      });
      // Clear previously confirmed value for this index so user must re-confirm
      setTrailerPlateOcrResults(prev => {
        const n = [...prev];
        while (n.length <= idx) n.push(null);
        n[idx] = null;
        return n;
      });
      if (plate) {
        toast({ title: 'อ่านทะเบียนหางลากสำเร็จ', description: `กรุณาตรวจสอบและกดยืนยัน` });
      } else {
        toast({ title: 'ไม่สามารถอ่านทะเบียนได้', description: 'กรุณากรอกเองแล้วกดยืนยัน', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Trailer plate OCR error:', error);
    } finally {
      setIsProcessingTrailerPlateOcr(false);
    }
  };

  const confirmTrailerPlateOcr = (idx: number) => {
    const value = (pendingTrailerPlateOcr[idx] || '').trim();
    if (!value) {
      toast({ title: 'กรุณากรอกเลขทะเบียน', variant: 'destructive' });
      return;
    }
    setTrailerPlateOcrResults(prev => {
      const n = [...prev];
      while (n.length <= idx) n.push(null);
      n[idx] = value;
      return n;
    });
    setPendingTrailerPlateOcr(prev => {
      const n = [...prev];
      n[idx] = null;
      return n;
    });
    toast({ title: 'ยืนยันทะเบียนสำเร็จ' });
  };


  const runContainerOcr = async (file: File) => {
    setIsProcessingContainerOcr(true);
    setPendingContainerOcr(null);
    setPendingMaxGross('');
    setPendingTareWeight('');
    setPendingNetWeight('');
    setIsContainerOcrDone(false);
    if (eirBlOcrResult?.container_number) {
      setEirContainerMatchStatus('not_found');
    }
    try {
      toast({ title: 'กำลังอ่านเลขตู้...', description: 'รอสักครู่...' });
      const result = await extractFromImage(file, 'container_seal');
      if (result.success && result.data?.container_number) {
        setPendingContainerOcr(result.data.container_number);
        if (result.data.max_gross != null) setPendingMaxGross(String(result.data.max_gross));
        if (result.data.tare_weight != null) setPendingTareWeight(String(result.data.tare_weight));
        if (result.data.net_weight != null) setPendingNetWeight(String(result.data.net_weight));
        toast({ title: 'อ่านเลขตู้สำเร็จ', description: `เลขตู้: ${result.data.container_number}` });
      } else {
        toast({ title: 'ไม่สามารถอ่านเลขตู้ได้', description: 'กรุณาถ่ายรูปใหม่หรือกรอกเอง', variant: "destructive" });
        setPendingContainerOcr('');
      }
    } catch (error) {
      console.error('Container OCR error:', error);
      toast({ title: 'OCR Error', description: 'กรุณาลองใหม่', variant: "destructive" });
      setPendingContainerOcr('');
    } finally {
      setIsProcessingContainerOcr(false);
    }
  };

  const runSealOcr = async (file: File) => {
    setIsProcessingSealOcr(true);
    setPendingSealOcr(null);
    setIsSealOcrDone(false);
    try {
      toast({ title: 'กำลังอ่านเลขซีล...', description: 'รอสักครู่...' });
      const result = await extractFromImage(file, 'container_seal');
      if (result.success && result.data?.seal_number) {
        setPendingSealOcr(result.data.seal_number);
        toast({ title: 'อ่านเลขซีลสำเร็จ', description: `เลขซีล: ${result.data.seal_number}` });
      } else {
        toast({ title: 'ไม่สามารถอ่านเลขซีลได้', description: 'กรุณาถ่ายรูปใหม่หรือกรอกเอง', variant: "destructive" });
        setPendingSealOcr('');
      }
    } catch (error) {
      console.error('Seal OCR error:', error);
      toast({ title: 'OCR Error', description: 'กรุณาลองใหม่', variant: "destructive" });
      setPendingSealOcr('');
    } finally {
      setIsProcessingSealOcr(false);
    }
  };

  const confirmContainerOcr = () => {
    const confirmed = pendingContainerOcr;
    setOcrContainerNumber(confirmed);
    setOcrMaxGross(pendingMaxGross);
    setOcrTareWeight(pendingTareWeight);
    setOcrNetWeight(pendingNetWeight);
    setIsContainerOcrDone(true);
    setPendingContainerOcr(null);
    toast({ title: 'ยืนยันเลขตู้สำเร็จ' });
  };

  const confirmSealOcr = () => {
    setOcrSealNumber(pendingSealOcr);
    setIsSealOcrDone(true);
    setPendingSealOcr(null);
    toast({ title: 'ยืนยันเลขซีลสำเร็จ' });
  };

  const handleConfirmClick = async () => {
    let effectiveEirResult = eirBlOcrResult;
    let effectiveRefStatus = eirBlMatchStatus;
    let effectiveContainerStatus = eirContainerMatchStatus;

    if (eirPhotoFiles.length === 0) {
      toast({ title: 'กรุณาถ่ายรูป EIR ก่อน', description: 'ต้องตรวจเลขตู้จากใบ EIR ก่อนถ่ายรูปตู้และยืนยัน', variant: "destructive" });
      return;
    }

    if (isProcessingEirBlOcr) {
      toast({
        title: 'กำลังตรวจสอบ EIR...',
        description: 'กรุณารอสักครู่ก่อนกดยืนยัน',
        variant: 'destructive',
      });
      return;
    }

    if (!effectiveEirResult) {
      const file = await getEirFileForOcr();
      if (!file) {
        toast({ title: 'ไม่พบรูป EIR', description: 'กรุณาถ่ายรูป EIR ก่อน', variant: 'destructive' });
        return;
      }
      const checked = await runEirBlOcr(file);
      if (!checked) return;
      effectiveEirResult = checked.result;
      effectiveRefStatus = checked.refStatus;
      effectiveContainerStatus = checked.containerStatus;
    } else {
      const checked = evaluateEirMatches(effectiveEirResult);
      effectiveRefStatus = checked.refStatus;
      effectiveContainerStatus = checked.containerStatus;
    }

    if (showEirBlockingToast(effectiveRefStatus, effectiveContainerStatus, effectiveEirResult)) {
      return;
    }

    if (needsOCR && !isContainerOcrDone) {
      toast({ title: 'กรุณาถ่ายรูปเลขตู้และยืนยัน', variant: "destructive" });
      return;
    }
    if (needsOCR && !isSealOcrDone) {
      toast({ title: 'กรุณาถ่ายรูปเลขซีลและยืนยัน', variant: "destructive" });
      return;
    }
    if (isBLJob && !isContainerReturn) {
      if (blContainerPhotoFiles.length === 0) {
        toast({ title: 'กรุณาถ่ายรูปตู้อย่างน้อย 1 รูป', variant: "destructive" });
        return;
      }
    }

    // Mandatory expense check temporarily disabled for BL/Booking container returns
    // if (isBLJob && isContainerReturn && user) {
    //   const missing = await checkMissingExpensesForReturn();
    //   if (missing) return;
    // }


    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    const checkedEir = eirBlOcrResult
      ? evaluateEirMatches(eirBlOcrResult)
      : { refStatus: eirBlMatchStatus, containerStatus: eirContainerMatchStatus };

    if (!eirBlOcrResult || showEirBlockingToast(checkedEir.refStatus, checkedEir.containerStatus, eirBlOcrResult)) {
      setShowConfirmDialog(false);
      return;
    }

    const primaryEirFile = eirPhotoFiles[0];
    if (!primaryEirFile || !jobId || !user) return;

    setUploading(true);
    try {

      // Upload ALL photos in PARALLEL for speed
      const timestamp = Date.now();
      
      // Prepare EIR upload promises
      const eirUploadPromises = eirPhotoFiles.map(async (file, i) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `eir_${jobId}_${timestamp}_${i}.${fileExt}`;
        const formData = new FormData();
        formData.append('file', await compressImage(file));
        formData.append('folder', 'container-photos');
        formData.append('fileName', fileName);
        return supabase.functions.invoke('upload-to-s3', { body: formData });
      });

      // Prepare BL container photo promises
      const blUploadPromises = (isBLJob && !isContainerReturn) 
        ? blContainerPhotoFiles.filter(Boolean).map(async (file, i) => {
            const aFormData = new FormData();
            aFormData.append('file', await compressImage(file));
            aFormData.append('folder', 'container-photos');
            aFormData.append('fileName', `container_photo_${i}_${jobId}_${timestamp}.${file.name.split('.').pop() || 'jpg'}`);
            return supabase.functions.invoke('upload-to-s3', { body: aFormData });
          })
        : [];

      // Prepare container & seal photo promises
      const containerUploadPromise = containerPhotoFile ? (async () => {
        const cFormData = new FormData();
        cFormData.append('file', await compressImage(containerPhotoFile));
        cFormData.append('folder', 'container-photos');
        cFormData.append('fileName', `ocr_container_${jobId}_${timestamp}.${containerPhotoFile.name.split('.').pop() || 'jpg'}`);
        return supabase.functions.invoke('upload-to-s3', { body: cFormData });
      })() : Promise.resolve({ data: null, error: null });

      const sealUploadPromise = sealPhotoFile ? (async () => {
        const sFormData = new FormData();
        sFormData.append('file', await compressImage(sealPhotoFile));
        sFormData.append('folder', 'container-photos');
        sFormData.append('fileName', `ocr_seal_${jobId}_${timestamp}.${sealPhotoFile.name.split('.').pop() || 'jpg'}`);
        return supabase.functions.invoke('upload-to-s3', { body: sFormData });
      })() : Promise.resolve({ data: null, error: null });

      // Prepare trailer plate photo promises (BL/Booking, optional)
      const trailerPlateUploadPromises = showTrailerPlateSection
        ? trailerPlatePhotoFiles.filter(Boolean).map(async (file, i) => {
            const tFormData = new FormData();
            tFormData.append('file', await compressImage(file));
            tFormData.append('folder', 'container-photos');
            tFormData.append('fileName', `trailer_plate_${i}_${jobId}_${timestamp}.${file.name.split('.').pop() || 'jpg'}`);
            return supabase.functions.invoke('upload-to-s3', { body: tFormData });
          })
        : [];

      // Execute ALL uploads in parallel
      const [eirResults, blResults, containerResult, sealResult, trailerPlateResults] = await Promise.all([
        Promise.all(eirUploadPromises),
        Promise.all(blUploadPromises),
        containerUploadPromise,
        sealUploadPromise,
        Promise.all(trailerPlateUploadPromises),
      ]);

      // Process EIR results
      const eirUrls: string[] = [];
      let publicUrl = '';
      eirResults.forEach((r, i) => {
        if (!r.error && r.data?.url) {
          eirUrls.push(r.data.url);
          if (i === 0) publicUrl = r.data.url;
        } else if (i === 0) {
          throw new Error(r.error?.message || r.data?.error || 'EIR upload failed');
        }
      });

      // Process BL results
      const blAngleUrls = blResults.filter(r => !r.error && r.data?.url).map(r => r.data.url);

      // Process trailer plate results (BL only, optional)
      const trailerPlateUrls = trailerPlateResults.filter(r => !r.error && r.data?.url).map(r => r.data.url);
      const trailerPlateNumbers = trailerPlateOcrResults.filter((n): n is string => !!n);

      // Process container/seal results
      const containerImageUrl = containerResult.data?.url || '';
      if (containerImageUrl) setOcrImageUrl(containerImageUrl);
      const sealImageUrl = sealResult.data?.url || '';


      const derivedContainerNumber = (ocrContainerNumber || containerNumber || jobDetail?.container_number || '').trim();
      const derivedSealNumber = (ocrSealNumber || sealNumber || jobDetail?.seal_number || '').trim();
      const finalContainerNumber = derivedContainerNumber || 'N/A';
      const finalSealNumber = derivedSealNumber || 'N/A';

      const driverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Save OCR scan data FIRST (to detect duplicates before sending driverCheckin)
      if (!isContainerReturn && finalContainerNumber && (isBLJob || (needsOCR && isContainerOcrDone))) {
        const ocrDriverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        try {
          const scanPayload = {
            scan_phase: 'pickup' as const,
            container_no: finalContainerNumber,
            seal_no: finalSealNumber || null,
            container_image_url: containerImageUrl || undefined,
            seal_image_url: sealImageUrl || undefined,
            container_photos: blAngleUrls.length > 0 ? blAngleUrls : undefined,
            eir_photos: eirUrls.length > 0 ? eirUrls : undefined,
            trailer_plate_photos: trailerPlateUrls.length > 0 ? trailerPlateUrls : undefined,
            trailer_plate_numbers: trailerPlateNumbers.length > 0 ? trailerPlateNumbers : undefined,
            order_number: jobId || undefined,
            driver_id: user.id,
            driver_type: ocrDriverType,
            scanned_at: new Date().toISOString(),
            max_gross: ocrMaxGross ? Number(ocrMaxGross) : undefined,
            tare_weight: ocrTareWeight ? Number(ocrTareWeight) : undefined,
            net_weight: ocrNetWeight ? Number(ocrNetWeight) : undefined,
            // Send ONLY what OCR actually extracted from the EIR — never fall back
            // to the order's bl_no/booking_no, so the summary card reflects the
            // real document the driver scanned (not job metadata).
            ...(eirBlOcrResult?.bl_no ? { bl_no: eirBlOcrResult.bl_no } : {}),
            ...(eirBlOcrResult?.booking_no ? { booking_no: eirBlOcrResult.booking_no } : {}),
            container_number: eirBlOcrResult?.container_number || null,
          };


          console.log('[ContainerSOP] save-ocr-scan payload:', scanPayload);

          const { data: ocrData, error: ocrError } = await submitOcrScan(scanPayload);

          if (ocrError) {
            const isDuplicate = ocrError.toLowerCase().includes('duplicate') || ocrError.toLowerCase().includes('already scanned');
            if (isDuplicate) {
              const existingRecord = (ocrData as any)?.existing_record;
              const plateFromData = (ocrData as any)?.license_plate || existingRecord?.license_plate || existingRecord?.picked_up_plate || existingRecord?.plate_number;
              const existingOrder = existingRecord?.order_number;
              const displayPlate = plateFromData || 'ไม่ทราบ';
              const displayMsg = `ตู้นี้รถทะเบียน ${displayPlate} ได้รับไปแล้ว`;
              
              toast({
                title: 'ตู้ซ้ำ',
                description: displayMsg,
                variant: "destructive",
                duration: 8000,
              });
              setUploading(false);
              setShowConfirmDialog(false);
              return; // Keep all photos and data — do NOT send driverCheckin
            }
            toast({ title: 'บันทึกข้อมูล OCR ไม่สำเร็จ', description: ocrError, variant: "destructive" });
            return;
          }
        } catch (ocrErr) {
          console.warn('[ContainerSOP] save-ocr-scan exception:', ocrErr);
        }
      }

      // Send driverCheckin for container return
      if (isContainerReturn) {
        try {
          // Build deadline summary: anchor on latest EIR scan (fallback to container_pickup checkin)
          let deadlineNote = '';
          try {
            const freeDays = Number((jobDetail as any)?.container_free_days) || 2;
            let anchorMs: number | null = null;

            // Prefer latest EIR scan timestamp
            const { data: ocrData } = await getOcrContainerScans(
              (jobDetail as any)?.container_number || undefined,
              10,
              jobDetail!.order_code,
            );
            const scans: any[] = (ocrData as any)?.data || [];
            const eirScans = scans.filter((s) => {
              const p = s?.eir_photos;
              return Array.isArray(p) ? p.length > 0 : typeof p === 'string' && p.trim().length > 0;
            });
            if (eirScans.length > 0) {
              const tsOf = (s: any) => new Date(s?.scanned_at || s?.created_at || s?.updated_at || 0).getTime();
              anchorMs = eirScans.reduce((m, s) => Math.max(m, tsOf(s)), 0);
            }

            // Fallback to container_pickup checkin
            if (!anchorMs) {
              const { data: ciData } = await getDriverCheckins(user.id, driverType, jobDetail!.order_code);
              const checkins: any[] = (ciData as any)?.data || [];
              const pickup = checkins.find((c) => c.checkin_type === 'container_pickup')
                || checkins.find((c) => c.checkin_type === 'container_pickup_confirmed');
              if (pickup) anchorMs = new Date(pickup.checked_in_at || pickup.created_at).getTime();
            }

            if (anchorMs) {
              const deadlineMs = anchorMs + freeDays * 24 * 3_600_000;
              const nowMs = Date.now();
              const diffMs = nowMs - deadlineMs;
              const fmt = (ms: number) => {
                const totalMin = Math.floor(Math.abs(ms) / 60000);
                const d = Math.floor(totalMin / 1440);
                const h = Math.floor((totalMin % 1440) / 60);
                const m = totalMin % 60;
                const parts = [];
                if (d > 0) parts.push(`${d} วัน`);
                if (h > 0) parts.push(`${h} ชม.`);
                parts.push(`${m} นาที`);
                return parts.join(' ');
              };
              const deadlineStr = new Date(deadlineMs).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
              deadlineNote = diffMs > 0
                ? ` | กำหนดคืน: ${deadlineStr} (เลยกำหนด ${fmt(diffMs)})`
                : ` | กำหนดคืน: ${deadlineStr} (เหลือ ${fmt(diffMs)})`;
            }
          } catch (deadlineErr) {
            console.warn('[ContainerSOP] deadline calc failed (non-blocking):', deadlineErr);
          }

          const returnYardNote = returnSlipYardName ? ` | ลานคืนตู้: ${returnSlipYardName}` : '';
          const checkinPayload: Parameters<typeof driverCheckin>[0] = {
            order_number: jobDetail!.order_code,
            driver_id: user.id,
            driver_type: driverType,
            checkin_type: 'container_return_confirmed',
            notes: `ยืนยันคืนตู้สำเร็จ${returnYardNote}${deadlineNote}`,
            container_number: finalContainerNumber,
            seal_number: finalSealNumber,
            ...(returnSlipYardName && { return_yard_name: returnSlipYardName }),
            ...(eirUrls.length > 0 && { photo_urls: eirUrls }),
            ...(publicUrl && { photo_url: publicUrl }),
          };
          const { error: checkinError } = await driverCheckin(checkinPayload);
          if (checkinError) {
            console.warn('[ContainerSOP] driverCheckin error (non-blocking):', checkinError);
          } else {
            addOptimisticCheckin({
              orderNumber: jobDetail!.order_code,
              checkinType: 'container_return_confirmed',
            });
          }
        } catch (checkinErr) {
          console.warn('[ContainerSOP] driverCheckin exception:', checkinErr);
        }

        
        // Save OCR scan for container return — always send so backend evidence
        // page shows BL/Booking (ตอนคืนตู้) card even when OCR didn't detect yard
        try {
          const ocrBl = eirBlOcrResult?.bl_no || null;
          const ocrBooking = eirBlOcrResult?.booking_no || null;
          const returnScanPayload: Parameters<typeof submitOcrScan>[0] = {
            scan_phase: 'return',
            order_number: jobDetail?.order_code || jobId || undefined,
            driver_id: user.id,
            driver_type: driverType,
            ...(containerNumber ? { container_no: containerNumber } : {}),
            // Send ONLY OCR-extracted values — no fallback to job's bl_no/booking_no
            ...(ocrBl ? { bl_no: ocrBl } : {}),
            ...(ocrBooking ? { booking_no: ocrBooking } : {}),
            ...(returnSlipYardName ? { return_yard: returnSlipYardName } : {}),
            eir_photos: eirUrls.length > 0 ? eirUrls : undefined,
          };

          console.log('[ContainerSOP] save-ocr-scan (return) payload:', returnScanPayload);
          const { error: returnOcrError } = await submitOcrScan(returnScanPayload);
          if (returnOcrError) {
            console.warn('[ContainerSOP] save-ocr-scan return error (non-blocking):', returnOcrError);
          } else {
            console.log('[ContainerSOP] return scan saved successfully');
          }
        } catch (returnOcrErr) {
          console.warn('[ContainerSOP] save-ocr-scan return exception:', returnOcrErr);
        }
      } else {
        // Send driverCheckin for loaded container pickup — only after OCR duplicate check passed
        try {
          // Collect ALL photo URLs to send to backend
          const allPhotoUrls: string[] = [];
          if (containerImageUrl) allPhotoUrls.push(containerImageUrl);
          if (sealImageUrl) allPhotoUrls.push(sealImageUrl);
          allPhotoUrls.push(...eirUrls);
          allPhotoUrls.push(...blAngleUrls);

          const checkinPayload = {
            order_number: jobDetail!.order_code,
            driver_id: user.id,
            driver_type: driverType,
            checkin_type: 'container_pickup_confirmed',
            photo_url: publicUrl,
            ...(allPhotoUrls.length > 0 && { photo_urls: allPhotoUrls }),
            notes: 'ยืนยันรับตู้หนัก',
            container_number: finalContainerNumber,
            seal_number: finalSealNumber,
          };
          console.log('[ContainerSOP] driverCheckin payload (pickup):', checkinPayload);
          const { data: checkinData, error: checkinError } = await driverCheckin(checkinPayload);

          if (!checkinError) {
            addOptimisticCheckin({
              orderNumber: jobDetail!.order_code,
              checkinType: 'container_pickup_confirmed',
            });
          }

          // BL job: fire one-shot return deadline notification (push + in-app).
          // Banner on the job page handles the live countdown.
          // Default to 2 days if container_free_days is not configured by office.
          if (!checkinError && isBLJob) {
            const freeDaysRaw = Number((jobDetail as any)?.container_free_days);
            const freeDays = Number.isFinite(freeDaysRaw) && freeDaysRaw > 0 ? freeDaysRaw : 2;
            console.log('[ContainerSOP] firing notify-container-return-deadline', {
              order_number: jobDetail!.order_code,
              container_number: finalContainerNumber,
              freeDays,
            });
            supabase.functions
              .invoke('notify-container-return-deadline', {
                body: {
                  user_id: user.id,
                  order_number: jobDetail!.order_code,
                  container_number: finalContainerNumber,
                  container_free_days: freeDays,
                },
              })
              .then((r) => console.log('[ContainerSOP] notify-container-return-deadline result:', r))
              .catch((e) => console.warn('[ContainerSOP] notify-container-return-deadline error:', e));
          }

          if (checkinError) {
            const errLower = checkinError.toLowerCase();
            const isDuplicate = errLower.includes('duplicate') || errLower.includes('already') || errLower.includes('picked') || errLower.includes('ได้รับไปแล้ว');
            if (isDuplicate) {
              const plateMatch = checkinError.match(/([ก-ฮa-zA-Z0-9]{1,4}[-\s]?[ก-ฮa-zA-Z0-9]{1,6})/);
              const plateFromData = (checkinData as any)?.picked_up_plate || (checkinData as any)?.data?.picked_up_plate || (checkinData as any)?.plate_number || (checkinData as any)?.data?.plate_number;
              const plateNumber = plateFromData || (plateMatch ? plateMatch[1] : '');
              const displayPlate = plateNumber || 'ไม่ทราบ';
              
              toast({
                title: 'ตู้ซ้ำ',
                description: `ตู้นี้รถทะเบียน ${displayPlate} ได้รับไปแล้ว`,
                variant: "destructive",
                duration: 8000,
              });
              setUploading(false);
              setShowConfirmDialog(false);
              return;
            }
            console.warn('[ContainerSOP] driverCheckin pickup error (non-blocking):', checkinError);
          }
        } catch (checkinErr) {
          console.warn('[ContainerSOP] driverCheckin pickup exception:', checkinErr);
        }
      }

      // Determine confirm status: container return / loaded (BL) / empty (Booking)
      const isBLJobForConfirm = !!jobDetail?.bl_no;
      let confirmStatus: 'container_return_confirmed' | 'loaded_container_confirmed' | 'container_sop_completed';
      if (isContainerReturn) {
        confirmStatus = 'container_return_confirmed';
      } else if (isLoadedContainer || isBLJobForConfirm) {
        confirmStatus = 'loaded_container_confirmed';
      } else {
        confirmStatus = 'container_sop_completed';
      }

      await sendJobStatus({
        jobId,
        orderCode: jobDetail!.order_code,
        userId: user.id,
        status: confirmStatus,
        sequenceNumber: 1,
        containerNumber: finalContainerNumber,
        sealNumber: finalSealNumber,
      });

      // Update order status via external API - split BL vs Booking
      const isBookingJob = !!jobDetail?.booking_no;
      let orderStatus: string;
      let orderNotes: string;
      
      if (isContainerReturn) {
        orderStatus = 'container_returned';
        orderNotes = returnSlipYardName ? `คืนตู้สำเร็จ | ลานคืนตู้: ${returnSlipYardName}` : 'คืนตู้สำเร็จ';
      } else if (isBookingJob) {
        orderStatus = 'in_transit';
        orderNotes = 'รับตู้เปล่าแล้ว กำลังไปจุดรับสินค้า';
      } else {
        // BL job - รับตู้หนักแล้ว กำลังไปจุดส่ง
        orderStatus = 'in_transit';
        orderNotes = 'รับตู้หนักแล้ว กำลังไปจุดส่ง';
      }
      
      try {
        const { error: statusError } = await updateOrderStatus({
          order_number: jobDetail!.order_code,
          status: orderStatus,
          driver_id: user.id,
          driver_type: driverType,
          notes: orderNotes,
        });
        if (statusError) {
          console.warn(`[ContainerSOP] updateOrderStatus ${orderStatus} error (non-blocking):`, statusError);
        } else {
          console.log(`[ContainerSOP] Order status updated to ${orderStatus}`);
        }
      } catch (statusErr) {
        console.warn(`[ContainerSOP] updateOrderStatus ${orderStatus} exception:`, statusErr);
      }

      // Booking job: fire one-shot CY closing date notification (push + in-app)
      // right after the driver confirms empty container pickup.
      if (!isContainerReturn && isBookingJob) {
        const closingTime = (jobDetail as any)?.closing_time
          || (navState?.jobData as any)?.closing_time
          || (navState?.jobData as any)?.closingTime
          || (navState?.jobData as any)?.closing_date
          || '';
        if (closingTime) {
          supabase.functions
            .invoke('notify-booking-closing-date', {
              body: {
                user_id: user.id,
                order_number: jobDetail!.order_code,
                container_number: finalContainerNumber,
                booking_no: jobDetail!.booking_no,
                closing_time: closingTime,
              },
            })
            .catch((e) => console.warn('[ContainerSOP] notify-booking-closing-date error:', e));
        } else {
          console.log('[ContainerSOP] Booking job has no closing_time, skipping notification');
        }
      }

      toast({
        title: t('containerSop.success'),
        description: t('containerSop.successMessage'),
      });

      if (isContainerReturn) {
        // Container return completed = international job done, redirect to home
        navigate('/');
      } else {
        const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${encodeURIComponent(jobId)}` : `/job/${encodeURIComponent(jobId)}`;
        navigate(backRoute);
      }
    } catch (error) {
      console.error('Error saving SOP:', error);
      toast({
        title: t('sop.error'),
        description: t('containerSop.saveError'),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setShowConfirmDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!jobDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">{t('containerSop.noData')}</div>
      </div>
    );
  }

  const pageTitle = isContainerReturn 
    ? 'แนบเอกสารคืนตู้' 
    : isLoadedContainer
      ? `ยืนยันรับตู้หนัก ${jobDetail.container_checkpoint}`
      : isEmptyContainer 
        ? `แนบเอกสารรับตู้เปล่า ${jobDetail.container_checkpoint}`
        : `${t('containerSop.title')} ${jobDetail.container_checkpoint}`;

  const confirmButtonText = isContainerReturn 
    ? 'ยืนยันคืนตู้' 
    : isLoadedContainer
      ? 'ยืนยันรับตู้หนัก'
      : isEmptyContainer 
        ? 'ยืนยันรับตู้เปล่า' 
        : t('containerSop.confirmButton');

  const currentEirCheck = eirBlOcrResult
    ? evaluateEirMatches(eirBlOcrResult)
    : { refStatus: eirBlMatchStatus, containerStatus: eirContainerMatchStatus, sealStatus: eirSealMatchStatus };
  const isEirBlockingConfirm = eirPhotoFiles.length > 0 && (
    isProcessingEirBlOcr ||
    currentEirCheck.refStatus === 'mismatch' ||
    currentEirCheck.refStatus === 'not_found' ||
    currentEirCheck.containerStatus === 'mismatch' ||
    currentEirCheck.containerStatus === 'not_found'
  );
  const isConfirmDisabled = uploading || checkingExpenses || isEirBlockingConfirm;
  const isWaitingForContainerPhotoOcr = needsOCR && Boolean(eirBlOcrResult?.container_number) && !isContainerOcrDone;
  const eirJobReferenceRows = [
    { label: 'BL ในงาน', value: jobDetail?.bl_no },
    { label: 'Booking ในงาน', value: jobDetail?.booking_no },
  ].filter((row) => Boolean(row.value));
  const eirOcrReferenceRows = ([
    { label: 'BL จาก OCR', value: eirBlOcrResult?.bl_no, field: 'bl_no' as const },
    { label: 'Booking จาก OCR', value: eirBlOcrResult?.booking_no, field: 'booking_no' as const },
  ]).filter((row) => Boolean(row.value));

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${encodeURIComponent(jobId)}` : `/job/${encodeURIComponent(jobId)}`;
            navigate(backRoute);
          }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 flex flex-col gap-6">
        <JobActionButtons jobId={jobId} orderNumber={jobId} jobData={navState?.jobData} />

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('sop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(checkInTime, language)} | {formatTime(checkInTime)}
              </div>
            </div>
          </div>
        </Card>

        {/* === BL Job: Flexible container/truck photos === */}
        {isBLJob && !isContainerReturn && (
          <div className="space-y-2 order-2">
            <Label className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">2</span>
              ถ่ายรูปตู้ / รูปรถ <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {blContainerPhotoPreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <button
                    onClick={() => {
                      setActiveBlAngleIndex(idx);
                      openPhotoDrawer('bl_angle');
                    }}
                    className="w-full h-28 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors bg-white overflow-hidden"
                  >
                    <img src={preview} alt={`รูปที่ ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                  </button>
                  <button
                    onClick={() => {
                      setBlContainerPhotoFiles(prev => prev.filter((_, i) => i !== idx));
                      setBlContainerPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{idx + 1}</span>
                </div>
              ))}
              {/* Add new photo button */}
              <button
                onClick={() => {
                  setActiveBlAngleIndex(blContainerPhotoFiles.length);
                  openPhotoDrawer('bl_angle');
                }}
                className="w-full h-28 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors bg-white"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground">เพิ่มรูป</p>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              แนบรูปตู้คอนเทนเนอร์หรือรูปรถ ({blContainerPhotoFiles.length} รูป)
            </p>
          </div>
        )}

        {/* === Photo: Container Number - Hide for container return === */}
        {!isContainerReturn && (
        <div className="space-y-2 order-3">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">{isBLJob ? '3' : '2'}</span>
            ถ่ายรูปเลขตู้ (Container No.) <span className="text-red-500">*</span>
          </Label>
          
          <button
            onClick={() => openPhotoDrawer('container')}
            className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-white"
          >
            {containerPhotoPreview ? (
              <img src={containerPhotoPreview} alt="Container" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">กดเพื่อถ่ายรูปเลขตู้</p>
              </>
            )}
          </button>

          {isProcessingContainerOcr && (
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">กำลังอ่านเลขตู้จากรูป...</span>
              </div>
            </Card>
          )}

          {pendingContainerOcr !== null && !isProcessingContainerOcr && !isContainerOcrDone && (
            <Card className="p-3 bg-blue-50 border-blue-300">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-700 text-sm">ผลการสแกน</span>
              </div>
              <div className="bg-white rounded-lg p-2 border border-blue-200 mb-2">
                <label className="text-xs text-muted-foreground block mb-1">เลขตู้</label>
                <input
                  type="text"
                  value={pendingContainerOcr}
                    onChange={(e) => setPendingContainerOcr(e.target.value.toUpperCase())}
                  className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                  placeholder="กรอกเลขตู้"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-white rounded-lg p-2 border border-blue-200">
                  <label className="text-[10px] text-muted-foreground block mb-1">MAX GROSS (kg)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pendingMaxGross}
                    onChange={(e) => setPendingMaxGross(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded font-semibold text-sm focus:outline-none focus:border-blue-500"
                    placeholder="-"
                  />
                </div>
                <div className="bg-white rounded-lg p-2 border border-blue-200">
                  <label className="text-[10px] text-muted-foreground block mb-1">TARE (kg)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pendingTareWeight}
                    onChange={(e) => setPendingTareWeight(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded font-semibold text-sm focus:outline-none focus:border-blue-500"
                    placeholder="-"
                  />
                </div>
                <div className="bg-white rounded-lg p-2 border border-blue-200">
                  <label className="text-[10px] text-muted-foreground block mb-1">NET (kg)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pendingNetWeight}
                    onChange={(e) => setPendingNetWeight(e.target.value)}
                    className="w-full px-1.5 py-1 border border-gray-300 rounded font-semibold text-sm focus:outline-none focus:border-blue-500"
                    placeholder="-"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setPendingContainerOcr(null); openPhotoDrawer('container'); }}>
                  ถ่ายใหม่
                </Button>
                <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={confirmContainerOcr} disabled={!pendingContainerOcr}>
                  ยืนยันเลขตู้
                </Button>
              </div>
            </Card>
          )}

        </div>
        )}

        {/* === Photo: Seal Number - Hide for container return === */}
        {!isContainerReturn && (
        <div className="space-y-2 order-4">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">{isBLJob ? '4' : '3'}</span>
            ถ่ายรูปเลขซีล (Seal No.) <span className="text-red-500">*</span>
          </Label>
          
          <button
            onClick={() => openPhotoDrawer('seal')}
            className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-white"
          >
            {sealPhotoPreview ? (
              <img src={sealPhotoPreview} alt="Seal" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">กดเพื่อถ่ายรูปเลขซีล</p>
              </>
            )}
          </button>

          {isProcessingSealOcr && (
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">กำลังอ่านเลขซีลจากรูป...</span>
              </div>
            </Card>
          )}

          {pendingSealOcr !== null && !isProcessingSealOcr && !isSealOcrDone && (
            <Card className="p-3 bg-blue-50 border-blue-300">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-700 text-sm">ผลการสแกน</span>
              </div>
              <div className="bg-white rounded-lg p-2 border border-blue-200 mb-2">
                <label className="text-xs text-muted-foreground block mb-1">เลขซีล</label>
                <input
                  type="text"
                  value={pendingSealOcr}
                  onChange={(e) => setPendingSealOcr(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                  placeholder="กรอกเลขซีล"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setPendingSealOcr(null); openPhotoDrawer('seal'); }}>
                  ถ่ายใหม่
                </Button>
                <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={confirmSealOcr} disabled={!pendingSealOcr}>
                  ยืนยันเลขซีล
                </Button>
              </div>
            </Card>
          )}

        </div>
        )}

        {/* === Photo: EIR Document (no OCR) - Multiple photos === */}
        <div className="space-y-2 order-1">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">1</span>
            ถ่ายรูปเอกสาร EIR <span className="text-red-500">*</span>
          </Label>
          
          <div className="grid grid-cols-2 gap-2">
            {eirPhotoPreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <button
                  onClick={() => {
                    setActiveEirIndex(idx);
                    openPhotoDrawer('eir', idx);
                  }}
                  className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden hover:border-primary/50 transition-colors bg-white"
                >
                  <img src={preview} alt={`EIR ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                </button>
                <button
                  onClick={() => {
                    const newFiles = eirPhotoFiles.filter((_, i) => i !== idx);
                    setEirPhotoFiles(newFiles);
                    setEirPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
                    if (idx === 0 || newFiles.length === 0) {
                      setEirBlOcrResult(null);
                      setEirBlMatchStatus(null);
                      setEirContainerMatchStatus(null);
                    }
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
                <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">EIR {idx + 1}</span>
              </div>
            ))}
            
            {/* Add new EIR button */}
            <button
              onClick={() => {
                openPhotoDrawer('eir', eirPhotoFiles.length);
              }}
              className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-white"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {eirPhotoFiles.length === 0 ? <FileText className="w-5 h-5 text-muted-foreground" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {eirPhotoFiles.length === 0 ? 'กดเพื่อถ่ายรูป EIR' : 'เพิ่มรูป EIR'}
              </p>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            แนบรูปเอกสาร EIR ({eirPhotoFiles.length} รูป)
          </p>

          {/* EIR BL/Booking verification result (pickup only) */}
          {(eirPhotoFiles.length > 0 || isProcessingEirBlOcr || eirBlOcrResult) && (
            <>
              {isProcessingEirBlOcr && (
                <Card className="p-3 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700">กำลังตรวจสอบเลข BL/Booking จาก EIR...</span>
                  </div>
                </Card>
              )}
              {!isProcessingEirBlOcr && eirBlMatchStatus === 'match' && (
                <Card className="p-3 bg-green-50 border-green-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-700 text-sm">อ่านเลขจาก EIR แล้ว</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OCR</span>
                  </div>
                  <div className="text-xs text-green-800 space-y-1">
                    {eirJobReferenceRows.map((row) => (
                      <p key={row.label}>{row.label}: <span className="font-semibold">{row.value}</span></p>
                    ))}
                    {eirOcrReferenceRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <label className="whitespace-nowrap">{row.label}:</label>
                        <Input
                          value={row.value || ''}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase();
                            setEirBlOcrResult((prev) => ({
                              bl_no: prev?.bl_no ?? null,
                              booking_no: prev?.booking_no ?? null,
                              container_number: prev?.container_number ?? null,
                              seal_number: prev?.seal_number ?? null,
                              [row.field]: v,
                            }));
                          }}
                          className="h-7 text-xs bg-white flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {!isProcessingEirBlOcr && eirBlMatchStatus === 'mismatch' && (
                <Card className="p-3 bg-red-50 border-red-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-800 text-sm">เลข BL/Booking ใน EIR ไม่ตรงกับงานนี้ — ไม่สามารถยืนยันได้</span>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">OCR</span>
                  </div>
                  <div className="text-xs text-red-900 space-y-1">
                    {eirJobReferenceRows.map((row) => (
                      <p key={row.label}>{row.label}: <span className="font-semibold">{row.value}</span></p>
                    ))}
                    {eirOcrReferenceRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <label className="whitespace-nowrap">{row.label}:</label>
                        <Input
                          value={row.value || ''}
                          onChange={(e) => {
                            const v = e.target.value.toUpperCase();
                            setEirBlOcrResult((prev) => ({
                              bl_no: prev?.bl_no ?? null,
                              booking_no: prev?.booking_no ?? null,
                              container_number: prev?.container_number ?? null,
                              seal_number: prev?.seal_number ?? null,
                              [row.field]: v,
                            }));
                          }}
                          className="h-7 text-xs bg-white flex-1"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isProcessingEirBlOcr}
                    onClick={async () => {
                      const file = await getEirFileForOcr();
                      if (file) {
                        await runEirBlOcr(file);
                      } else {
                        toast({ title: 'ไม่พบรูป EIR', description: 'กรุณาถ่ายรูป EIR ก่อน', variant: 'destructive' });
                      }
                    }}
                  >
                    {isProcessingEirBlOcr ? 'กำลัง OCR...' : 'ตรวจสอบอีกครั้ง'}
                  </Button>
                </Card>
              )}
              {!isProcessingEirBlOcr && eirBlMatchStatus === 'not_found' && (
                <Card className="p-3 bg-amber-50 border-amber-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-amber-800 font-medium">ไม่พบเลข BL/Booking ใน EIR — ต้องถ่ายใหม่ให้เห็นเลขชัดเจน</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-amber-900">กรอกเลขเองด้านล่าง หรือถ่ายรูป EIR ใหม่ แล้วกดตรวจสอบอีกครั้ง</p>
                    <div className="text-xs text-amber-900 space-y-1">
                      {eirJobReferenceRows.map((row) => (
                        <p key={row.label}>{row.label} (ในงาน): <span className="font-semibold">{row.value}</span></p>
                      ))}
                      {([
                        { label: 'BL จาก OCR', field: 'bl_no' as const, jobValue: jobDetail?.bl_no },
                        { label: 'Booking จาก OCR', field: 'booking_no' as const, jobValue: jobDetail?.booking_no },
                      ])
                        .filter((row) => Boolean(row.jobValue))
                        .map((row) => (
                          <div key={row.label} className="flex items-center gap-2">
                            <label className="whitespace-nowrap">{row.label}:</label>
                            <Input
                              value={(eirBlOcrResult?.[row.field] as string | null | undefined) || ''}
                              placeholder="กรอกเลขเอง"
                              onChange={(e) => {
                                const v = e.target.value.toUpperCase();
                                setEirBlOcrResult((prev) => ({
                                  bl_no: prev?.bl_no ?? null,
                                  booking_no: prev?.booking_no ?? null,
                                  container_number: prev?.container_number ?? null,
                                  seal_number: prev?.seal_number ?? null,
                                  [row.field]: v,
                                }));
                              }}
                              className="h-7 text-xs bg-white flex-1"
                            />
                          </div>
                        ))}

                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={isProcessingEirBlOcr}
                        onClick={async () => {
                          const file = await getEirFileForOcr();
                          if (file) {
                            await runEirBlOcr(file);
                          } else {
                            toast({ title: 'ไม่พบรูป EIR', description: 'กรุณาถ่ายรูป EIR ก่อน', variant: 'destructive' });
                          }
                        }}
                      >
                        {isProcessingEirBlOcr ? 'กำลัง OCR...' : 'ตรวจสอบอีกครั้ง'}
                      </Button>
                    </div>
                  </div>

                </Card>
              )}

              {/* Container number match */}
              {!isProcessingEirBlOcr && eirContainerMatchStatus === 'match' && (
                <Card className="p-3 bg-green-50 border-green-300 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-700 text-sm">เลขตู้ตรงกับงาน</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OCR</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-800">
                    <label className="whitespace-nowrap">ตู้:</label>
                    <Input
                      value={eirBlOcrResult?.container_number || ''}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase();
                        setEirBlOcrResult((prev) => ({
                          bl_no: prev?.bl_no ?? null,
                          booking_no: prev?.booking_no ?? null,
                          container_number: v,
                          seal_number: prev?.seal_number ?? null,
                        }));
                      }}
                      className="h-7 text-xs bg-white flex-1"
                    />
                  </div>
                </Card>
              )}
              {!isProcessingEirBlOcr && eirContainerMatchStatus === 'mismatch' && (
                <Card className="p-3 bg-red-50 border-red-400">
                  <div className="flex items-center gap-2 mb-1">
                    <X className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-800 text-sm">เลขตู้ใน EIR ไม่ตรงกับงานนี้ — ไม่สามารถยืนยันได้</span>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">OCR</span>
                  </div>
                  <div className="text-xs text-red-900 space-y-0.5">
                    <p>{isContainerOcrDone ? 'ตู้จากรูปตู้' : 'เลขตู้ในงาน'}: <span className="font-semibold">{(isContainerOcrDone ? ocrContainerNumber : getAssignedContainerForEir()) || '-'}</span></p>
                    <p>ตู้ใน EIR: <span className="font-semibold">{eirBlOcrResult?.container_number}</span></p>
                  </div>
                </Card>
              )}
              {!isProcessingEirBlOcr && eirContainerMatchStatus === 'not_found' && (
                <Card className={`p-3 ${getExpectedContainerForEir() && !isWaitingForContainerPhotoOcr ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Scan className={`w-4 h-4 ${getExpectedContainerForEir() && !isWaitingForContainerPhotoOcr ? 'text-red-600' : 'text-amber-600'}`} />
                    <span className={`font-semibold text-sm ${getExpectedContainerForEir() && !isWaitingForContainerPhotoOcr ? 'text-red-800' : 'text-amber-800'}`}>
                      {isWaitingForContainerPhotoOcr
                        ? 'อ่านเลขตู้จาก EIR แล้ว — รอเลขตู้จากรูปตู้'
                        : eirBlOcrResult?.container_number
                        ? 'อ่านเลขตู้จาก EIR แล้ว — รอเทียบกับรูปเลขตู้'
                        : 'ไม่พบเลขตู้ใน EIR — ไม่สามารถยืนยันได้'}
                    </span>
                  </div>
                  <div className={`text-xs space-y-0.5 ${getExpectedContainerForEir() && !isWaitingForContainerPhotoOcr ? 'text-red-900' : 'text-amber-900'}`}>
                    <p>ตู้จากรูปตู้: <span className="font-semibold">{isContainerOcrDone ? (ocrContainerNumber || '-') : 'รออัปโหลด/ยืนยัน'}</span></p>
                    <p>ตู้ใน EIR: <span className="font-semibold">{eirBlOcrResult?.container_number || '-'}</span></p>
                  </div>
                </Card>
              )}

              {/* Seal number comparison (warning only, never blocks confirm) */}
              {!isProcessingEirBlOcr && eirSealMatchStatus === 'match' && Boolean(getExpectedSealForEir()) && (
                <Card className="p-3 bg-green-50 border-green-300">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-700 text-sm">เลขซีลตรงกัน</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OCR</span>
                  </div>
                  <div className="text-xs text-green-800 space-y-0.5">
                    <p>ซีลจากรูป/ในงาน: <span className="font-semibold">{(isSealOcrDone ? ocrSealNumber : null) || sealNumber || jobDetail?.seal_number || '-'}</span></p>
                    <p>ซีลใน EIR: <span className="font-semibold">{eirBlOcrResult?.seal_number || '-'}</span></p>
                  </div>
                </Card>
              )}
              {!isProcessingEirBlOcr && (eirSealMatchStatus === 'mismatch' || (eirSealMatchStatus === 'not_found' && Boolean(getExpectedSealForEir()))) && (
                <Card className="p-3 bg-amber-50 border-amber-400 space-y-2">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-amber-600" />
                    <span className="font-semibold text-amber-800 text-sm">
                      {eirSealMatchStatus === 'mismatch'
                        ? 'เลขซีลใน EIR ไม่ตรงกับที่ถ่าย — โปรดตรวจสอบ'
                        : 'ไม่พบเลขซีลใน EIR — แนะนำให้ถ่ายใหม่ให้เห็นเลขซีลชัดเจน'}
                    </span>
                  </div>
                  <div className="text-xs text-amber-900 space-y-1">
                    <p>ซีลจากรูป/ในงาน: <span className="font-semibold">{(isSealOcrDone ? ocrSealNumber : null) || sealNumber || jobDetail?.seal_number || '-'}</span></p>
                    <div className="flex items-center gap-2">
                      <label className="whitespace-nowrap">ซีลใน EIR:</label>
                      <Input
                        value={eirBlOcrResult?.seal_number || ''}
                        placeholder="กรอกเลขซีลเอง"
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase();
                          setEirBlOcrResult((prev) => ({
                            bl_no: prev?.bl_no ?? null,
                            booking_no: prev?.booking_no ?? null,
                            container_number: prev?.container_number ?? null,
                            seal_number: v,
                          }));
                        }}
                        className="h-7 text-xs bg-white flex-1"
                      />
                    </div>
                    <p className="text-[11px] text-amber-800">* เป็นการเตือนเท่านั้น ยังกดยืนยันงานต่อได้</p>
                  </div>
                </Card>
              )}



            </>
          )}

        </div>

        {/* === Trailer License Plate Photos (BL/Booking only, optional, multi-photo with OCR) === */}
        {showTrailerPlateSection && (
          <div className="space-y-2 order-5">
            <Label className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">
                {isContainerReturn ? '2' : '5'}
              </span>
              ถ่ายรูปทะเบียนหางลาก <span className="text-xs text-muted-foreground">(ไม่บังคับ)</span>
            </Label>

            <div className="grid grid-cols-2 gap-2">
              {trailerPlatePhotoPreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <button
                    onClick={() => {
                      setActiveTrailerPlateIndex(idx);
                      openPhotoDrawer('trailer_plate', idx);
                    }}
                    className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden hover:border-primary/50 transition-colors bg-white"
                  >
                    <img src={preview} alt={`ทะเบียน ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                  </button>
                  <button
                    onClick={() => {
                      setTrailerPlatePhotoFiles(prev => prev.filter((_, i) => i !== idx));
                      setTrailerPlatePhotoPreviews(prev => prev.filter((_, i) => i !== idx));
                      setTrailerPlateOcrResults(prev => prev.filter((_, i) => i !== idx));
                      setPendingTrailerPlateOcr(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {trailerPlateOcrResults[idx] && (
                    <span className="absolute bottom-1 left-1 right-1 text-[11px] bg-green-600 text-white px-1.5 py-0.5 rounded text-center font-semibold truncate flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {trailerPlateOcrResults[idx]}
                    </span>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  setActiveTrailerPlateIndex(trailerPlatePhotoFiles.length);
                  openPhotoDrawer('trailer_plate', trailerPlatePhotoFiles.length);
                }}
                className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-white"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  {trailerPlatePhotoFiles.length === 0 ? <Camera className="w-5 h-5 text-muted-foreground" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {trailerPlatePhotoFiles.length === 0 ? 'กดเพื่อถ่ายรูปทะเบียน' : 'เพิ่มรูปทะเบียน'}
                </p>
              </button>
            </div>

            {isProcessingTrailerPlateOcr && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>กำลังอ่านทะเบียน...</span>
              </div>
            )}

            {/* Pending OCR confirmation cards (one per photo awaiting confirm) */}
            {pendingTrailerPlateOcr.map((pending, idx) => {
              if (pending === null || pending === undefined) return null;
              return (
                <Card key={`pending-plate-${idx}`} className="p-3 bg-blue-50 border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">ทะเบียนหางลาก (รูปที่ {idx + 1})</Label>
                  </div>
                  <input
                    type="text"
                    value={pending}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPendingTrailerPlateOcr(prev => {
                        const n = [...prev];
                        n[idx] = v;
                        return n;
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded font-semibold text-sm focus:outline-none focus:border-blue-500"
                    placeholder="กรอกเลขทะเบียน"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      setPendingTrailerPlateOcr(prev => {
                        const n = [...prev];
                        n[idx] = null;
                        return n;
                      });
                      setActiveTrailerPlateIndex(idx);
                      openPhotoDrawer('trailer_plate', idx);
                    }}>
                      ถ่ายใหม่
                    </Button>
                    <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={() => confirmTrailerPlateOcr(idx)}>
                      ยืนยันทะเบียน
                    </Button>
                  </div>
                </Card>
              );
            })}

            <p className="text-xs text-muted-foreground">
              แนบรูปทะเบียนหางลาก ({trailerPlatePhotoFiles.length} รูป) — ระบบจะอ่านเลขทะเบียนให้อัตโนมัติ แล้วกดยืนยัน
            </p>
          </div>
        )}


        {/* === OCR Return Slip Result (for unknown yard) === */}
        {isContainerReturn && isYardUnknown && (
          <div className="space-y-2 order-6">
            {returnSlipYardName ? (
              <Card className="p-3 bg-green-50 border-green-300">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-700 text-sm">ชื่อลานที่อ่านได้</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OCR</span>
                </div>
                <p className="text-base font-bold text-green-800">{returnSlipYardName}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2" 
                  onClick={() => { setReturnSlipYardName(null); setPendingReturnSlipYard(null); }}
                >
                  สแกนใหม่
                </Button>
              </Card>
            ) : isProcessingReturnSlipOcr ? (
              <Card className="p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">กำลังอ่านชื่อลานจาก EIR...</span>
                </div>
              </Card>
            ) : pendingReturnSlipYard !== null ? (
              <Card className="p-3 bg-blue-50 border-blue-300">
                <div className="flex items-center gap-2 mb-2">
                  <Scan className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-blue-700 text-sm">ผลการสแกนชื่อลาน</span>
                </div>
                <div className="bg-white rounded-lg p-2 border border-blue-200 mb-2">
                  <label className="text-xs text-muted-foreground block mb-1">ชื่อลาน</label>
                  <input
                    type="text"
                    value={pendingReturnSlipYard}
                    onChange={(e) => setPendingReturnSlipYard(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                    placeholder="กรอกชื่อลาน"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPendingReturnSlipYard(null)}>
                    ยกเลิก
                  </Button>
                  <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={confirmReturnSlipYard} disabled={!pendingReturnSlipYard?.trim()}>
                    ยืนยันชื่อลาน
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        )}

      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={handleConfirmClick}
          disabled={isConfirmDisabled}
        >
          {checkingExpenses ? t('common.loading') : uploading ? t('sop.saving') : confirmButtonText}
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            <DialogTitle className="text-xl text-center">
              {isContainerReturn ? 'ยืนยันการคืนตู้' : isLoadedContainer || isBLJob ? 'ยืนยันการรับตู้หนัก' : t('containerSop.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {isContainerReturn ? 'คุณต้องการยืนยันการคืนตู้ใช่หรือไม่?' : isLoadedContainer || isBLJob ? 'คุณต้องการยืนยันการรับตู้หนักใช่หรือไม่?' : t('containerSop.confirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 h-11"
              disabled={uploading}
            >
              {t('sop.cancel')}
            </Button>
            <Button
              onClick={handleConfirmSOP}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              disabled={uploading || isEirBlockingConfirm}
            >
              {uploading ? t('sop.saving') : t('sop.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing Expenses Dialog */}
      <Dialog open={showMissingExpenseDialog} onOpenChange={setShowMissingExpenseDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="text-4xl">📋</span>
            </div>
            <DialogTitle className="text-xl text-center">
              {t('expense.requiredExpenseMissing')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('expense.missingTypes').replace('{types}', missingExpenseTypes.join(', '))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowMissingExpenseDialog(false)}
              className="flex-1 h-11"
            >
              {t('sop.cancel')}
            </Button>
            <Button
              onClick={() => {
                setShowMissingExpenseDialog(false);
                navigate(`/job/${encodeURIComponent(jobId)}/add-expense`, { 
                  state: { 
                    jobData: navState?.jobData,
                    returnPath: location.pathname,
                    checkinType: checkinTypeFromState,
                  } 
                });
              }}
              className="flex-1 h-11 bg-primary hover:bg-primary/90"
            >
              {t('expense.goToAddExpense')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={showPhotoDrawer} onOpenChange={setShowPhotoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('sop.selectSource')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handlePhotoSelect('camera')}>
              <Camera className="w-6 h-6" />
              {t('sop.takePhoto')}
            </Button>
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handlePhotoSelect('gallery')}>
              <ImageIcon className="w-6 h-6" />
              {t('sop.selectFromGallery')}
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12">{t('sop.cancel')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Return Slip OCR Drawer */}
      <Drawer open={showReturnSlipDrawer} onOpenChange={setShowReturnSlipDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">สแกนใบคืนตู้</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handleReturnSlipOcr('camera')}>
              <Camera className="w-6 h-6" />
              ถ่ายรูปใบคืนตู้
            </Button>
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handleReturnSlipOcr('gallery')}>
              <ImageIcon className="w-6 h-6" />
              เลือกจากแกลเลอรี
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12">ยกเลิก</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ContainerSOPPage;
