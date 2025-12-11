import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Camera, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import JobActionButtons from '@/components/job/JobActionButtons';
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate, formatTime } from '@/lib/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  origin_company_name?: string | null;
  start_date: string;
  start_time: string;
}

export default function SOPCheckInPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, origin_location, origin_company_name, start_date, start_time')
      .eq('id', jobId)
      .single();

    if (error) {
      toast({
        title: t('sop.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } else {
      setJob(data);
    }
    setLoading(false);
  };

  const handlePhotoSelect = async (source: 'camera' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = async (e) => {
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
    setDrawerOpen(false);
  };

  const handleConfirmClick = () => {
    if (!photoFile) {
      toast({
        title: t('sop.photoRequired'),
        description: t('sop.photoRequiredMessage'),
        variant: 'destructive'
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    if (!photoFile || !job || !user) return;

    setUploading(true);

    try {
      // Upload photo to storage
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${user.id}/${job.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(fileName);

      // Save SOP photo record
      const { error: insertError } = await supabase
        .from('pickup_sop_photos')
        .insert({
          job_id: job.id,
          driver_id: user.id,
          photo_url: publicUrl
        });

      if (insertError) throw insertError;

      // Update job application status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ 
          sop_completed_at: new Date().toISOString(),
          status: 'sop_completed'
        })
        .eq('job_id', job.id)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      // Send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: 'pickup_sop_completed',
        sequenceNumber: 2 // Pickup point
      });

      toast({
        title: t('sop.sopSuccess'),
        description: t('sop.sopSuccessMessage'),
      });

      navigate(`/job/${job.id}`);
    } catch (error) {
      console.error('Error confirming SOP:', error);
      toast({
        title: t('sop.error'),
        description: t('sop.errorMessage'),
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setShowConfirmDialog(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${job.id}/pickup`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('sop.title')} {job.origin_company_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} />

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('sop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(job.start_date, language)} | {formatTime(checkInTime)}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-2">
          <Label className="text-base">
            {t('sop.uploadPhoto')} <span className="text-red-500">*</span>
          </Label>
          
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors bg-white"
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
          disabled={uploading || !photoFile}
        >
          {t('sop.confirmSOP')}
        </Button>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            <DialogTitle className="text-xl text-center">
              {t('sop.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('sop.confirmMessage')}
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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
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
}
