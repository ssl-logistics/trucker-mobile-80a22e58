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
  destination_location: string;
  destination_company_name?: string | null;
  start_date: string;
  start_time: string;
}

interface JobDestination {
  id: string;
  job_id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
}

export default function DeliverySOPCheckInPage() {
  const navigate = useNavigate();
  const { jobId, destinationId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [destination, setDestination] = useState<JobDestination | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());

  useEffect(() => {
    loadJobDetail();
  }, [jobId, destinationId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, destination_location, destination_company_name, start_date, start_time')
      .eq('id', jobId)
      .single();

    if (error) {
      toast({
        title: t('deliverySop.error'),
        description: t('deliverySop.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
      return;
    }
    
    setJob(data);

    // If destinationId is provided, load destination info
    if (destinationId) {
      const { data: destData, error: destError } = await supabase
        .from('job_destinations')
        .select('id, job_id, sequence_number, company_name, contact_name, checked_in_at, sop_completed_at')
        .eq('id', destinationId)
        .single();

      if (destError) {
        toast({
          title: t('deliverySop.error'),
          description: t('deliverySop.loadError'),
          variant: 'destructive'
        });
        navigate(`/job/${jobId}`);
        return;
      }
      
      setDestination(destData);
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
        title: t('deliverySop.photoRequired'),
        description: t('deliverySop.photoRequiredMessage'),
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
      const fileName = `${user.id}/${job.id}/delivery/${Date.now()}.${fileExt}`;
      
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

      // If we have a specific destination, update job_destinations table
      if (destination && destinationId) {
        const { error: updateError } = await supabase
          .from('job_destinations')
          .update({ 
            sop_completed_at: new Date().toISOString()
          })
          .eq('id', destinationId);

        if (updateError) throw updateError;

        // Send job status update
        await sendJobStatus({
          jobId: job.id,
          orderCode: job.order_code,
          userId: user.id,
          status: 'delivery_sop_completed',
          sequenceNumber: destination.sequence_number,
          destinationId: destinationId
        });
      } else {
        // Fallback to old behavior for legacy routes
        const { error: updateError } = await supabase
          .from('job_applications')
          .update({ 
            delivery_sop_completed_at: new Date().toISOString(),
            status: 'delivery_sop_completed'
          })
          .eq('job_id', job.id)
          .eq('driver_id', user.id);

        if (updateError) throw updateError;

        // Send job status update
        await sendJobStatus({
          jobId: job.id,
          orderCode: job.order_code,
          userId: user.id,
          status: 'delivery_sop_completed',
          sequenceNumber: 3
        });
      }

      toast({
        title: t('deliverySop.sopSuccess'),
        description: t('deliverySop.sopSuccessMessage'),
      });

      navigate(`/job/${job.id}`);
    } catch (error) {
      console.error('Error confirming SOP:', error);
      toast({
        title: t('deliverySop.error'),
        description: t('deliverySop.saveError'),
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setShowConfirmDialog(false);
    }
  };

  // Display values
  const displayCompanyName = destination?.company_name || job?.destination_company_name || '';

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
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
          <button onClick={() => navigate(`/job/${job.id}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('deliverySop.title')} {displayCompanyName}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Action Buttons */}
        <JobActionButtons jobId={jobId} />

        {/* Check-in Success Banner */}
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('deliverySop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(job.start_date)} | {formatTime(checkInTime)}
              </div>
            </div>
          </div>
        </Card>

        {/* Photo Upload Section */}
        <div className="space-y-2">
          <Label className="text-base">
            {t('deliverySop.uploadPhoto')} <span className="text-red-500">*</span>
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
                <p className="text-sm text-muted-foreground text-center px-4" dangerouslySetInnerHTML={{ __html: t('deliverySop.clickToTake') }} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={handleConfirmClick}
          disabled={uploading || !photoFile}
        >
          {t('deliverySop.confirmSOP')}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            <DialogTitle className="text-xl text-center">
              {t('deliverySop.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base" dangerouslySetInnerHTML={{ __html: t('deliverySop.confirmMessage') }} />
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 h-11"
              disabled={uploading}
            >
              {t('deliverySop.cancel')}
            </Button>
            <Button
              onClick={handleConfirmSOP}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
            >
              {uploading ? t('deliverySop.saving') : t('deliverySop.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Source Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('deliverySop.selectSource')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('camera')}
            >
              <Camera className="w-6 h-6" />
              {t('deliverySop.takePhoto')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('gallery')}
            >
              <ImageIcon className="w-6 h-6" />
              {t('deliverySop.selectFromGallery')}
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12">
                {t('deliverySop.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}