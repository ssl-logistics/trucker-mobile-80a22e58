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
  transport_type_label?: string;
  origin_location: string;
  destination_location: string;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  isAccepted?: boolean;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, logout, setAuthTransitioning } = useAuth();
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
    try {
      // Fetch from our edge function that uses the secret API key
      const { data: responseData, error } = await supabase.functions.invoke('get-express-rent-posts');
      
      if (error) {
        console.error('Error loading jobs from API:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive'
        });
        return;
      }

      console.log('Loaded jobs from API:', responseData);
      
      // Transform API response to Job format
      const apiJobs = Array.isArray(responseData) ? responseData : (responseData?.data || []);
      
      const transformedJobs: Job[] = apiJobs.map((item: any) => {
        // Parse origin and destination from description (format: "ต้นทาง → ปลายทาง")
        let originLocation = item.origin || item.from_location || '';
        let destinationLocation = item.destination || item.to_location || '';
        
        // If origin/destination is empty or "-", try to parse from description
        if ((!originLocation || originLocation === '-') && item.description) {
          const parts = item.description.split('→').map((p: string) => p.trim());
          if (parts.length >= 2) {
            originLocation = parts[0] || '';
            destinationLocation = parts[1] || '';
          }
        }
        
        // If destination is still empty, try parsing from description
        if ((!destinationLocation || destinationLocation === '-') && item.description) {
          const parts = item.description.split('→').map((p: string) => p.trim());
          if (parts.length >= 2) {
            destinationLocation = parts[1] || '';
          }
        }
        
        // Extract order code from title (format: "โพสต์หารถด่วน - OR20251203002")
        let orderCode = item.post_code || item.order_number || item.quote_number || '';
        if (item.title && item.title.includes(' - ')) {
          const titleParts = item.title.split(' - ');
          if (titleParts.length >= 2) {
            orderCode = titleParts[titleParts.length - 1].trim();
          }
        }
        
        return {
          id: item.id || String(Math.random()),
          order_code: orderCode,
          job_type: item.post_type || item.shipment_type || item.product_type || 'domestic',
          employer_name: item.company_name || item.factory_name || item.customer_name || '',
          transport_type: item.send_mode || 'single',
          transport_type_label: item.transport_type_label || item.send_mode_label || '',
          origin_location: originLocation,
          destination_location: destinationLocation,
          destination_company_name: item.company_name || null,
          price: item.price || 0,
          start_date: item.pickup_date || item.start_date || item.period_start || '',
          start_time: item.start_time || '',
          equipment_list: item.truck_type !== '-' ? item.truck_type : null,
          safety_equipment: Array.isArray(item.truck_requirements) ? item.truck_requirements.join(', ') : (item.truck_requirements || null),
          goods_type: item.product_name || item.goods_type || item.product_type || null,
          goods_quantity: item.goods_quantity || item.quantity || null,
          isAccepted: false
        };
      });

      // Check which jobs the user has accepted
      if (user && transformedJobs.length > 0) {
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id, payment_completed_at')
          .eq('driver_id', user.id);
        
        const completedJobIds = new Set(
          applications?.filter(app => app.payment_completed_at).map(app => app.job_id) || []
        );
        const acceptedJobIds = new Set(applications?.map(app => app.job_id) || []);
        
        const availableJobs = transformedJobs
          .filter(job => !completedJobIds.has(job.id))
          .map(job => ({
            ...job,
            isAccepted: acceptedJobIds.has(job.id)
          }));
        
        setJobs(availableJobs);
      } else {
        setJobs(transformedJobs);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    }
  };
  const handleAcceptJob = (job: Job) => {
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };
  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user) return;
    
    try {
      // Call external API to accept job
      const response = await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/accept-express-rent-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
        },
        body: JSON.stringify({
          order_number: selectedJob.order_code
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          title: t('home.error_load'),
          description: result.message || t('home.error_accept'),
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('home.accept_success'),
        description: `${t('home.accept_success_desc')} ${selectedJob.order_code}`
      });
      setConfirmDialogOpen(false);
      loadJobs();
    } catch (err) {
      console.error('Error accepting job:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
    }
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
          userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username} 
          profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined} 
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