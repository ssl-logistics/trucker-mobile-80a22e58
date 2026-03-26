import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle, Image as ImageIcon, Scan, Loader2, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getDriverAssignedJobs, getFreelanceAcceptedJobs, submitOcrScan, verifyOcrContainer, driverCheckin, updateOrderStatus } from '@/lib/externalApi';
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
}

type PhotoSlot = 'container' | 'seal' | 'eir' | 'bl_angle' | 'bl_eir';
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
  
  // OCR state
  const [isProcessingContainerOcr, setIsProcessingContainerOcr] = useState(false);
  const [isProcessingSealOcr, setIsProcessingSealOcr] = useState(false);
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [isContainerOcrDone, setIsContainerOcrDone] = useState(false);
  const [isSealOcrDone, setIsSealOcrDone] = useState(false);
  
  const [pendingContainerOcr, setPendingContainerOcr] = useState<string | null>(null);
  const [pendingSealOcr, setPendingSealOcr] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [ocrImageUrl, setOcrImageUrl] = useState<string | undefined>(undefined);

  const [containerNumber] = useState(navState?.verifiedContainer || "");
  const [sealNumber] = useState(navState?.verifiedSeal || "");
  

  useEffect(() => {
    if (jobId && user) {
      loadJobDetail();
    }
  }, [jobId, user]);

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

  const openPhotoDrawer = (slot: PhotoSlot, eirIndex: number = 0) => {
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
        input.onchange = async (e) => {
          file = (e.target as HTMLInputElement).files?.[0] || null;
          if (file) {
            await processFileForSlot(file, activePhotoSlot);
          }
          document.body.removeChild(input);
          resolve();
        };
        // Cleanup if user cancels
        const handleFocus = () => {
          setTimeout(() => {
            if (input.parentNode) {
              document.body.removeChild(input);
            }
            window.removeEventListener('focus', handleFocus);
            resolve();
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
  };

  const runContainerOcr = async (file: File) => {
    setIsProcessingContainerOcr(true);
    setPendingContainerOcr(null);
    setIsContainerOcrDone(false);
    try {
      toast({ title: 'กำลังอ่านเลขตู้...', description: 'รอสักครู่...' });
      const result = await extractFromImage(file, 'container_seal');
      if (result.success && result.data?.container_number) {
        setPendingContainerOcr(result.data.container_number);
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
    setOcrContainerNumber(pendingContainerOcr);
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

  const handleConfirmClick = () => {
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
    if (eirPhotoFiles.length === 0) {
      toast({ title: 'กรุณาถ่ายรูป EIR', variant: "destructive" });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    const primaryEirFile = eirPhotoFiles[0];
    if (!primaryEirFile || !jobId || !user) return;

    setUploading(true);
    try {

      // Upload ALL photos in PARALLEL for speed
      const timestamp = Date.now();
      
      // Prepare EIR upload promises
      const eirUploadPromises = eirPhotoFiles.map((file, i) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `eir_${jobId}_${timestamp}_${i}.${fileExt}`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'container-photos');
        formData.append('fileName', fileName);
        return supabase.functions.invoke('upload-to-s3', { body: formData });
      });

      // Prepare BL container photo promises
      const blUploadPromises = (isBLJob && !isContainerReturn) 
        ? blContainerPhotoFiles.filter(Boolean).map((file, i) => {
            const aFormData = new FormData();
            aFormData.append('file', file);
            aFormData.append('folder', 'container-photos');
            aFormData.append('fileName', `container_photo_${i}_${jobId}_${timestamp}.${file.name.split('.').pop() || 'jpg'}`);
            return supabase.functions.invoke('upload-to-s3', { body: aFormData });
          })
        : [];

      // Prepare container & seal photo promises
      const containerUploadPromise = containerPhotoFile ? (() => {
        const cFormData = new FormData();
        cFormData.append('file', containerPhotoFile);
        cFormData.append('folder', 'container-photos');
        cFormData.append('fileName', `ocr_container_${jobId}_${timestamp}.${containerPhotoFile.name.split('.').pop() || 'jpg'}`);
        return supabase.functions.invoke('upload-to-s3', { body: cFormData });
      })() : Promise.resolve({ data: null, error: null });

      const sealUploadPromise = sealPhotoFile ? (() => {
        const sFormData = new FormData();
        sFormData.append('file', sealPhotoFile);
        sFormData.append('folder', 'container-photos');
        sFormData.append('fileName', `ocr_seal_${jobId}_${timestamp}.${sealPhotoFile.name.split('.').pop() || 'jpg'}`);
        return supabase.functions.invoke('upload-to-s3', { body: sFormData });
      })() : Promise.resolve({ data: null, error: null });

      // Execute ALL uploads in parallel
      const [eirResults, blResults, containerResult, sealResult] = await Promise.all([
        Promise.all(eirUploadPromises),
        Promise.all(blUploadPromises),
        containerUploadPromise,
        sealUploadPromise,
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
            container_no: finalContainerNumber,
            seal_no: finalSealNumber || null,
            container_image_url: containerImageUrl || undefined,
            seal_image_url: sealImageUrl || undefined,
            container_photos: blAngleUrls.length > 0 ? blAngleUrls : undefined,
            eir_photos: eirUrls.length > 0 ? eirUrls : undefined,
            order_number: jobId || undefined,
            driver_id: user.id,
            driver_type: ocrDriverType,
            scanned_at: new Date().toISOString(),
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
          const checkinPayload: Parameters<typeof driverCheckin>[0] = {
            order_number: jobDetail!.order_code,
            driver_id: user.id,
            driver_type: driverType,
            checkin_type: 'container_return_confirmed',
            notes: 'ยืนยันคืนตู้สำเร็จ',
            container_number: finalContainerNumber,
            seal_number: finalSealNumber,
            ...(eirUrls.length > 0 && { photo_urls: eirUrls }),
            ...(publicUrl && { photo_url: publicUrl }),
          };
          const { error: checkinError } = await driverCheckin(checkinPayload);
          if (checkinError) {
            console.warn('[ContainerSOP] driverCheckin error (non-blocking):', checkinError);
          }
        } catch (checkinErr) {
          console.warn('[ContainerSOP] driverCheckin exception:', checkinErr);
        }
      } else {
        // Send driverCheckin for loaded container pickup — only after OCR duplicate check passed
        try {
          const checkinPayload = {
            order_number: jobDetail!.order_code,
            driver_id: user.id,
            driver_type: driverType,
            checkin_type: 'container_pickup_confirmed',
            photo_url: publicUrl,
            notes: 'ยืนยันรับตู้หนัก',
            container_number: finalContainerNumber,
            seal_number: finalSealNumber,
          };
          console.log('[ContainerSOP] driverCheckin payload (pickup):', checkinPayload);
          const { data: checkinData, error: checkinError } = await driverCheckin(checkinPayload);
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

      await sendJobStatus({
        jobId,
        orderCode: jobDetail!.order_code,
        userId: user.id,
        status: isContainerReturn ? 'container_return_confirmed' : 'container_sop_completed',
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
        orderNotes = 'คืนตู้สำเร็จ';
      } else if (isBookingJob) {
        orderStatus = 'in_transit';
        orderNotes = 'รับตู้เปล่าแล้ว กำลังไปจุดรับสินค้า';
      } else {
        // BL job
        orderStatus = 'in_progress';
        orderNotes = 'รับตู้แล้ว';
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

      toast({
        title: t('containerSop.success'),
        description: t('containerSop.successMessage'),
      });

      if (isContainerReturn) {
        // Container return completed = international job done, redirect to home
        navigate('/');
      } else {
        const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${jobId}` : `/job/${jobId}`;
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

  const blAnglePhotosReady = isBLJob && !isContainerReturn ? blContainerPhotoFiles.length > 0 : true;
   const allPhotosReady = isContainerReturn 
    ? eirPhotoFiles.length > 0 
    : (containerPhotoFile && sealPhotoFile && eirPhotoFiles.length > 0 && blAnglePhotosReady);
  const ocrReady = needsOCR ? (isContainerOcrDone && isSealOcrDone) : true;
  const isConfirmDisabled = uploading || !allPhotosReady || !ocrReady;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${jobId}` : `/job/${jobId}`;
            navigate(backRoute);
          }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} orderNumber={jobId} />

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('sop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(jobDetail.start_date, language)} | {formatTime(checkInTime)}
              </div>
            </div>
          </div>
        </Card>

        {/* === BL Job: Flexible container/truck photos === */}
        {isBLJob && !isContainerReturn && (
          <div className="space-y-2">
            <Label className="text-base flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">1</span>
              ถ่ายรูปตู้ / รูปรถ <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {blContainerPhotoPreviews.map((preview, idx) => (
                <div key={idx} className="relative">
                  <button
                    onClick={() => {
                      setActiveBlAngleIndex(idx);
                      setActivePhotoSlot('bl_angle');
                      setShowPhotoDrawer(true);
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
                  setActivePhotoSlot('bl_angle');
                  setShowPhotoDrawer(true);
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
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">{isBLJob ? '2' : '1'}</span>
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
                  onChange={(e) => setPendingContainerOcr(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                  placeholder="กรอกเลขตู้"
                />
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
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">{isBLJob ? '3' : '2'}</span>
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
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#225795] text-white text-xs font-bold">{isContainerReturn ? '1' : isBLJob ? '4' : '3'}</span>
            ถ่ายรูปเอกสาร EIR <span className="text-red-500">*</span>
          </Label>
          
          <div className="grid grid-cols-2 gap-2">
            {eirPhotoPreviews.map((preview, idx) => (
              <div key={idx} className="relative">
                <button
                  onClick={() => {
                    setActiveEirIndex(idx);
                    openPhotoDrawer('eir');
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

        </div>


      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={handleConfirmClick}
          disabled={isConfirmDisabled}
        >
          {uploading ? t('sop.saving') : confirmButtonText}
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
              disabled={uploading}
            >
              {uploading ? t('sop.saving') : t('sop.confirm')}
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
    </div>
  );
};

export default ContainerSOPPage;
