import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Power, Home as HomeIcon, LayoutGrid, MessageCircle, Settings, Search, Truck, HandCoins, Wallet, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

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
  const [activeTab, setActiveTab] = useState('home');

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

  const getDayName = () => {
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    return days[new Date().getDay()];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <div className="text-sm opacity-90">👋 {getDayName()}</div>
              <div className="font-semibold">
                {profile?.full_name || 'คุณผู้ใช้งาน'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 hover:bg-white/10 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <Power className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Menu */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {[
            { icon: Truck, label: 'งานปัจจุบัน', color: 'bg-blue-400' },
            { icon: HandCoins, label: 'เสนอราคา', color: 'bg-teal-400' },
            { icon: Wallet, label: 'รายได้', color: 'bg-yellow-400' },
            { icon: History, label: 'ประวัติงาน', color: 'bg-purple-400' },
          ].map((item) => (
            <button
              key={item.label}
              className="flex flex-col items-center gap-2 text-white"
            >
              <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center shadow-md`}>
                <item.icon className="w-7 h-7" />
              </div>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 -mt-4 relative z-10">
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-slate-800 text-white px-6 py-3 shadow-lg">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {[
            { icon: HomeIcon, label: 'หน้าแรก', id: 'home' },
            { icon: LayoutGrid, label: 'แผงควบคุม', id: 'dashboard' },
            { icon: MessageCircle, label: 'แชท', id: 'chat' },
            { icon: Settings, label: 'ตั้งค่า', id: 'settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'dashboard') {
                  navigate('/dashboard');
                }
              }}
              className={`flex flex-col items-center gap-1 transition-colors ${
                activeTab === item.id ? 'text-primary' : 'text-white/70'
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <ConfirmJobDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmJobAcceptance}
        job={selectedJob}
      />
    </div>
  );
}
