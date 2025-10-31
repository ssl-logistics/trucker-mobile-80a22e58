import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
}

interface Profile {
  full_name: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  useEffect(() => {
    loadJobs();
    loadProfile();
  }, []);

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลงานได้',
        variant: 'destructive',
      });
    } else {
      setJobs(data || []);
    }
  };

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    setProfile(data);
  };

  const handleAcceptJob = (job: Job) => {
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };

  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user) return;

    const { error } = await supabase
      .from('job_applications')
      .insert({
        job_id: selectedJob.id,
        driver_id: user.id,
        status: 'pending',
      });

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถรับงานได้',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'รับงานสำเร็จ',
        description: `คุณได้รับงาน ${selectedJob.order_code} แล้ว`,
      });
      setConfirmDialogOpen(false);
      loadJobs();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };


  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      <AppHeader 
        userName={profile?.full_name}
        onSignOut={handleSignOut}
        showQuickMenu={true}
      />

      {/* Search Bar */}
      <div className="px-4 -mt-4 relative z-40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            placeholder="ค้นหา"
            className="pl-10 bg-white shadow-sm border-0"
            onClick={() => navigate('/search')}
            readOnly
          />
        </div>
      </div>

      {/* Jobs Section */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">งานแนะนำสำหรับคุณ</h2>
          <span className="text-sm text-muted-foreground">{jobs.length} รายการ</span>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onAccept={handleAcceptJob} />
          ))}
        </div>
      </div>

      <BottomNavigation />

      <ConfirmJobDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmJobAcceptance}
        job={selectedJob}
      />
    </div>
  );
}
