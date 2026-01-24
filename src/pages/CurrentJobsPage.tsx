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
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
// Interface for accepted jobs from external API
interface AcceptedJob {
  id: string;
  order_number: string;
  transport_type_id: string | null;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_latitude: number | null;
  sender_longitude: number | null;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  sender_contact_name: string;
  sender_contact_phone: string;
  destination_name: string;
  destination_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_province: string;
  destination_district: string;
  destination_delivery_date: string;
  destination_delivery_time: string;
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_company_name: string | null;
  product_name: string | null;
  product_type: string | null;
  product_category: string | null;
  product_weight: number | null;
  product_weight_value: number | null;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string | null;
  vehicle_category: string | null;
  transport_price: number;
  driver_name: string | null;
  driver_phone: string | null;
  license_plate: string | null;
  freelance_bidder_id: string | null;
  freelance_bidder_name: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
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
      
      // Fetch both company jobs and factory jobs in parallel
      const [companyJobsResponse, factoryJobsResponse] = await Promise.all([
        fetch(
          `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(freelanceDriverId)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
            },
          }
        ),
        supabase.functions.invoke('get-factory-assigned-jobs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: null,
        }).then(async () => {
          // Use direct fetch for query params
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${encodeURIComponent(freelanceDriverId)}&limit=50`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          );
          return res;
        }).catch(() => null)
      ]);

      // Process company jobs
      let companyJobs: AcceptedJob[] = [];
      if (companyJobsResponse.ok) {
        const companyResult = await companyJobsResponse.json();
        console.log('Loaded company accepted jobs:', companyResult);
        companyJobs = Array.isArray(companyResult) ? companyResult : (companyResult.data || []);
      } else {
        console.error('Error loading company accepted jobs:', await companyJobsResponse.text());
      }

      // Process factory jobs - only include accepted ones
      let factoryJobs: AcceptedJob[] = [];
      try {
        // Direct fetch for factory jobs
        const factoryRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${encodeURIComponent(freelanceDriverId)}&limit=50`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        
        if (factoryRes.ok) {
          const factoryResult = await factoryRes.json();
          console.log('Loaded factory jobs:', factoryResult);
          const allFactoryJobs = Array.isArray(factoryResult) ? factoryResult : (factoryResult.data || []);
          
          // Only include factory jobs that have been accepted
          factoryJobs = allFactoryJobs
            .filter((job: any) => job.freelance_accepted_at)
            .map((job: any) => ({
              ...job,
              // Map factory job fields to match AcceptedJob interface
              sender_name: job.factory_name || job.sender_name,
              isFactoryJob: true,
            }));
        }
      } catch (factoryError) {
        console.error('Error loading factory jobs:', factoryError);
      }

      // Combine both job sources
      const allJobs = [...companyJobs, ...factoryJobs];
      console.log('Total current jobs:', allJobs.length, '(Company:', companyJobs.length, ', Factory:', factoryJobs.length, ')');
      
      setAcceptedJobs(allJobs);
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

  // Filter jobs based on search and date filters
  // Exclude completed/closed jobs - only show active jobs
  const completedStatuses = ['completed', 'cancelled', 'closed', 'delivered', 'ส่งแล้ว', 'ยกเลิก', 'ปิดงาน', 'จบงาน'];
  
  const filteredJobs = acceptedJobs.filter((job: any) => {
    // Filter out completed jobs
    const jobStatus = (job.status || '').toLowerCase().trim();
    if (completedStatuses.some(s => jobStatus.includes(s.toLowerCase()))) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const orderNumber = job.order_number || '';
      const senderName = job.sender_name || '';
      const matchesSearch = 
        orderNumber.toLowerCase().includes(query) || 
        senderName.toLowerCase().includes(query) || 
        (job.destination_company_name && job.destination_company_name.toLowerCase().includes(query)) || 
        (job.sender_province && job.sender_province.toLowerCase().includes(query)) || 
        (job.destination_province && job.destination_province.toLowerCase().includes(query)) ||
        (job.product_name && job.product_name.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const jobDate = new Date(job.sender_pickup_date);
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
          const pickupDate = job.sender_pickup_date || '';
          const pickupTime = job.sender_pickup_time || '';
          const deliveryDate = job.destination_delivery_date || '';
          const deliveryTime = job.destination_delivery_time || '';

          return <Card key={job.id} className="overflow-hidden bg-card">
                  <div className="flex items-center justify-between px-3 py-2 bg-white">
                    <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
                      {t('job.order_code')} {job.order_number}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {formatThaiDate(pickupDate, language)} | {pickupTime.substring(0, 5)}
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t('job.employer')} : </span>
                      <span className="font-medium">{job.sender_name}</span>
                    </div>
                    
                    {job.vehicle_type && (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                        {getTranslatedVehicleType(job.vehicle_type, t)}
                      </Badge>
                    )}

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
                            <div className="font-medium">{job.sender_province}, {job.sender_district}</div>
                            <div className="text-muted-foreground text-[10px] line-clamp-1">{job.sender_address}</div>
                          </div>
                          <div className="text-xs">
                            <div className="text-muted-foreground">{t('job.destination')}</div>
                            <div className="font-medium">{job.destination_province}, {job.destination_district}</div>
                            <div className="text-muted-foreground text-[10px] line-clamp-1">{job.destination_address}</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                          <img src={coinsIcon} alt="coins" className="w-5 h-5" />
                          <span className="text-lg font-bold text-teal-500">฿ {(job.transport_price || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                          <CalendarIconLucide className="w-4 h-4 text-gray-500" />
                          <div className="text-left">
                            <div className="text-xs text-[#375B7B]">
                              วันส่งสินค้า
                            </div>
                            <div className="text-xs font-medium">
                              {formatThaiDate(deliveryDate, language)} | {deliveryTime.substring(0, 5)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg p-3 space-y-1.5 text-xs bg-[#e6f8ff]">
                      <div>
                        <span className="text-[#375c7b]">{t('job.goods')} : </span>
                        <span>{job.product_name || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#375B7B]">น้ำหนัก : </span>
                        <span>{job.product_weight ? `${job.product_weight.toLocaleString()} ${job.product_unit || 'kg'}` : '-'}</span>
                      </div>
                      <div>
                        <span className="text-[#375B7B]">จำนวน : </span>
                        <span>{job.product_quantity || '-'}</span>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full h-11 text-base font-medium" onClick={() => navigate(`/job/${job.order_number}`)}>
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