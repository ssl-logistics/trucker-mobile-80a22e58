import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
interface Job {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  isAccepted?: boolean;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { role } = useUserRole();
  const { vehiclePhoto } = useVehiclePhoto();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  // Subscribe to jobs table changes for real-time updates
  useEffect(() => {
    if (user) {
      const jobsChannel = supabase
        .channel('jobs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs'
          },
          () => {
            loadJobs();
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(jobsChannel);
      };
    }
  }, [user]);
  const loadJobs = async () => {
    const {
      data,
      error
    } = await supabase.from('jobs').select('*').eq('status', 'available').order('created_at', {
      ascending: false
    });
    
    if (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    } else {
      console.log('Loaded jobs for role:', role, 'Total jobs:', data?.length);
      // Check which jobs the user has accepted and completed
      if (user) {
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id, payment_completed_at')
          .eq('driver_id', user.id);
        
        const completedJobIds = new Set(
          applications?.filter(app => app.payment_completed_at).map(app => app.job_id) || []
        );
        const acceptedJobIds = new Set(applications?.map(app => app.job_id) || []);
        
        // Filter out only completed jobs, keep jobs that are accepted but not completed
        const availableJobs = (data || [])
          .filter(job => !completedJobIds.has(job.id))
          .map(job => ({
            ...job,
            isAccepted: acceptedJobIds.has(job.id)
          }));
        
        setJobs(availableJobs);
      } else {
        setJobs(data || []);
      }
    }
  };
  const handleAcceptJob = (job: Job) => {
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };
  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user) return;
    
    // Insert job application
    const { error } = await supabase.from('job_applications').insert({
      job_id: selectedJob.id,
      driver_id: user.id,
      status: 'pending'
    });
    
    if (error) {
      toast({
        title: t('home.error_load'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
      return;
    }

    // Get driver profile info
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('id', user.id)
      .single();

    // Send job status to external system
    try {
      const { data: statusResponse, error: statusError } = await supabase.functions.invoke('receive-job-status', {
        body: {
          external_job_id: selectedJob.order_code,
          status: 'accepted',
          driver_name: profileData?.full_name || '',
          driver_phone: profileData?.phone_number || ''
        }
      });

      if (statusError) {
        console.error('Error sending job status:', statusError);
      } else {
        console.log('Job status sent successfully:', statusResponse);
      }
    } catch (err) {
      console.error('Failed to send job status:', err);
    }

    toast({
      title: t('home.accept_success'),
      description: `${t('home.accept_success_desc')} ${selectedJob.order_code}`
    });
    setConfirmDialogOpen(false);
    loadJobs();
  };
  const handleSignOut = async () => {
    try {
      const driverId = user?.id || localStorage.getItem('auth_driver_id');
      
      if (driverId) {
        await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
          body: JSON.stringify({ driver_id: driverId }),
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      logout();
      toast({
        description: t('settings.logoutSuccess') || 'ออกจากระบบสำเร็จ',
      });
      navigate('/');
    }
  };
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header and Search Bar - Sticky Together */}
      <div className="sticky top-0 z-50">
        <AppHeader 
          userName={user?.full_name} 
          profilePhoto={user?.avatar_url || vehiclePhoto || undefined} 
          onSignOut={handleSignOut} 
          showQuickMenu={true} 
        />

        {/* Search Bar */}
        <div className="px-4 -mt-4 pb-4 ">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input placeholder={t('home.search')} className="pl-10 bg-white shadow-sm border-0" onClick={() => navigate('/search')} readOnly />
          </div>
        </div>
      </div>

      {/* Jobs Section */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t('home.recommended')}</h2>
          <span className="text-sm text-muted-foreground">{jobs.length} {t('home.items')}</span>
        </div>

        <div className="space-y-4">
          {jobs.map(job => <JobCard key={job.id} job={job} onAccept={handleAcceptJob} />)}
        </div>
      </div>

      <BottomNavigation />

      <ConfirmJobDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} onConfirm={confirmJobAcceptance} job={selectedJob} />
    </div>;
}