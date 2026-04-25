import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import JobActionButtons from '@/components/job/JobActionButtons';
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { driverCheckin, getDriverAssignedJobs, getFreelanceAcceptedJobs } from '@/lib/externalApi';
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

// JobDestination interface removed - table no longer exists
interface DestinationInfo {
  sequence_number: number;
}

export default function DeliverySOPCheckInPage() {
  const navigate = useNavigate();
  const { jobId, destinationId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver, loading: roleLoading } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [destination, setDestination] = useState<DestinationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());

  useEffect(() => {
    // Try to use job data passed via navigation state first
    const stateJobData = (location.state as any)?.jobData;
    const stateDestId = (location.state as any)?.destId;
    if (stateJobData && jobId) {
      let targetSequenceNumber = destinationId ? parseInt(destinationId, 10) : 1;
      
      // If destId is passed, find the actual destination and use its original sequence_number
      if (stateDestId && stateJobData.destinations?.length > 0) {
        const matchedDest = stateJobData.destinations.find((d: any) => d.id === stateDestId);
        if (matchedDest) {
          targetSequenceNumber = matchedDest.sequence_number;
        }
      }
      
      const mappedJob: JobDetail = {
        id: stateJobData.id || stateJobData.transport_order_id,
        order_code: stateJobData.order_number || stateJobData.order_code || jobId,
        employer_name: stateJobData.destination_name || stateJobData.destination_company_name || stateJobData.employer_name,
        destination_location: `${stateJobData.destination_district || ''}, ${stateJobData.destination_province || ''}`,
        destination_company_name: stateJobData.destination_company_name || stateJobData.destination_name,
        start_date: stateJobData.destination_delivery_date || stateJobData.sender_pickup_date || stateJobData.start_date,
        start_time: stateJobData.destination_delivery_time || stateJobData.sender_pickup_time || stateJobData.start_time,
      };
      setJob(mappedJob);
      setDestination({ sequence_number: targetSequenceNumber });
      setLoading(false);
      return;
    }

    // Fallback: fetch from API
    if (!roleLoading) {
      loadJobDetail();
    }
  }, [jobId, destinationId, user, roleLoading]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    try {
      let allJobs: any[] = [];

      if (isInternalDriver || isExternalDriver) {
        // For internal/external drivers, use getDriverAssignedJobs (single call, comma-separated statuses)
        const driverType = isInternalDriver ? 'internal' : 'external';
        const statuses = [
          'in_transit',
          'delivered',
          'returning_container',
          'at_container_return',
          'container_returned',
          'completed',
        ].join(',');
        const res = await getDriverAssignedJobs(user.id, driverType, 100, statuses);
        allJobs = ((res.data as any)?.data || []) as any[];
      } else {
        // For freelance drivers, use getFreelanceAcceptedJobs
        const result = await getFreelanceAcceptedJobs(user.id) as any;
        allJobs = result?.data || [];
      }

      // Find the specific job by order_number
      const foundJob = allJobs.find((j: any) => 
        j.order_number === jobId || String(j.id) === jobId
      );
      
      if (foundJob) {
        // Determine sequence number from URL param
        const targetSequenceNumber = destinationId ? parseInt(destinationId, 10) : 1;
        
        // Check if job has multiple destinations
        const destinationsArray = foundJob.destinations || [];
        let targetDestination: any = null;
        
        if (destinationsArray.length > 0) {
          // Prefer lookup by destination ID (stable across reorders) over sequence_number
          const stateDestIdFallback = (location.state as any)?.destId;
          targetDestination = (stateDestIdFallback 
            ? destinationsArray.find((d: any) => d.id === stateDestIdFallback)
            : null) 
            || destinationsArray.find((d: any) => d.sequence_number === targetSequenceNumber) 
            || destinationsArray[0];
          console.log('Multi-destination job, target sequence:', targetSequenceNumber, 'destId:', stateDestIdFallback);
        }
        
        // Set destination state
        if (targetDestination) {
          setDestination({
            sequence_number: targetDestination.sequence_number || targetSequenceNumber,
          });
        } else {
          setDestination({
            sequence_number: 1,
          });
        }
        
        // Map API response to JobDetail interface
        const mappedJob: JobDetail = {
          id: foundJob.id,
          order_code: foundJob.order_number,
          employer_name: foundJob.destination_name || foundJob.destination_company_name,
          destination_location: `${foundJob.destination_district || ''}, ${foundJob.destination_province || ''}`,
          destination_company_name: foundJob.destination_company_name || foundJob.destination_name,
          start_date: foundJob.destination_delivery_date || foundJob.sender_pickup_date,
          start_time: foundJob.destination_delivery_time || foundJob.sender_pickup_time,
        };
        setJob(mappedJob);
      } else {
        throw new Error('Job not found');
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('deliverySop.error'),
        description: t('deliverySop.loadError'),
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

       // Send POD to external API with destination_sequence_number
       const driverType: 'internal' | 'external' | 'freelance' = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
       const sequenceNumber = destination?.sequence_number || 1;
       
       try {
         const podPayload = {
           order_number: job.order_code,
           checkin_type: 'delivery_confirmed',
           driver_id: user.id,
           driver_type: driverType,
           notes: 'ยืนยัน POD จากหน้า Delivery SOP',
           photo_url: publicUrl,
           destination_sequence_number: sequenceNumber,
         };
         
         console.log('Sending POD from DeliverySOPCheckInPage:', {
           sequence: sequenceNumber,
           photo: publicUrl
         });
         
         const { error: podError } = await driverCheckin(podPayload);
         if (podError) {
           console.warn('POD API error (non-blocking):', podError);
         } else {
           console.log('POD sent successfully for sequence:', sequenceNumber);
         }
       } catch (podApiError) {
         console.warn('POD submission error:', podApiError);
         // Don't throw - continue with local update
       }

       // Update job application with delivery SOP completion
       {
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
           sequenceNumber: destination?.sequence_number || 1
         });
       }

       toast({
         title: t('deliverySop.sopSuccess'),
         description: t('deliverySop.sopSuccessMessage'),
       });

       const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
       navigate(backRoute);
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
  const displayCompanyName = job?.destination_company_name || '';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
           <button onClick={() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
            navigate(backRoute);
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('deliverySop.title')} {displayCompanyName}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Action Buttons */}
        <JobActionButtons jobId={jobId} orderNumber={jobId} />

        {/* Check-in Success Banner */}
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('deliverySop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(job.start_date, language)} | {formatTime(checkInTime)}
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