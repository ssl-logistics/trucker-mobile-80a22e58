import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Phone } from 'lucide-react';
import expenseViewIcon from '@/assets/expense-view-icon.svg';
import expenseAddIcon from '@/assets/expense-add-icon.svg';
import reportProblemIcon from '@/assets/report-problem-icon.svg';
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendJobStatus } from '@/lib/jobStatusService';
import GoogleMap from '@/components/GoogleMap';
import { formatDate } from '@/lib/dateUtils';
import JobActionButtons from '@/components/job/JobActionButtons';
interface JobDetail {
  id: string;
  order_code: string;
  transport_type: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  container_checkpoint_latitude: number | null;
  container_checkpoint_longitude: number | null;
  empty_container_date: string | null;
  container_number: string | null;
  seal_number: string | null;
  container_number_2: string | null;
  seal_number_2: string | null;
  origin_location: string | null;
}
export default function ContainerCheckInPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  
  // Editable container fields for inbound
  const [container1Number, setContainer1Number] = useState('');
  const [container1Seal, setContainer1Seal] = useState('');
  const [container2Number, setContainer2Number] = useState('');
  const [container2Seal, setContainer2Seal] = useState('');
  
  const isInbound = job?.transport_type?.includes('ขาเข้า');
  
  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  useEffect(() => {
    if (job) {
      setContainer1Number(job.container_number || '');
      setContainer1Seal(job.seal_number || '');
      setContainer2Number(job.container_number_2 || '');
      setContainer2Seal(job.seal_number_2 || '');
    }
  }, [job]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (error) {
      toast({
        title: t('container.error'),
        description: t('container.loadError'),
        variant: 'destructive'
      });
      navigate(`/job/${jobId}`);
    } else {
      setJob(data);
    }
    setLoading(false);
  };
  
  const handleCheckIn = async () => {
    if (!user || !jobId || !job) return;
    
    const { error } = await supabase
      .from('job_applications')
      .update({
        container_checked_in_at: new Date().toISOString(),
        status: 'waiting_container'
      })
      .eq('job_id', jobId)
      .eq('driver_id', user.id);
      
    if (error) {
      toast({
        title: t('container.error'),
        description: t('container.checkInError'),
        variant: 'destructive'
      });
    } else {
      // Send job status update
      await sendJobStatus({
        jobId,
        orderCode: job.order_code,
        userId: user.id,
        status: 'container_checked_in',
        sequenceNumber: 1, // Container checkpoint
        containerNumber: container1Number,
        sealNumber: container1Seal,
        containerNumber2: container2Number,
        sealNumber2: container2Seal
      });

      toast({
        title: t('container.checkInSuccess'),
        description: t('container.checkInSuccessMessage')
      });
      setShowConfirmDialog(false);
      navigate(`/job/${jobId}`);
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  if (!job) return null;
  const containerData = {
    checkpoint: job.container_checkpoint || t('container.defaultCheckpoint'),
    checkpointCode: job.container_checkpoint_code || '-',
    emptyDate: job.empty_container_date || '-'
  };
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate(`/job/${jobId}`)} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-center">{t('container.title')} {job.container_checkpoint || ''}</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} />

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('container.emptyContainerPoint')}</div>
          <div className="text-base">{job.origin_location || containerData.checkpoint}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('container.checkpoint')}</div>
          <div className="text-base">{job.container_checkpoint || '-'}</div>
        </div>

        {/* Interactive Map */}
        {job.container_checkpoint_latitude && job.container_checkpoint_longitude ? (
          <GoogleMap 
            latitude={job.container_checkpoint_latitude}
            longitude={job.container_checkpoint_longitude}
            markerLabel={job.container_checkpoint || t('container.defaultCheckpoint')}
            showRoute={true}
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('container.map')}</p>
            </div>
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('container.startTime')}</div>
          <div className="text-base">{formatDate(job.empty_container_date || '2023-11-18', language)} | 09:00</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('container.firstDatePickup')}</div>
          <div className="text-base">{formatDate(containerData.emptyDate, language)}</div>
        </div>

        <Card className="p-4 bg-[#E8F5F4] border-2 border-[#0A8778]/20 rounded-2xl">
          <div className="flex items-start gap-2 mb-3">
            <div className="bg-[#0A8778] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <h3 className="font-semibold text-base">{t('container.pair')} 1</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-[#454545] mb-1">{t('container.containerNo')}</p>
              {isInbound ? (
                <Input 
                  value={container1Number} 
                  onChange={(e) => setContainer1Number(e.target.value)}
                  placeholder={t('container.enterContainerNo')}
                  className="h-10"
                />
              ) : (
                <p className="font-medium">{job.container_number || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-[#454545] mb-1">{t('container.sealNo')}</p>
              {isInbound ? (
                <Input 
                  value={container1Seal} 
                  onChange={(e) => setContainer1Seal(e.target.value)}
                  placeholder={t('container.enterSealNo')}
                  className="h-10"
                />
              ) : (
                <p className="font-medium">{job.seal_number || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#E8F5F4] border-2 border-[#0A8778]/20 rounded-2xl">
          <div className="flex items-start gap-2 mb-3">
            <div className="bg-[#0A8778] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <h3 className="font-semibold text-base">{t('container.pair')} 2</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-[#454545] mb-1">{t('container.containerNo')}</p>
              {isInbound ? (
                <Input 
                  value={container2Number} 
                  onChange={(e) => setContainer2Number(e.target.value)}
                  placeholder={t('container.enterContainerNo')}
                  className="h-10"
                />
              ) : (
                <p className="font-medium">{job.container_number_2 || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-[#454545] mb-1">{t('container.sealNo')}</p>
              {isInbound ? (
                <Input 
                  value={container2Seal} 
                  onChange={(e) => setContainer2Seal(e.target.value)}
                  placeholder={t('container.enterSealNo')}
                  className="h-10"
                />
              ) : (
                <p className="font-medium">{job.seal_number_2 || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-3 pt-4">
          <Button variant="outline" className="w-full h-12 text-base border-[#153860]" onClick={() => {
            if (job.container_checkpoint_latitude && job.container_checkpoint_longitude) {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${job.container_checkpoint_latitude},${job.container_checkpoint_longitude}`;
              window.open(url, '_blank');
            }
          }}>
            <img src={routeIcon} alt="Route" className="w-5 h-5 mr-2" />
            {t('container.route')}
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700" onClick={() => setShowConfirmDialog(true)}>
          <MapPin className="w-5 h-5 mr-2" />
          {t('container.checkIn')}
        </Button>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">
              {t('container.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('container.confirmMessage1')}<br />
              {t('container.emptyContainerPoint')} {job.container_checkpoint || t('container.defaultCheckpoint')}<br />
              {t('container.confirmMessage2')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 h-11">
              {t('container.cancel')}
            </Button>
            <Button onClick={handleCheckIn} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
              {t('container.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Problem Drawer */}
      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={jobId} />
    </div>;
}