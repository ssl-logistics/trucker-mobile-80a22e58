import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Filter, Clock, MapPin, CircleDot, X, CalendarIcon, Calendar as CalendarIconLucide } from 'lucide-react';
import coinsIcon from '@/assets/coins-icon.png';
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
// Interface for accepted jobs from external API
interface AcceptedJob {
  id: string;
  order_number: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  company_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  pickup_date: string;
  start_time: string;
  pickup_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  origin_goods_type: string | null;
  goods_type: string | null;
  product_name: string | null;
  status: string;
  accepted_at: string;
  post_code: string;
}
export default function CurrentJobsPage() {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    t,
    language
  } = useLanguage();
  const {
    role
  } = useUserRole();
  const [acceptedJobs, setAcceptedJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [selectedJobType, setSelectedJobType] = useState<string>('all');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  useEffect(() => {
    loadAcceptedJobs();
  }, [user]);

  const loadAcceptedJobs = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Get freelance_driver_id from user profile or external mapping
      const freelanceDriverId = user.id;
      
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(freelanceDriverId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Error loading accepted jobs:', result);
        toast({
          title: t('currentJobs.errorLoad'),
          description: t('currentJobs.errorLoadDesc'),
          variant: 'destructive'
        });
        setAcceptedJobs([]);
      } else {
        console.log('Loaded accepted jobs:', result);
        // Handle both array response and object with data property
        const jobs = Array.isArray(result) ? result : (result.data || []);
        setAcceptedJobs(jobs);
      }
    } catch (error) {
      console.error('Error fetching accepted jobs:', error);
      toast({
        title: t('currentJobs.errorLoad'),
        description: t('currentJobs.errorLoadDesc'),
        variant: 'destructive'
      });
      setAcceptedJobs([]);
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

  // Filter jobs based on selected filters
  const filteredJobs = acceptedJobs.filter(job => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderCode = job.order_code || job.post_code || '';
      const employerName = job.employer_name || job.company_name || '';
      const matchesSearch = 
        orderCode.toLowerCase().includes(query) || 
        employerName.toLowerCase().includes(query) || 
        (job.destination_company_name && job.destination_company_name.toLowerCase().includes(query)) || 
        (job.origin_location && job.origin_location.toLowerCase().includes(query)) || 
        (job.destination_location && job.destination_location.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Job type filter
    if (selectedJobType !== 'all') {
      const transportType = job.transport_type || '';
      const isDomestic = transportType.includes('เที่ยวเดียว') || transportType.includes('หลายที่') || transportType.includes('ภายในประเทศ');
      const isInternational = transportType.includes('ขาเข้า') || transportType.includes('ขาออก');
      if (selectedJobType === 'domestic' && !isDomestic) return false;
      if (selectedJobType === 'international' && !isInternational) return false;
    }

    // Transport type filter
    if (selectedTransportType !== 'all') {
      const transportType = job.transport_type || '';
      if (selectedTransportType === 'inbound' && !transportType.includes('ขาเข้า')) return false;
      if (selectedTransportType === 'outbound' && !transportType.includes('ขาออก')) return false;
      if (selectedTransportType === 'single' && !transportType.includes('เที่ยวเดียว')) return false;
      if (selectedTransportType === 'multiple' && !transportType.includes('หลายที่')) return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const jobDate = new Date(job.start_date || job.pickup_date);
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
      <header className="bg-header text-header-foreground sticky top-0 z-50 rounded-b-xl page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
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
          </div> : filteredJobs.length === 0 ? <EmptyState /> : <div className="space-y-4">
            {filteredJobs.map(job => {
          const orderCode = job.order_code || job.post_code || '';
          const employerName = job.employer_name || job.company_name || '';
          const startDate = job.start_date || job.pickup_date || '';
          const startTime = job.start_time || job.pickup_time || '';
          const transportType = job.transport_type || '';
          const goodsType = job.origin_goods_type || job.goods_type || job.product_name || '-';

          return <Card key={job.id} className="overflow-hidden bg-card">
                  <div className="flex items-center justify-between px-3 py-2 bg-white">
                    <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
                      {t('job.order_code')} {orderCode}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatThaiDate(startDate, language)} | {startTime.substring(0, 5)}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">{t('job.employer')} : </span>
              <span className="font-medium">{employerName}</span>
            </div>
            <div className="flex items-center gap-2">
              {(transportType.includes('เที่ยวเดียว') || transportType.includes('หลายที่') || transportType.includes('ภายในประเทศ')) && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  {t('job.domestic')}
                </Badge>}
              {(transportType.includes('ขาเข้า') || transportType.includes('ขาออก')) && <>
                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                    {t('job.international')}
                  </Badge>
                  {transportType.includes('ขาเข้า') && <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                      {t('job.inbound')}
                    </Badge>}
                  {transportType.includes('ขาออก') && <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                      {t('job.outbound')}
                    </Badge>}
                </>}
            </div>
            <div className="text-sm text-muted-foreground">
              {transportType}
            </div>

            <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 flex gap-2">
                        <div className="flex flex-col items-center">
                          <CircleDot className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="w-0.5 flex-1 border-l-2 border-dashed border-gray-300 my-1"></div>
                          <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.origin')}</div>
                            <div className="font-medium">{job.origin_location || '-'}</div>
                          </div>
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.destination')}</div>
                            <div className="font-medium">{job.destination_location || '-'}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                          <img src={coinsIcon} alt="coins" className="w-5 h-5" />
                          <span className="text-lg font-bold text-teal-500">฿ {(job.price || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                          <CalendarIconLucide className="w-4 h-4 text-gray-500" />
                          <div className="text-left">
                            <div className="text-xs text-[#375B7B]">
                              {t('currentJobs.startJobDate')}
                            </div>
                            <div className="text-xs font-medium">
                              {formatThaiDate(startDate, language)} | {startTime.substring(0, 5)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg p-3 space-y-1.5 text-xs bg-[#e6f8ff]">
                      <div>
                        <span className="text-[#375c7b]">{t('job.goodsType')} : </span>
                        <span>{goodsType}</span>
                      </div>
                      <div>
                        <span className="text-[#375B7B]">{t('job.equipment')} : </span>
                        <span>{job.equipment_list || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#375B7B]">{t('job.safety')} : </span>
                        <span>{job.safety_equipment || '-'}</span>
                      </div>
                    </div>

                  <Button variant="outline" className="w-full h-11 text-base font-medium" onClick={() => navigate(`/job/${job.id}`)}>
                    {t('currentJobs.viewDetails')}
                  </Button>
                  </div>
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