import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
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

interface DriverData {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string | null;
  front_photo_url: string | null;
  [key: string]: unknown;
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  
  // Get driver data from localStorage (from external API login)
  const [driver, setDriver] = useState<DriverData | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    // Load driver data from localStorage
    const storedDriver = localStorage.getItem('auth_driver');
    const storedRole = localStorage.getItem('user_role');
    
    if (storedDriver) {
      try {
        setDriver(JSON.parse(storedDriver));
      } catch (e) {
        console.error('Error parsing driver data:', e);
      }
    }
    setUserRole(storedRole || '');
  }, []);

  useEffect(() => {
    if (driver?.id) {
      loadJobs();
    }
  }, [driver]);

  // Subscribe to jobs table changes for real-time updates
  useEffect(() => {
    if (driver?.id) {
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
  }, [driver]);

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
      console.log('Loaded jobs for role:', userRole, 'Total jobs:', data?.length);
      // Check which jobs the driver has accepted and completed
      if (driver?.id) {
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id, payment_completed_at')
          .eq('driver_id', driver.id);
        
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
    if (!selectedJob || !driver?.id) return;
    
    // Insert job application
    const { error } = await supabase.from('job_applications').insert({
      job_id: selectedJob.id,
      driver_id: driver.id,
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

    // Use driver data from localStorage for external system
    const driverName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim();

    // Send job status to external system
    try {
      const { data: statusResponse, error: statusError } = await supabase.functions.invoke('receive-job-status', {
        body: {
          external_job_id: selectedJob.order_code,
          status: 'accepted',
          driver_name: driverName,
          driver_phone: ''
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

  const handleSignOut = () => {
    // Clear localStorage auth data
    localStorage.removeItem('auth_driver');
    localStorage.removeItem('auth_user_type');
    localStorage.removeItem('user_role');
    localStorage.removeItem('auth_driver_id');
    navigate('/');
  };

  // Get display name and photo from driver data
  const displayName = driver ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() : '';
  const profilePhoto = driver?.profile_photo_url || driver?.front_photo_url || undefined;
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header and Search Bar - Sticky Together */}
      <div className="sticky top-0 z-50">
        <AppHeader 
          userName={displayName} 
          profilePhoto={profilePhoto}
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