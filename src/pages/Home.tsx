import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { RejectFactoryJobDialog } from '@/components/home/RejectFactoryJobDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { canHandleJobTruckType } from '@/utils/truckTypeHierarchy';
interface Job {
  id: string;
  post_id?: string;
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
  pickup_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  isAccepted?: boolean;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setAuthTransitioning, userType } = useAuth();
  const { t } = useLanguage();
  const { role, isInternalDriver, isExternalDriver } = useUserRole();
  const { vehiclePhoto } = useVehiclePhoto();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [openJobOrderCode, setOpenJobOrderCode] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<'all' | 'company' | 'factory'>('all');

  // State for factory jobs
  const [factoryJobs, setFactoryJobs] = useState<Job[]>([]);
  const [isLoadingFactoryJobs, setIsLoadingFactoryJobs] = useState(false);
  
  // State for factory job actions
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedFactoryJob, setSelectedFactoryJob] = useState<Job | null>(null);
  const [isFactoryJobProcessing, setIsFactoryJobProcessing] = useState(false);

  // Get displayed jobs based on filter
  const getDisplayedJobs = () => {
    if (jobFilter === 'factory') {
      return factoryJobs;
    }
    // 'all' and 'company' both show company jobs (current API)
    return jobs;
  };

  const displayedJobs = getDisplayedJobs();

  // Load factory jobs from API
  const loadFactoryJobs = async () => {
    if (!user?.id) return;
    
    setIsLoadingFactoryJobs(true);
    try {
      // Call with query params via URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${user.id}&limit=10`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Error loading factory jobs:', response.statusText);
        return;
      }

      const result = await response.json();
      console.log('Loaded factory jobs from API:', result);

      // Transform API response to Job format
      // NOTE: get-factory-assigned-jobs may return both pending offers and jobs already in progress.
      // We only want to show jobs that are still awaiting the driver's response in the "Factory Jobs" tab.
      const apiJobs = (result?.data || []).filter((item: any) => {
        const status = (item?.status || '').toLowerCase().trim();
        return status === 'awaiting_response';
      });
      
      const transformedJobs: Job[] = apiJobs.map((item: any) => {
        // Build origin/destination from province + district if not provided directly
        const originLocation = item.origin || 
          [item.sender_district, item.sender_province].filter(Boolean).join(', ') || 
          item.from_location || '';
        const destinationLocation = item.destination || 
          [item.destination_district, item.destination_province].filter(Boolean).join(', ') || 
          item.to_location || '';
        
        return {
          id: item.id || String(Math.random()),
          post_id: item.id || item.post_id || '',
          order_code: item.order_number || item.order_code || item.quote_number || '',
          job_type: item.job_type || item.shipment_type || 'domestic',
          employer_name: item.factory_name || item.company_name || item.customer_name || '',
          transport_type: item.transport_mode || item.send_mode || 'single',
          transport_type_label: item.transport_type_label || item.send_mode_label || '',
          origin_location: originLocation,
          destination_location: destinationLocation,
          destination_company_name: item.destination_company_name || item.destination_name || null,
          price: item.transport_price || item.price || 0,
          start_date: item.sender_pickup_date || item.pickup_date || item.start_date || '',
          pickup_time: item.sender_pickup_time || item.pickup_time || item.start_time || '',
          equipment_list: item.vehicle_type || item.truck_type || null,
          safety_equipment: Array.isArray(item.truck_requirements) ? item.truck_requirements.join(', ') : (item.truck_requirements || null),
          goods_type: item.product_name || item.goods_type || null,
          goods_quantity: item.product_quantity ? String(item.product_quantity) : (item.goods_quantity || null),
          goods_weight: item.product_weight || null,
          goods_unit: item.product_unit || null,
          isAccepted: false,
          origin_lat: item.sender_latitude || item.origin_lat || undefined,
          origin_lng: item.sender_longitude || item.origin_lng || undefined,
          destination_lat: item.destination_latitude || item.destination_lat || undefined,
          destination_lng: item.destination_longitude || item.destination_lng || undefined
        };
      });

      setFactoryJobs(transformedJobs);
    } catch (err) {
      console.error('Error fetching factory jobs:', err);
    } finally {
      setIsLoadingFactoryJobs(false);
    }
  };

  useEffect(() => {
    if (user) {
      console.log('🔄 Loading jobs with userType:', userType, 'isInternalDriver:', isInternalDriver, 'isExternalDriver:', isExternalDriver);
      loadJobs();
      loadFactoryJobs(); // Also load factory jobs
    }
  }, [user, userType, isInternalDriver, isExternalDriver]);

  // Handle openJobOrderCode from notifications navigation (state or query string)
  useEffect(() => {
    const orderCodeFromState = location.state?.openJobOrderCode as string | undefined;
    const orderCodeFromQuery = new URLSearchParams(location.search).get('openJobOrderCode') || undefined;

    const orderCode = orderCodeFromState || orderCodeFromQuery;

    if (orderCode) {
      setOpenJobOrderCode(orderCode);

      // Clear navigation state/query to prevent reopening on refresh
      if (orderCodeFromState) {
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.pathname, location.search, location.state, navigate]);

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
      
      // Filter by is_express_rent based on user type
      // internal_driver & external_driver: show is_express_rent = false (งานปกติ)
      // freelance_driver: show is_express_rent = true (งานด่วน)
      const isExpressRentFilter = isInternalDriver || isExternalDriver ? false : true;
      
      const transformedJobs: Job[] = apiJobs
        .filter((item: any) => item.is_express_rent === isExpressRentFilter)
        .map((item: any) => {
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
          post_id: item.id || item.post_id || '',
          order_code: orderCode,
          job_type: item.job_type || item.post_type || item.shipment_type || item.product_type || 'domestic',
          employer_name: item.company_name || item.factory_name || item.customer_name || '',
          transport_type: item.send_mode || 'single',
          transport_type_label: item.transport_type_label || item.send_mode_label || '',
          origin_location: originLocation,
          destination_location: destinationLocation,
          destination_company_name: item.company_name || null,
          price: item.price || 0,
          start_date: item.pickup_date || item.start_date || item.period_start || '',
          pickup_time: item.pickup_time || item.start_time || '',
          equipment_list: item.truck_type !== '-' ? item.truck_type : null,
          safety_equipment: Array.isArray(item.truck_requirements) ? item.truck_requirements.join(', ') : (item.truck_requirements || null),
          goods_type: item.product_name || item.goods_type || item.product_type || null,
          goods_quantity: item.goods_quantity || item.quantity || null,
          isAccepted: false,
          // Map coordinates from API
          origin_lat: item.origin_lat || undefined,
          origin_lng: item.origin_lng || undefined,
          destination_lat: item.destination_lat || undefined,
          destination_lng: item.destination_lng || undefined
        };
      });

      // Check which jobs the user has accepted
      if (user && transformedJobs.length > 0) {
        // Fetch accepted jobs from external API
        let acceptedOrderNumbers = new Set<string>();
        try {
          const acceptedResponse = await fetch(
            `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
              }
            }
          );
          
          if (acceptedResponse.ok) {
            const acceptedResult = await acceptedResponse.json();
            if (acceptedResult.success && acceptedResult.data) {
              acceptedOrderNumbers = new Set(
                acceptedResult.data.map((job: any) => job.order_number)
              );
            }
          }
        } catch (err) {
          console.error('Error fetching accepted jobs:', err);
        }

        // Also check local job_applications table
        const { data: applications } = await supabase
          .from('job_applications')
          .select('job_id, payment_completed_at')
          .eq('driver_id', user.id);
        
        const completedJobIds = new Set(
          applications?.filter(app => app.payment_completed_at).map(app => app.job_id) || []
        );
        const acceptedJobIds = new Set(applications?.map(app => app.job_id) || []);
        
        // Filter out jobs with past pickup date/time
        const now = new Date();
        const filterPastJobs = (jobList: Job[]) => {
          return jobList.filter(job => {
            if (!job.start_date) return true; // Keep jobs without date
            
            // Combine date and time to create full datetime
            const time = job.pickup_time || '23:59:59';
            const normalizedTime = time.length === 5 ? `${time}:00` : time;
            const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
            return pickupDateTime >= now;
          });
        };

        // Get driver's vehicle type for filtering
        const driverVehicleType = user.vehicle_type || '';
        console.log('🚛 Driver vehicle type:', driverVehicleType);
        
        // Filter out: completed jobs, accepted via external API, past jobs, and jobs requiring bigger trucks
        const availableJobs = filterPastJobs(transformedJobs)
          .filter(job => !completedJobIds.has(job.id))
          .filter(job => !acceptedOrderNumbers.has(job.order_code)) // Filter by order_code from external API
          .filter(job => {
            const canHandle = canHandleJobTruckType(driverVehicleType, job.equipment_list);
            console.log(`🚛 Job ${job.order_code} requires: ${job.equipment_list}, driver has: ${driverVehicleType}, can handle: ${canHandle}`);
            return canHandle;
          })
          .map(job => ({
            ...job,
            isAccepted: acceptedJobIds.has(job.id)
          }));
        
        setJobs(availableJobs);
      } else {
        // Filter out jobs with past pickup date/time for non-logged in users too
        const now = new Date();
        const filteredJobs = transformedJobs.filter(job => {
          if (!job.start_date) return true;
          const time = job.pickup_time || '23:59:59';
          const normalizedTime = time.length === 5 ? `${time}:00` : time;
          const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
          return pickupDateTime >= now;
        });
        setJobs(filteredJobs);
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
    if (!selectedJob || !user || isAccepting) return;
    
    setIsAccepting(true);
    
    try {
      // Get driver name from user object
      const driverName = user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}` 
        : user.full_name || user.name || '';
      
      // Get driver phone from user object
      const driverPhone = user.phone_number || user.phone || '';
      
      // Get vehicle info from user object (from login API)
      const province = (user.plate_province || '').trim();
      const number = (user.plate_number || '').trim();
      const licensePlate = [province, number].filter(Boolean).join(' ').trim();
      const vehicleType = (user.vehicle_type || '').trim();
      const vehicleBrand = (user.vehicle_brand || '').trim();
      
      console.log('Vehicle data from user:', { licensePlate, vehicleType, vehicleBrand });

      // Call external API to accept job
      const response = await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/accept-express-rent-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
        },
        body: JSON.stringify({
          order_number: selectedJob.order_code,
          post_id: selectedJob.post_id || selectedJob.id,
          freelance_driver_id: user.id,
          freelance_driver_name: driverName,
          driver_phone: driverPhone,
          license_plate: licensePlate,
          vehicle_type: vehicleType,
          vehicle_brand: vehicleBrand
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

      // Create tracking room after successful job acceptance
      try {
        const trackingBody = {
          truck_plate: licensePlate,
          order_code: selectedJob.order_code,
          origin_lat: selectedJob.origin_lat || 0,
          origin_lng: selectedJob.origin_lng || 0,
          destination_lat: selectedJob.destination_lat || 0,
          destination_lng: selectedJob.destination_lng || 0
        };
        console.log('📍 create-tracking-room body:', JSON.stringify(trackingBody, null, 2));
        
        const trackingResponse = await supabase.functions.invoke('create-tracking-room', {
          body: trackingBody
        });

        if (trackingResponse.error) {
          console.error('Error creating tracking room:', trackingResponse.error);
        } else {
          console.log('Tracking room created:', trackingResponse.data);
          // Save room_code to localStorage for later use (check-in, tracking)
          if (trackingResponse.data?.room?.room_code) {
            localStorage.setItem(`room_code_${selectedJob.order_code}`, trackingResponse.data.room.room_code);
            console.log('Saved room_code:', trackingResponse.data.room.room_code);
          }
        }
      } catch (trackingError) {
        console.error('Error creating tracking room:', trackingError);
      }

      setConfirmDialogOpen(false);
      setIsAccepting(false);
      loadJobs();
    } catch (err) {
      console.error('Error accepting job:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
      setIsAccepting(false);
    }
  };

  // Handle factory job accept
  const handleAcceptFactoryJob = async (job: Job) => {
    if (!user || isFactoryJobProcessing) return;
    
    setIsFactoryJobProcessing(true);
    
    try {
      const response = await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/respond-factory-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
        },
        body: JSON.stringify({
          order_number: job.order_code,
          freelance_driver_id: user.id,
          action: 'accept'
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          title: t('home.error_factory_job'),
          description: result.message || t('home.error_accept'),
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('home.accept_factory_success'),
        description: `${t('home.accept_factory_success_desc')} ${job.order_code}`
      });

      // Remove accepted job from list immediately
      setFactoryJobs(prevJobs => prevJobs.filter(j => j.order_code !== job.order_code));
    } catch (err) {
      console.error('Error accepting factory job:', err);
      toast({
        title: t('home.error_factory_job'),
        description: t('home.error_accept'),
        variant: 'destructive'
      });
    } finally {
      setIsFactoryJobProcessing(false);
    }
  };

  // Handle factory job reject - open dialog
  const handleRejectFactoryJob = (job: Job) => {
    setSelectedFactoryJob(job);
    setRejectDialogOpen(true);
  };

  // Confirm factory job rejection with reason
  const confirmFactoryJobRejection = async (reason: string) => {
    if (!selectedFactoryJob || !user || isFactoryJobProcessing) return;
    
    setIsFactoryJobProcessing(true);
    
    try {
      const response = await fetch('https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/respond-factory-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
        },
        body: JSON.stringify({
          order_number: selectedFactoryJob.order_code,
          freelance_driver_id: user.id,
          action: 'reject',
          reject_reason: reason
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          title: t('home.error_factory_job'),
          description: result.message || t('home.cancel_job'),
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('home.reject_factory_success'),
        description: `${t('home.reject_factory_success_desc')} ${selectedFactoryJob.order_code}`
      });

      setRejectDialogOpen(false);
      setSelectedFactoryJob(null);
      
      // Reload factory jobs
      loadFactoryJobs();
    } catch (err) {
      console.error('Error rejecting factory job:', err);
      toast({
        title: t('home.error_factory_job'),
        description: t('home.cancel_job'),
        variant: 'destructive'
      });
    } finally {
      setIsFactoryJobProcessing(false);
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
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      {/* Header + Search wrapped together with rounded corners at bottom */}
      <div className="rounded-b-3xl shadow-lg overflow-hidden">
        <AppHeader 
          userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username} 
          profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined} 
          onSignOut={handleSignOut} 
          showQuickMenu={true} 
        />

        {/* Search Bar - inside the rounded container */}
        <div className="px-4 py-3 bg-gradient-to-b from-[#E1EBF7] to-[#d6e4f5]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input placeholder={t('home.search')} className="pl-10 bg-white shadow-sm border-0" onClick={() => navigate('/search')} readOnly />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 pb-24">
        {/* Jobs Section */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{t('home.recommended')}</h2>
            <span className="text-sm text-muted-foreground">
              {displayedJobs.length} {t('home.items')}
            </span>
          </div>

          {/* Job Filter Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={jobFilter === 'company' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setJobFilter(jobFilter === 'company' ? 'all' : 'company')}
              className={`flex-1 ${jobFilter === 'company' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {t('home.companyJobs')}
            </Button>
            <Button
              variant={jobFilter === 'factory' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setJobFilter(jobFilter === 'factory' ? 'all' : 'factory')}
              className={`flex-1 ${jobFilter === 'factory' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {t('home.factoryJobs')}
            </Button>
          </div>

          <div className="space-y-4">
            {jobFilter === 'factory' && displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t('home.noFactoryJobs')}</p>
              </div>
            ) : (
              displayedJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onAccept={jobFilter === 'factory' ? handleAcceptFactoryJob : handleAcceptJob}
                  autoOpenDetail={openJobOrderCode === job.order_code}
                  onDetailClosed={() => setOpenJobOrderCode(null)}
                  showCancelButton={jobFilter === 'factory'}
                  isFactoryJob={jobFilter === 'factory'}
                  onCancel={handleRejectFactoryJob}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />

      <ConfirmJobDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} onConfirm={confirmJobAcceptance} job={selectedJob} isLoading={isAccepting} />
      
      <RejectFactoryJobDialog 
        open={rejectDialogOpen} 
        onOpenChange={setRejectDialogOpen} 
        onConfirm={confirmFactoryJobRejection} 
        orderCode={selectedFactoryJob?.order_code || ''} 
        isLoading={isFactoryJobProcessing} 
      />
    </div>
  );
}