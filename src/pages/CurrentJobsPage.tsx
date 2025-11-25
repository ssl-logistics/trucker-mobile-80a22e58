import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Filter, Clock, MapPin, CircleDot, X, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerFooter } from '@/components/ui/drawer';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatDate as formatThaiDate } from '@/lib/dateUtils';
interface JobApplication {
  job_id: string;
  status: string;
  applied_at: string;
  jobs: {
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
  };
}
export default function CurrentJobsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { role } = useUserRole();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [selectedJobType, setSelectedJobType] = useState<string>('all');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  useEffect(() => {
    loadCurrentJobs();

    // Real-time subscription for job applications changes
    const channel = supabase
      .channel('job-applications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications'
        },
        () => {
          console.log('Job applications changed, reloading...');
          loadCurrentJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const loadCurrentJobs = async () => {
    if (!user) return;
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from('job_applications').select(`
        job_id,
        status,
        applied_at,
        jobs (
          id,
          order_code,
          job_type,
          employer_name,
          transport_type,
          origin_location,
          destination_location,
          price,
          start_date,
          start_time,
          equipment_list,
          safety_equipment
        )
      `).eq('driver_id', user.id).is('payment_completed_at', null).order('applied_at', {
      ascending: false
    });
    if (error) {
      console.error('Error loading current jobs:', error);
      toast({
        title: t('currentJobs.errorLoad'),
        description: t('currentJobs.errorLoadDesc'),
        variant: 'destructive'
      });
    } else {
      console.log('Loaded current jobs for role:', role, 'Total applications:', data?.length);
      setApplications(data || []);
    }
    setLoading(false);
  };

  const handleApplyFilter = () => {
    setFilterOpen(false);
    // Filter logic is applied in filteredApplications
  };
  const handleResetFilter = () => {
    setSelectedJobType('all');
    setSelectedTransportType('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Filter applications based on selected filters
  const filteredApplications = applications.filter(application => {
    const job = application.jobs;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = job.order_code.toLowerCase().includes(query) || job.employer_name.toLowerCase().includes(query) || job.origin_location.toLowerCase().includes(query) || job.destination_location.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Job type filter
    if (selectedJobType !== 'all') {
      const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
      const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');
      if (selectedJobType === 'domestic' && !isDomestic) return false;
      if (selectedJobType === 'international' && !isInternational) return false;
    }

    // Transport type filter
    if (selectedTransportType !== 'all') {
      if (selectedTransportType === 'inbound' && !job.transport_type?.includes('ขาเข้า')) return false;
      if (selectedTransportType === 'outbound' && !job.transport_type?.includes('ขาออก')) return false;
      if (selectedTransportType === 'single' && !job.transport_type?.includes('เที่ยวเดียว')) return false;
      if (selectedTransportType === 'multiple' && !job.transport_type?.includes('หลายที่')) return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const jobDate = new Date(job.start_date);
      jobDate.setHours(0, 0, 0, 0);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (jobDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (jobDate > end) return false;
      }
    }
    return true;
  });
  const EmptyState = () => <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4">
        <MapPin className="w-16 h-16 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-center">{t('currentJobs.empty')}</p>
    </div>;
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50 rounded-b-xl ">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('currentJobs.title')}</h1>
        </div>
      </header>

      {/* Search and Filter Bar */}
      <div className="bg-[#FAFAFF] px-4 py-3 shadow-sm sticky top-[60px] z-40 ">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder={t('currentJobs.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 bg-white " />
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setFilterOpen(true)}>
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div> : filteredApplications.length === 0 ? <EmptyState /> : <div className="space-y-4">
            {filteredApplications.map(application => {
          const job = application.jobs;
          return <Card key={application.job_id} className="p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                      {t('job.order_code')} {job.order_code}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatThaiDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
                    </div>
                  </div>

          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">{t('job.employer')} : </span>
              <span className="font-medium">{job.employer_name}</span>
            </div>
            <div className="flex items-center gap-2">
              {(job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่')) && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  {t('job.domestic')}
                </Badge>}
              {(job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก')) && <>
                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                    {t('job.international')}
                  </Badge>
                  {job.transport_type?.includes('ขาเข้า') && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                      {t('job.inbound')}
                    </Badge>}
                  {job.transport_type?.includes('ขาออก') && <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                      {t('job.outbound')}
                    </Badge>}
                </>}
            </div>
            <div className="text-sm text-muted-foreground">
              {job.transport_type}
            </div>

            <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                          <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.origin')}</div>
                            <div className="font-medium">{job.origin_location}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.destination')}</div>
                            <div className="font-medium">{job.destination_location}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 mb-2">
                          <span className="text-lg font-bold text-teal-700">฿ {job.price.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('currentJobs.startJobDate')}
                        </div>
                        <div className="text-xs font-medium">
                          {formatThaiDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('job.equipment')} : </span>
                        <span>{job.equipment_list || '-'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('job.safety')} : </span>
                        <span>{job.safety_equipment || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full h-11 text-base font-medium" onClick={() => navigate(`/job/${job.id}`)}>
                    {t('currentJobs.viewDetails')}
                  </Button>
                </Card>;
        })}
          </div>}
      </div>

      {/* Filter Drawer */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle>{t('currentJobs.filter')}</DrawerTitle>
              <DrawerClose>
                <X className="w-5 h-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t('currentJobs.dateRange')}</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-11", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : t('currentJobs.startDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                
                <span className="text-muted-foreground">—</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-11", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : t('currentJobs.endDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleResetFilter}>
                {t('currentJobs.clearFilter')}
              </Button>
              <Button onClick={handleApplyFilter}>
                {t('currentJobs.applyFilter')}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>;
}