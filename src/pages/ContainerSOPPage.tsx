import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle, Image as ImageIcon, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { useOCR } from "@/hooks/useOCR";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import { OCRInputField, OCRStatusBadge } from "@/components/ocr/OCRInputField";
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
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { extractFromImage, extracting } = useOCR();
  const { takePhoto, selectFromGallery, isNative } = useNativeCamera();
  
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());
  
  // OCR fields
  const [containerNumber, setContainerNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [containerNumber2, setContainerNumber2] = useState("");
  const [sealNumber2, setSealNumber2] = useState("");
  const [ocrContainerNumber, setOcrContainerNumber] = useState<string | null>(null);
  const [ocrSealNumber, setOcrSealNumber] = useState<string | null>(null);
  const [ocrContainerNumber2, setOcrContainerNumber2] = useState<string | null>(null);
  const [ocrSealNumber2, setOcrSealNumber2] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId && user) {
      loadJobDetail();
    }
  }, [jobId, user]);

  const loadJobDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, order_code, employer_name, container_checkpoint, container_number, seal_number, start_date, start_time')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJobDetail(data);
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

  const processPhotoFile = async (file: File) => {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Run OCR extraction
    setOcrError(null);
    const result = await extractFromImage(file, 'container_seal');
    
    if (result.success && result.data) {
      if (result.data.container_number) {
        setOcrContainerNumber(result.data.container_number);
      }
      if (result.data.seal_number) {
        setOcrSealNumber(result.data.seal_number);
      }
      if (result.data.container_number_2) {
        setOcrContainerNumber2(result.data.container_number_2);
      }
      if (result.data.seal_number_2) {
        setOcrSealNumber2(result.data.seal_number_2);
      }
      
      toast({
        title: t('ocr.success'),
        description: t('ocr.successDesc'),
      });
    } else if (result.error) {
      setOcrError(result.error);
    }
  };

  const handlePhotoSelect = async (source: 'camera' | 'gallery') => {
    setShowPhotoDrawer(false);
    
    // Try native camera first (for Capacitor apps)
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
    
    // Fallback to web file input
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

  const handleConfirmClick = () => {
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
      // Upload photo to storage
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${jobId}_${Date.now()}.${fileExt}`;
      const filePath = `container-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pickup_sop_photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pickup_sop_photos')
        .getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase
        .from('pickup_sop_photos')
        .insert({
          job_id: jobId,
          driver_id: user.id,
          photo_url: publicUrl,
          photo_type: 'container'
        });

      if (dbError) throw dbError;

      // Update job application status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ 
          container_sop_completed_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      // Send job status update with container info
      await sendJobStatus({
        jobId,
        orderCode: jobDetail.order_code,
        userId: user.id,
        status: 'container_sop_completed',
        sequenceNumber: 1, // Container checkpoint
        containerNumber: containerNumber || undefined,
        sealNumber: sealNumber || undefined,
        containerNumber2: containerNumber2 || undefined,
        sealNumber2: sealNumber2 || undefined,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${jobId}`)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {t('containerSop.title')} {jobDetail.container_checkpoint}
          </h1>
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
            {t('containerSop.uploadPhoto')} <span className="text-red-500">*</span>
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
          
          {/* OCR Status */}
          {(extracting || ocrError || ocrContainerNumber) && (
            <div className="mt-2">
              <OCRStatusBadge 
                isExtracting={extracting} 
                hasResult={!!(ocrContainerNumber || ocrSealNumber)} 
                error={ocrError || undefined}
              />
            </div>
          )}
        </div>
        
        {/* OCR Input Fields */}
        {photoFile && (
          <Card className="p-4 space-y-4 bg-white">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <Scan className="w-4 h-4" />
              {t('ocr.containerSealInfo')}
            </div>
            
            <OCRInputField
              id="container-number"
              label={t('ocr.containerNumber')}
              value={containerNumber}
              onChange={setContainerNumber}
              ocrValue={ocrContainerNumber}
              isExtracting={extracting}
              placeholder={t('ocr.containerPlaceholder')}
            />
            
            <OCRInputField
              id="seal-number"
              label={t('ocr.sealNumber')}
              value={sealNumber}
              onChange={setSealNumber}
              ocrValue={ocrSealNumber}
              isExtracting={extracting}
              placeholder={t('ocr.sealPlaceholder')}
            />
            
            {/* Second container/seal for dual shipments */}
            {(ocrContainerNumber2 || containerNumber2) && (
              <>
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-3">{t('ocr.container2Label')}</p>
                </div>
                
                <OCRInputField
                  id="container-number-2"
                  label={t('ocr.containerNumber2')}
                  value={containerNumber2}
                  onChange={setContainerNumber2}
                  ocrValue={ocrContainerNumber2}
                  isExtracting={extracting}
                  placeholder={t('ocr.containerPlaceholder')}
                />
                
                <OCRInputField
                  id="seal-number-2"
                  label={t('ocr.sealNumber2')}
                  value={sealNumber2}
                  onChange={setSealNumber2}
                  ocrValue={ocrSealNumber2}
                  isExtracting={extracting}
                  placeholder={t('ocr.sealPlaceholder')}
                />
              </>
            )}
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={handleConfirmClick}
          disabled={uploading || !photoFile}
        >
          {uploading ? t('sop.saving') : t('containerSop.confirmButton')}
        </Button>
      </div>

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
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('camera')}
            >
              <Camera className="w-6 h-6" />
              {t('sop.takePhoto')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('gallery')}
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
    </div>
  );
};

export default ContainerSOPPage;
