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
  const [existingSOP, setExistingSOP] = useState<any>(null);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  useEffect(() => {
    if (job && user) {
      checkExistingSOP();
    }
  }, [job, user]);

  const checkExistingSOP = async () => {
    if (!user || !job) return;

    try {
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop?order_number=${job.order_code}&freelance_driver_id=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Find pickup SOP
          const pickupSOP = Array.isArray(result.data) 
            ? result.data.find((s: any) => s.status === 'pickup')
            : result.data.status === 'pickup' ? result.data : null;
          
          if (pickupSOP) {
            setExistingSOP(pickupSOP);
            // If SOP already exists, show existing photos
            if (pickupSOP.product_images?.length > 0) {
              setPhotoPreview(pickupSOP.product_images[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing SOP:', error);
    }
  };

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    try {
      // Fetch from external API using order_code
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: any) => j.order_number === jobId);
        
        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            employer_name: foundJob.sender_name,
            origin_location: `${foundJob.sender_district}, ${foundJob.sender_province}`,
            origin_company_name: foundJob.sender_name,
            start_date: foundJob.sender_pickup_date,
            start_time: foundJob.sender_pickup_time,
          };
          setJob(mappedJob);
        } else {
          throw new Error('Job not found');
        }
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('sop.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
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
      // First upload image to S3 via edge function
      const formData = new FormData();
      formData.append('file', photoFile);
      formData.append('folder', 'mobile/sop-photos');
      formData.append('filename', `${user.id}-${job.order_code}-${Date.now()}`);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-to-s3', {
        body: formData
      });

      if (uploadError || !uploadData?.url) {
        throw new Error('Failed to upload image');
      }

      const imageUrl = uploadData.url;

      // Call driver-sop API
      const response = await fetch(
        'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/driver-sop',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          },
          body: JSON.stringify({
            order_number: job.order_code,
            freelance_driver_id: user.id,
            product_images: [imageUrl],
            status: 'pickup'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit SOP');
      }

      toast({
        title: t('sop.sopSuccess'),
        description: t('sop.sopSuccessMessage'),
      });

      navigate(`/job/${job.order_code}`);
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
          <button onClick={() => navigate(`/job/${job.order_code}/pickup`)} className="p-1">
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
