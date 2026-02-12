import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle, Image as ImageIcon, Scan, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getDriverAssignedJobs, getFreelanceAcceptedJobs } from '@/lib/externalApi';
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
  const isEmptyContainer = navState?.checkinType === 'empty_container';
  const needsOCR = isEmptyContainer; // OCR only for empty container pickup
  
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [showOcrDrawer, setShowOcrDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());
  
  // OCR state
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  const [showOcrConfirmDialog, setShowOcrConfirmDialog] = useState(false);
  const [pendingOcrResult, setPendingOcrResult] = useState<{ container_number: string | null; seal_number: string | null } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

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

  // OCR photo handling
  const handleOcrPhotoSelect = async (source: 'camera' | 'gallery') => {
    setShowOcrDrawer(false);
    setIsProcessingOcr(true);
    
    try {
      let file: File | null = null;
      
      if (isNative) {
        if (source === 'camera') {
          file = await takePhoto();
        } else {
          file = await selectFromGallery();
        }
      }
      
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
      
      toast({
        title: t('ocr.processing'),
        description: t('common.pleaseWait') || 'รอสักครู่...',
      });
      
      const result = await extractFromImage(file, 'container_seal');
      
      if (result.success && result.data) {
        const containerNo = result.data.container_number || null;
        const sealNo = result.data.seal_number || null;
        setPendingOcrResult({ container_number: containerNo, seal_number: sealNo });
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

  const handleConfirmOcr = async () => {
    if (!pendingOcrResult?.container_number) {
      toast({
        title: 'ไม่พบเลขตู้',
        description: 'กรุณาถ่ายรูปใหม่',
        variant: "destructive",
      });
      setShowOcrConfirmDialog(false);
      return;
    }

    setIsVerifying(true);
    
    try {
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-container', {
        body: {
          container_no: pendingOcrResult.container_number,
          seal_no: pendingOcrResult.seal_number || null,
        },
      });
      
      if (verifyError) {
        console.error('Verify container error:', verifyError);
        toast({
          title: 'ตรวจสอบไม่สำเร็จ',
          description: verifyError.message,
          variant: "destructive",
        });
        return;
      }
      
      if (verifyResult?.found) {
        toast({
          title: 'ตรวจสอบสำเร็จ',
          description: verifyResult?.message || 'พบข้อมูลตู้คอนเทนเนอร์ในระบบ',
        });
        
        setOcrContainerNumber(pendingOcrResult.container_number);
        setOcrSealNumber(pendingOcrResult.seal_number);
        setIsOcrVerified(true);
        setShowOcrConfirmDialog(false);
        
        // Persist to localStorage
        if (jobDetail?.order_code) {
          try {
            localStorage.setItem(`ocr_verified_${jobDetail.order_code}`, JSON.stringify({
              containerNumber: pendingOcrResult.container_number,
              sealNumber: pendingOcrResult.seal_number,
            }));
          } catch (e) { /* ignore */ }
        }
      } else {
        toast({
          title: 'ไม่พบในระบบ',
          description: 'ไม่พบเลขตู้นี้ในระบบ',
          variant: "destructive",
        });
      }
    } catch (verifyErr) {
      console.error('Verify container exception:', verifyErr);
      toast({
        title: 'ตรวจสอบไม่สำเร็จ',
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
        const fileName = `${jobId}_${Date.now()}.${fileExt}`;
        const filePath = `container-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('pickup_sop_photos')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('pickup_sop_photos')
          .getPublicUrl(filePath);
        publicUrl = data.publicUrl;

        const { error: dbError } = await supabase
          .from('pickup_sop_photos')
          .insert({
            job_id: jobId,
            driver_id: user.id,
            photo_url: publicUrl,
            photo_type: 'container'
          });

        if (dbError) throw dbError;
      }

      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ 
          container_sop_completed_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      const finalContainerNumber = ocrContainerNumber || containerNumber || undefined;
      const finalSealNumber = ocrSealNumber || sealNumber || undefined;

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
    : isEmptyContainer 
      ? `แนบเอกสารรับตู้เปล่า ${jobDetail.container_checkpoint}`
      : `${t('containerSop.title')} ${jobDetail.container_checkpoint}`;

  const confirmButtonText = isContainerReturn 
    ? 'ยืนยันคืนตู้' 
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

        {/* OCR Section - only for empty container */}
        {needsOCR && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              สแกนเลขตู้ / เลขซีล <span className="text-red-500">*</span>
            </Label>
            
            {isOcrVerified ? (
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3 border-green-300 text-green-700"
                  onClick={() => setShowOcrDrawer(true)}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  สแกนใหม่
                </Button>
              </Card>
            ) : (
              <Button 
                className="w-full h-14 flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => setShowOcrDrawer(true)}
                disabled={isProcessingOcr || extracting}
              >
                {(isProcessingOcr || extracting) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Scan className="w-5 h-5" />
                )}
                <span className="text-base">
                  {(isProcessingOcr || extracting) ? 'กำลังประมวลผล...' : 'สแกนเลขตู้ / เลขซีล'}
                </span>
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-base">
            {isContainerReturn ? 'แนบเอกสารคืนตู้' : isEmptyContainer ? 'แนบเอกสารรับตู้เปล่า' : t('containerSop.uploadPhoto')} <span className="text-red-500">*</span>
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

      {/* OCR Confirm Dialog */}
      <Dialog open={showOcrConfirmDialog} onOpenChange={setShowOcrConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Scan className="w-8 h-8 text-blue-600" />
            </div>
            <DialogTitle className="text-xl text-center">
              ผลการสแกน OCR
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground mb-1">เลขตู้</div>
              <div className="font-bold text-lg">{pendingOcrResult?.container_number || 'ไม่พบ'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground mb-1">เลขซีล</div>
              <div className="font-bold text-lg">{pendingOcrResult?.seal_number || 'ไม่พบ'}</div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => { setShowOcrConfirmDialog(false); setPendingOcrResult(null); }}
              className="flex-1 h-11"
              disabled={isVerifying}
            >
              สแกนใหม่
            </Button>
            <Button
              onClick={handleConfirmOcr}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              disabled={isVerifying || !pendingOcrResult?.container_number}
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isVerifying ? 'ตรวจสอบ...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Source Drawer */}
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

      {/* OCR Source Drawer */}
      <Drawer open={showOcrDrawer} onOpenChange={setShowOcrDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">เลือกแหล่งรูปสำหรับสแกน</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handleOcrPhotoSelect('camera')}>
              <Camera className="w-6 h-6" />
              ถ่ายรูป
            </Button>
            <Button variant="outline" className="w-full h-14 text-base justify-start gap-3" onClick={() => handleOcrPhotoSelect('gallery')}>
              <ImageIcon className="w-6 h-6" />
              เลือกจากแกลเลอรี
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