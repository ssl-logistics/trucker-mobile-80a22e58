import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Navigation, MapPin } from 'lucide-react';
import expenseViewIcon from '@/assets/expense-view-icon.svg';
import expenseAddIcon from '@/assets/expense-add-icon.svg';
import reportProblemIcon from '@/assets/report-problem-icon.svg';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { sendJobStatus } from '@/lib/jobStatusService';
import Map from '@/components/Map';
interface JobDetail {
  id: string;
  order_code: string;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  container_checkpoint_latitude: number | null;
  container_checkpoint_longitude: number | null;
  empty_container_date: string | null;
  container_number: string | null;
  seal_number: string | null;
}
export default function ContainerCheckInPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);
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
        status: 'รอรับตู้เปล่า'
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
        status: 'container_checked_in'
      });

      toast({
        title: t('container.checkInSuccess'),
        description: t('container.checkInSuccessMessage')
      });
      setShowConfirmDialog(false);
      navigate(`/job/${jobId}`);
    }
  };
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  if (!job) return null;
  const mockContainerData = {
    checkpoint: job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย',
    checkpointCode: job.container_checkpoint_code || 'LCB B1',
    emptyDate: job.empty_container_date || '2023-11-02',
    containers: [{
      number: 'TGHU4455667',
      seal: 'SEAL556677'
    }, {
      number: 'CAIU9988776',
      seal: 'SEAL112233'
    }]
  };
  return <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate(`/job/${jobId}`)} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-center">{t('container.title')} ท่าเรือแหลมฉบัง, ประเทศไทย</h1>
        </div>
      </header>

      <div className="bg-white border-b">
        <div className="grid grid-cols-3 px-4 py-3">
          <button className="flex flex-col items-center gap-1 text-[#0A8778]">
            <img src={expenseViewIcon} alt="" className="w-8 h-8" />
            <span className="text-xs font-medium">{t('container.viewExpenses')}</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#0A8778]" onClick={() => navigate(`/job/${jobId}/add-expense`)}>
            <img src={expenseAddIcon} alt="" className="w-8 h-8" />
            <span className="text-xs font-medium">{t('container.addExpenses')}</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#0A8778]" onClick={() => setIsReportDrawerOpen(true)}>
            <img src={reportProblemIcon} alt="" className="w-8 h-8" />
            <span className="text-xs font-medium">{t('container.reportProblem')}</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold mb-2">{t('container.emptyContainerPoint')}</h2>
          <p className="text-base">{mockContainerData.checkpoint}</p>
        </div>

        {/* Interactive Map */}
        <div className="rounded-lg overflow-hidden border border-border">
          <Map 
            latitude={job.container_checkpoint_latitude || 13.0827}
            longitude={job.container_checkpoint_longitude || 100.8833}
            markerLabel={job.container_checkpoint || 'ท่าเรือแหลมฉบัง'}
            showRoute={false}
          />
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('container.startTime')}</p>
            <p className="font-medium">{formatDate(job.empty_container_date || '2023-11-18')} | 09.00</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">{t('container.checkpoint')}</p>
            <p className="font-medium">{mockContainerData.checkpointCode}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">{t('container.firstDatePickup')}</p>
            <p className="font-medium">{formatDate(mockContainerData.emptyDate)}</p>
          </div>

          <Card className="p-4 bg-white border-2 border-gray-200">
            <div className="flex items-start gap-2 mb-3">
              <div className="bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <h3 className="font-semibold text-base">{t('container.pair')} 1</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">{t('container.containerNo')}</p>
                <p className="font-medium">{mockContainerData.containers[0].number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('container.sealNo')}</p>
                <p className="font-medium">{mockContainerData.containers[0].seal}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border-2 border-gray-200">
            <div className="flex items-start gap-2 mb-3">
              <div className="bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <h3 className="font-semibold text-base">{t('container.pair')} 2</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">{t('container.containerNo')}</p>
                <p className="font-medium">{mockContainerData.containers[1].number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('container.sealNo')}</p>
                <p className="font-medium">{mockContainerData.containers[1].seal}</p>
              </div>
            </div>
          </Card>
        </div>

        <Button variant="outline" className="w-full h-12">
          <Navigation className="w-5 h-5 mr-2" />
          {t('container.route')}
        </Button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button className="w-full h-12 text-base text-white" style={{
        background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
      }} onClick={() => setShowConfirmDialog(true)}>
          <MapPin className="w-5 h-5 mr-2" />
          {t('container.checkIn')}
        </Button>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              {t('container.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t('container.confirmMessage1')}<br />
              {t('container.emptyContainerPoint')} {job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย'}<br />
              {t('container.confirmMessage2')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-4">
            <AlertDialogCancel className="sm:mt-0">{t('container.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckIn} className="bg-blue-600 hover:bg-blue-700">
              {t('container.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Problem Drawer */}
      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={jobId} />
    </div>;
}