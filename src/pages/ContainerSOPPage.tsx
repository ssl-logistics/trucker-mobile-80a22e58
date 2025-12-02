import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Camera, CheckCircle2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import { sendJobStatus } from '@/lib/jobStatusService';
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
  start_date: string;
  start_time: string;
}

const ContainerSOPPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const handlePhotoSelect = (source: 'camera' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
    setShowPhotoDrawer(false);
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

      // Send job status update
      await sendJobStatus({
        jobId,
        orderCode: jobDetail.order_code,
        userId: user.id,
        status: 'container_sop_completed',
        sequenceNumber: 1 // Container checkpoint
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (time: string) => {
    return time || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">{t('containerSop.loading')}</div>
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#245D9E] text-white p-4 flex items-center gap-3">
        <button onClick={() => navigate(`/job/${jobId}`)}>
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-center flex-1">
          {t('containerSop.title')} {jobDetail.container_checkpoint}
        </h1>
      </div>

      <div className="p-4 space-y-4">
        <JobActionButtons jobId={jobId} />

        <div className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#4CAF50]" />
          <div className="flex-1">
            <div className="font-medium text-[#2E7D32]">{t('sop.checkInSuccess')}</div>
            <div className="text-sm text-[#2E7D32]">
              {formatDate(jobDetail.start_date)} | {formatTime(jobDetail.start_time)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('containerSop.uploadPhoto')} <span className="text-red-500">*</span>
          </label>
          
          {photoPreview ? (
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4">
              <img 
                src={photoPreview} 
                alt="Preview" 
                className="w-full h-auto rounded"
              />
              <button
                onClick={() => setShowPhotoDrawer(true)}
                className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg"
              >
                <Camera className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPhotoDrawer(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:border-gray-400 transition-colors"
            >
              <Camera className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">
                {t('containerSop.clickToTake')}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button
          onClick={handleConfirmClick}
          disabled={!photoFile || uploading}
          className="w-full h-12 text-base bg-[#0FA968] hover:bg-[#0C8B53] text-white"
        >
          {uploading ? t('sop.saving') : t('containerSop.confirmButton')}
        </Button>
      </div>

      <Drawer open={showPhotoDrawer} onOpenChange={setShowPhotoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('sop.selectSource')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => handlePhotoSelect('camera')}
              className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
            >
              <Camera className="w-5 h-5" />
              <span>{t('sop.takePhoto')}</span>
            </button>
            <button
              onClick={() => handlePhotoSelect('gallery')}
              className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
            >
              <Image className="w-5 h-5" />
              <span>{t('sop.selectFromGallery')}</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">{t('sop.cancel')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('containerSop.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('containerSop.confirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={uploading}
            >
              {t('sop.cancel')}
            </Button>
            <Button
              onClick={handleConfirmSOP}
              disabled={uploading}
              className="bg-[#0FA968] hover:bg-[#0C8B53] text-white"
            >
              {uploading ? t('sop.saving') : t('sop.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContainerSOPPage;
