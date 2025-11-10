import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  isAccepted?: boolean;
}
interface Profile {
  full_name: string;
  avatar_url?: string;
  vehicle_photo_url?: string;
}
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();
      
      // Subscribe to profile changes for real-time updates
      const channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          () => {
            loadProfile();
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
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
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    } else {
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
  const loadProfile = async () => {
    if (!user) return;
    
    // Load profile data
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    
    // Load vehicle photo (front photo as driver photo)
    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('id')
      .eq('driver_id', user.id)
      .single();
    
    let vehiclePhotoUrl: string | undefined;
    if (vehicleData) {
      const { data: photoData } = await supabase
        .from('vehicle_photos')
        .select('photo_url')
        .eq('vehicle_id', vehicleData.id)
        .eq('photo_type', 'front')
        .single();
      
      vehiclePhotoUrl = photoData?.photo_url;
    }
    
    setProfile({
      ...profileData,
      vehicle_photo_url: vehiclePhotoUrl
    });
  };
  const handleAcceptJob = (job: Job) => {
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };
  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user) return;
    const {
      error
    } = await supabase.from('job_applications').insert({
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
    } else {
      toast({
        title: t('home.accept_success'),
        description: `${t('home.accept_success_desc')} ${selectedJob.order_code} แล้ว`
      });
      setConfirmDialogOpen(false);
      loadJobs();
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header and Search Bar - Sticky Together */}
      <div className="sticky top-0 z-50">
        <AppHeader userName={profile?.full_name} profilePhoto={profile?.vehicle_photo_url || profile?.avatar_url} onSignOut={handleSignOut} showQuickMenu={true} />

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