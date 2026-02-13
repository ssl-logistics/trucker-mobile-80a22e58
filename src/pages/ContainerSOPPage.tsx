import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle, Image as ImageIcon, Scan, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getDriverAssignedJobs, getFreelanceAcceptedJobs, submitOcrScan, verifyOcrContainer, driverCheckin } from '@/lib/externalApi';
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
  transport_type?: string;
}

const ContainerSOPPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const { t, language } = useLanguage();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();
  const { extractFromImage, extracting } = useOCR();
  
  // Get verified data and job data from navigation state
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
  
  // Detect inbound from job data as fallback when navState doesn't have explicit loaded_container
  const isInboundFromJobData = !!jobDetail?.bl_no || jobDetail?.transport_type?.includes('ขาเข้า');
  const isLoadedContainer = checkinTypeFromState === 'loaded_container' || (!isContainerReturn && checkinTypeFromState !== 'empty_container' && isInboundFromJobData);
  const isEmptyContainer = !isContainerReturn && !isLoadedContainer;
  const needsOCR = isEmptyContainer || isLoadedContainer;
  const needsApiVerify = isLoadedContainer; // Only inbound BL needs API verification
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());
  
  // OCR state
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  
  const [pendingOcrResult, setPendingOcrResult] = useState<{ container_number: string | null; seal_number: string | null } | null>(null);
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
      let foundJob: any = null;

      const stateJob = navState?.jobData;
      if (stateJob) {
        foundJob = stateJob;
      }

      if (!foundJob) {
        if (isInternalDriver || isExternalDriver) {
          const driverType = isInternalDriver ? 'internal' : 'external';
          const [inProgressRes, inTransitRes, deliveredRes, completedRes] = await Promise.all([
            getDriverAssignedJobs(user!.id, driverType, 50, 'in_progress'),
            getDriverAssignedJobs(user!.id, driverType, 50, 'in_transit'),
            getDriverAssignedJobs(user!.id, driverType, 50, 'delivered'),
            getDriverAssignedJobs(user!.id, driverType, 50, 'completed'),
          ]);
          foundJob = [
            ...((inProgressRes.data as any)?.data || []),
            ...((inTransitRes.data as any)?.data || []),
            ...((deliveredRes.data as any)?.data || []),
            ...((completedRes.data as any)?.data || []),
          ].find((j: any) => j.order_number === jobId);
        } else {
          const { data: result } = await getFreelanceAcceptedJobs(user!.id);
          if (result?.data) {
            foundJob = result.data.find((j: any) => j.order_number === jobId);
          }
        }
      }

      if (foundJob) {
        setJobDetail({
          id: foundJob.id || jobId || '',
          order_code: foundJob.order_code || foundJob.order_number || jobId || '',
          employer_name: foundJob.employer_name || foundJob.factory_name || foundJob.sender_name || '',
          container_checkpoint: foundJob.container_checkpoint || foundJob.empty_pickup_depot || '',
          container_number: foundJob.container_number || '',
          seal_number: foundJob.seal_number || '',
          container_number_2: foundJob.container_number_2 || '',
          seal_number_2: foundJob.seal_number_2 || '',
          start_date: foundJob.start_date || foundJob.sender_pickup_date || '',
          start_time: foundJob.start_time || foundJob.sender_pickup_time || '',
          bl_no: foundJob.bl_no || '',
          transport_type: foundJob.transport_type || '',
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

  const processPhotoFile = (file: File) => {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-run OCR after attaching document if needsOCR
    if (needsOCR) {
      runOcrOnFile(file);
    }
  };

  const runOcrOnFile = async (file: File) => {
    setIsProcessingOcr(true);
    try {
      toast({
        title: t('ocr.processing'),
        description: t('common.pleaseWait') || 'รอสักครู่...',
      });

      const result = await extractFromImage(file, 'container_seal');

      if (result.success && result.data) {
        const containerNo = result.data.container_number || null;
        const sealNo = result.data.seal_number || null;
        
        if (!needsApiVerify && containerNo) {
          // Booking (outbound): auto-accept OCR results without API verify
          console.log('[OCR] Booking job - auto-accepting OCR results:', containerNo, sealNo);
          setOcrContainerNumber(containerNo);
          setOcrSealNumber(sealNo);
          setPhotoFile(file); // Keep the photo file for confirmation
          setIsOcrVerified(true);
          toast({
            title: 'อ่านข้อมูลสำเร็จ',
            description: `เลขตู้: ${containerNo}`,
          });
        } else {
          setPendingOcrResult({ container_number: containerNo, seal_number: sealNo });
        }
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

  const handlePhotoSelect = async (source: 'camera' | 'gallery') => {
    setShowPhotoDrawer(false);
    
    if (isNative) {
      let file: File | null = null;
      if (source === 'camera') {
        file = await takePhoto();
      } else {
        file = await selectFromGallery();
      }
      if (file) {
        await processPhotoFile(file);
        return;
      }
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await processPhotoFile(file);
      }
    };
    input.click();
  };

  const handleConfirmOcr = async () => {
    if (!pendingOcrResult?.container_number) {
      toast({
        title: 'ไม่พบเลขตู้',
        description: 'กรุณาถ่ายรูปใหม่',
        variant: "destructive",
      });
      setPendingOcrResult(null);
      return;
    }

    setIsVerifying(true);
    
    try {
      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Upload photo to S3 via edge function
      let imageUrl: string | undefined;
      if (photoFile) {
        try {
          const formData = new FormData();
          formData.append('file', photoFile);
          formData.append('folder', 'container-photos');
          formData.append('fileName', `ocr_${jobId}_${Date.now()}.${photoFile.name.split('.').pop() || 'jpg'}`);

          const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-s3', {
            body: formData
          });

          if (!uploadError && uploadData?.url) {
            imageUrl = uploadData.url;
            console.log('[OCR] Uploaded image URL:', imageUrl);
          } else {
            console.warn('[OCR] S3 upload failed, continuing without image_url:', uploadError || uploadData?.error);
          }
        } catch (uploadErr) {
          console.warn('[OCR] S3 upload exception, continuing without image_url:', uploadErr);
        }
      }

      // Step 1: Verify container/seal via ocr-extra (only for inbound BL)
      if (needsApiVerify) {
        const { data: verifyResult, error: verifyError } = await verifyOcrContainer({
          container_no: pendingOcrResult.container_number,
          seal_no: pendingOcrResult.seal_number || '',
          order_number: jobId || undefined,
          driver_id: user?.id || undefined,
          driver_type: driverType,
        });

        if (verifyError) {
          console.error('OCR verify error:', verifyError);
          const isDuplicate = verifyError.toLowerCase().includes('duplicate') || verifyError.toLowerCase().includes('already scanned');
          const isNotFound = verifyError.toLowerCase().includes('not found') || verifyError.toLowerCase().includes('does not exist');
          
          if (isDuplicate) {
            toast({
              title: 'ตู้นี้ดำเนินการไปแล้ว',
              description: 'ตู้คอนเทนเนอร์นี้ถูกสแกนและบันทึกในระบบแล้ว ไม่จำเป็นต้องดำเนินการซ้ำ',
              variant: "destructive",
            });
            setOcrContainerNumber(pendingOcrResult.container_number);
            setOcrSealNumber(pendingOcrResult.seal_number);
            setIsOcrVerified(true);
            return;
          }
          
          toast({
            title: isNotFound ? 'ไม่พบข้อมูลตู้คอนเทนเนอร์' : 'ตรวจสอบไม่สำเร็จ',
            description: isNotFound 
              ? 'ไม่มีข้อมูลตู้คอนเทนเนอร์นี้อยู่ในระบบ กรุณาตรวจสอบเลขตู้และเลขซีลอีกครั้ง' 
              : verifyError,
            variant: "destructive",
          });
          return;
        }

        console.log('[OCR] Verify passed:', verifyResult);

        toast({
          title: 'ตรวจสอบสำเร็จ',
          description: 'เลขตู้และเลขซีลถูกต้อง',
        });
      } else {
        // Booking (outbound): skip API verify, just accept OCR results
        console.log('[OCR] Booking job - skipping API verification, using OCR data directly');
        toast({
          title: 'อ่านข้อมูลสำเร็จ',
          description: `เลขตู้: ${pendingOcrResult.container_number}`,
        });
      }

      // Save image URL for later use in handleConfirmSOP
      if (imageUrl) {
        setOcrImageUrl(imageUrl);
      }
        
      setOcrContainerNumber(pendingOcrResult.container_number);
      setOcrSealNumber(pendingOcrResult.seal_number);
      setIsOcrVerified(true);
      setPendingOcrResult(null);
    } catch (verifyErr) {
      console.error('OCR submit exception:', verifyErr);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmClick = () => {
    if (needsOCR && !isOcrVerified) {
      toast({
        title: 'กรุณาสแกน OCR ก่อน',
        description: 'ต้องสแกนเลขตู้และเลขซีลก่อนยืนยัน',
        variant: "destructive",
      });
      return;
    }
    if (!photoFile) {
      toast({
        title: t('sop.photoRequired'),
        description: t('containerSop.photoRequiredMessage'),
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    if (!photoFile || !jobId || !user) return;

    setUploading(true);
    try {
      let publicUrl = '';
      
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `container_sop_${jobId}_${Date.now()}.${fileExt}`;

        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('folder', 'container-photos');
        formData.append('fileName', fileName);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-s3', {
          body: formData
        });

        if (uploadError || !uploadData?.url) {
          throw new Error(uploadError?.message || uploadData?.error || 'Upload failed');
        }
        publicUrl = uploadData.url;
        console.log('[ContainerSOP] Uploaded to S3:', publicUrl);
      }

      const finalContainerNumber = ocrContainerNumber || containerNumber || undefined;
      const finalSealNumber = ocrSealNumber || sealNumber || undefined;

      // Send driverCheckin to external API for container return confirmation
      if (isContainerReturn) {
        const driverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        try {
          const checkinPayload = {
            order_number: jobDetail!.order_code,
            driver_id: user.id,
            driver_type: driverType,
            checkin_type: 'container_return_confirmed',
            photo_url: publicUrl,
            notes: 'ยืนยันคืนตู้สำเร็จ',
            container_number: finalContainerNumber,
            seal_number: finalSealNumber,
          };
          console.log('[ContainerSOP] Sending container_return_confirmed checkin:', checkinPayload);
          const { error: checkinError } = await driverCheckin(checkinPayload);
          if (checkinError) {
            console.warn('[ContainerSOP] driverCheckin error (non-blocking):', checkinError);
          } else {
            console.log('[ContainerSOP] container_return_confirmed checkin sent successfully');
          }
        } catch (checkinErr) {
          console.warn('[ContainerSOP] driverCheckin exception (non-blocking):', checkinErr);
        }
      }

      // Save OCR scan data to TMS when confirming container pickup (not return)
      if (needsOCR && isOcrVerified && finalContainerNumber && !isContainerReturn) {
        const driverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        try {
          const { data: ocrResult, error: ocrError } = await submitOcrScan({
            container_no: finalContainerNumber,
            seal_no: finalSealNumber || '',
            order_number: jobId || undefined,
            driver_id: user.id,
            driver_type: driverType,
            scanned_at: new Date().toISOString(),
            image_url: ocrImageUrl,
          });

          if (ocrError) {
            console.error('[ContainerSOP] save-ocr-scan error:', ocrError);
            // Check for duplicate - treat as success
            const isDuplicate = ocrError.toLowerCase().includes('duplicate') || ocrError.toLowerCase().includes('already scanned');
            if (!isDuplicate) {
              toast({
                title: 'บันทึกข้อมูล OCR ไม่สำเร็จ',
                description: ocrError,
                variant: "destructive",
              });
              return;
            }
            console.log('[ContainerSOP] Duplicate scan detected, continuing...');
          } else {
            console.log('[ContainerSOP] save-ocr-scan success:', ocrResult);
          }
        } catch (ocrErr) {
          console.warn('[ContainerSOP] save-ocr-scan exception (non-blocking):', ocrErr);
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

      toast({
        title: t('containerSop.success'),
        description: t('containerSop.successMessage'),
      });

      navigate(`/job/${jobId}`);
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

  const isConfirmDisabled = uploading || !photoFile || (needsOCR && !isOcrVerified);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${jobId}`)}>
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

        <div className="space-y-2">
          <Label className="text-base">
            {isContainerReturn ? 'แนบเอกสารคืนตู้' : isLoadedContainer ? 'แนบเอกสารรับตู้หนัก' : isEmptyContainer ? 'แนบเอกสารรับตู้เปล่า' : t('containerSop.uploadPhoto')} <span className="text-red-500">*</span>
          </Label>
          
          <button
            onClick={() => setShowPhotoDrawer(true)}
            className="w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors bg-white"
          >
            {photoPreview ? (
              <img 
                src={photoPreview} 
                alt="Preview" 
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center px-4" dangerouslySetInnerHTML={{ __html: `${t('sop.clickToTake')}<br />${t('sop.productPhoto')}` }} />
              </>
            )}
          </button>

          {/* OCR processing indicator - below photo */}
          {needsOCR && (isProcessingOcr || extracting) && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700">กำลังอ่านเลขตู้/เลขซีลจากรูป...</span>
              </div>
            </Card>
          )}

           {/* OCR pending result - inline below photo */}
           {needsOCR && pendingOcrResult && !isOcrVerified && !isProcessingOcr && !extracting && (
             <Card className="p-4 bg-blue-50 border-blue-300">
               <div className="flex items-center gap-2 mb-3">
                 <Scan className="w-5 h-5 text-blue-600" />
                 <span className="font-semibold text-blue-700">ผลการสแกน OCR</span>
               </div>
               <div className="space-y-2 mb-3">
                 <div className="bg-white rounded-lg p-3 border border-blue-200">
                   <label className="text-xs text-muted-foreground mb-2 block">เลขตู้</label>
                   <input
                     type="text"
                     value={pendingOcrResult.container_number || ''}
                     onChange={(e) => setPendingOcrResult({ ...pendingOcrResult, container_number: e.target.value })}
                     className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                     placeholder="ไม่พบ"
                   />
                 </div>
                 <div className="bg-white rounded-lg p-3 border border-blue-200">
                   <label className="text-xs text-muted-foreground mb-2 block">เลขซีล</label>
                   <input
                     type="text"
                     value={pendingOcrResult.seal_number || ''}
                     onChange={(e) => setPendingOcrResult({ ...pendingOcrResult, seal_number: e.target.value })}
                     className="w-full px-2 py-1 border border-gray-300 rounded font-bold text-base focus:outline-none focus:border-blue-500"
                     placeholder="ไม่พบ"
                   />
                 </div>
               </div>
               <div className="flex gap-2">
                 <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setPendingOcrResult(null); setShowPhotoDrawer(true); }}
                  >
                    ถ่ายใหม่
                  </Button>
                  {needsApiVerify && (
                  <Button
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={handleConfirmOcr}
                    disabled={isVerifying || !pendingOcrResult.container_number}
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {isVerifying ? 'ตรวจสอบ...' : 'ยืนยันเลขตู้'}
                  </Button>
                  )}
                </div>
             </Card>
           )}

          {/* OCR verified results display */}
          {needsOCR && isOcrVerified && (
            <Card className="p-4 bg-green-50 border-green-300">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-700">ตรวจสอบสำเร็จ</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold">1</span>
                  <span className="text-sm text-green-700 font-medium">เลขตู้ :</span>
                  <span className="text-sm font-bold">{ocrContainerNumber || '-'}</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200 ml-7">
                  <span className="text-sm text-green-700 font-medium">เลขซีล :</span>
                  <span className="text-sm font-bold">{ocrSealNumber || '-'}</span>
                </div>
              </div>
            </Card>
          )}
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
              {t('containerSop.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('containerSop.confirmMessage')}
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
