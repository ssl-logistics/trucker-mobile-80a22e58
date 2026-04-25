import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { canHandleJobTruckType } from '@/utils/truckTypeHierarchy';
import {
  getDriverAssignedJobs,
  getFactoryAssignedJobs,
  getFreelanceAcceptedJobs,
} from '@/lib/externalApi';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// External API types
interface ExternalTicketRoute {
  id: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  sequence: number;
}

interface ExternalTicketUser {
  id: string;
  full_name: string;
  company_name?: string;
  phone?: string;
}

interface ExternalTicket {
  id: string;
  ticket_number: string;
  price: number;
  price_type: string;
  start_date: string;
  start_time?: string;
  status: string;
  goods_type?: string;
  goods_weight?: number;
  notes?: string;
  is_multi_destination: boolean;
  routes: ExternalTicketRoute[];
  customer?: ExternalTicketUser;
  creator?: ExternalTicketUser;
  vehicle_type?: {
    id: string;
    name: string;
  };
  bids?: Array<{
    id: string;
    contractor_id: string;
    bid_price: number;
    status: string;
    created_at: string;
  }>;
}

// Transform external ticket to job format
const transformTicketToJob = (ticket: ExternalTicket): any => {
  const originRoute = ticket.routes?.find(r => r.sequence === 1) || ticket.routes?.[0];
  const destinationRoute = ticket.routes?.reduce((max, r) => r.sequence > (max?.sequence || 0) ? r : max, ticket.routes?.[0]);
  
  const employerName = ticket.customer?.company_name || ticket.customer?.full_name || 
                       ticket.creator?.company_name || ticket.creator?.full_name || 'Unknown';

  return {
    id: ticket.id,
    order_code: ticket.ticket_number,
    employer_name: employerName,
    job_type: 'งานสัญญาจ้าง',
    transport_type: ticket.is_multi_destination ? 'หลายที่' : 'เที่ยวเดียว',
    origin_location: originRoute?.origin_name || '',
    destination_location: destinationRoute?.destination_name || '',
    origin_lat: originRoute?.origin_lat || 0,
    origin_lng: originRoute?.origin_lng || 0,
    destination_lat: destinationRoute?.destination_lat || 0,
    destination_lng: destinationRoute?.destination_lng || 0,
    price: ticket.price || 0,
    start_date: ticket.start_date || new Date().toISOString().split('T')[0],
    start_time: ticket.start_time || '08:00',
    status: 'open_for_bidding',
    goods_type: ticket.goods_type || '',
    goods_weight: ticket.goods_weight || 0,
    notes: ticket.notes || '',
    required_truck_type: ticket.vehicle_type?.name || '',
    created_at: new Date().toISOString(),
  };
};

export default function SearchPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, userType } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [domesticType, setDomesticType] = useState('');
  const [internationalType, setInternationalType] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);


  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user, userType, isInternalDriver, isExternalDriver]);

  // Real-time search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() || domesticType || internationalType || province || district || minPrice || maxPrice) {
        performSearch();
      } else {
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, domesticType, internationalType, province, district, minPrice, maxPrice]);

  const loadJobs = async () => {
    try {
      // Use get-express-rent-posts API like Home page
      const { data: responseData, error } = await supabase.functions.invoke('get-express-rent-posts');

      if (error) {
        console.error('Error loading jobs from API:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive',
        });
        return;
      }

      console.log('Search page - Loaded jobs from API:', responseData);
      
      // Transform API response to Job format
      const apiJobs = Array.isArray(responseData) ? responseData : (responseData?.data || []);
      
      // Filter by is_express_rent based on user type (same as Home page)
      // internal_driver & external_driver: show is_express_rent = false (งานปกติ)
      // freelance_driver: show is_express_rent = true (งานด่วน)
      const isExpressRentFilter = isInternalDriver || isExternalDriver ? false : true;
      
      const transformedJobs = apiJobs
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
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-accepted-jobs-proxy?freelance_driver_id=${user.id}`,
            {
              headers: {
                'Content-Type': 'application/json',
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
        const filterPastJobs = (jobList: any[]) => {
          return jobList.filter(job => {
            if (!job.start_date) return true;
            const time = job.pickup_time || '23:59:59';
            const normalizedTime = time.length === 5 ? `${time}:00` : time;
            const pickupDateTime = new Date(`${job.start_date}T${normalizedTime}`);
            return pickupDateTime >= now;
          });
        };

        // Get driver's vehicle type for filtering
        const driverVehicleType = user.vehicle_type || '';
        console.log('🚛 Search - Driver vehicle type:', driverVehicleType);
        
        // Filter out: completed jobs, accepted via external API, past jobs, and jobs requiring bigger trucks
        const availableJobs = filterPastJobs(transformedJobs)
          .filter(job => !completedJobIds.has(job.id))
          .filter(job => !acceptedOrderNumbers.has(job.order_code))
          .filter(job => {
            const canHandle = canHandleJobTruckType(driverVehicleType, job.equipment_list);
            return canHandle;
          })
          .map(job => ({
            ...job,
            isAccepted: acceptedJobIds.has(job.id)
          }));
        
        setAllJobs(availableJobs);
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
        setAllJobs(filteredJobs);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive',
      });
    }
  };

  // Filter type values for filtering (internal use)
  const domesticTypeValues = ['เที่ยวเดียว', 'หลายที่'];
  const internationalTypeValues = ['ขาเข้า', 'ขาออก'];

  // Display labels for filter buttons
  const getDomesticTypeLabel = (value: string) => {
    if (value === 'เที่ยวเดียว') return t('job.single_trip');
    if (value === 'หลายที่') return t('job.multiple_locations');
    return value;
  };
  
  const getInternationalTypeLabel = (value: string) => {
    if (value === 'ขาเข้า') return t('job.inbound');
    if (value === 'ขาออก') return t('job.outbound');
    return value;
  };

  const provinceValues = [
    'กรุงเทพมหานคร',
    'นนทบุรี',
    'ปทุมธานี',
    'สมุทรปราการ',
    'สมุทรสาคร',
    'นครปฐม',
  ];

  const districtsByProvince: Record<string, string[]> = {
    'กรุงเทพมหานคร': ['บางรัก', 'ปทุมวัน', 'บางกอกใหญ่', 'บางกอกน้อย', 'ห้วยขวาง'],
    'นนทบุรี': ['เมืองนนทบุรี', 'บางกรวย', 'บางใหญ่', 'บางบัวทอง', 'ไทรน้อย'],
    'ปทุมธานี': ['เมืองปทุมธานี', 'คลองหลวง', 'ธัญบุรี', 'ลำลูกกา', 'หนองเสือ'],
    'สมุทรปราการ': ['เมืองสมุทรปราการ', 'บางบ่อ', 'บางพลี', 'พระประแดง', 'พระสมุทรเจดีย์'],
    'สมุทรสาคร': ['เมืองสมุทรสาคร', 'กระทุ่มแบน', 'บ้านแพ้ว'],
    'นครปฐม': ['เมืองนครปฐม', 'กำแพงแสน', 'นครชัยศรี', 'ดอนตูม', 'บางเลน'],
  };

  const availableDistricts = province ? districtsByProvince[province] || [] : [];

  const handleClearFilter = () => {
    setDomesticType('');
    setInternationalType('');
    setProvince('');
    setDistrict('');
    setMinPrice('');
    setMaxPrice('');
  };

  const handleProvinceChange = (value: string) => {
    setProvince(value);
    setDistrict(''); // Reset district when province changes
  };

  const performSearch = (query?: string) => {
    const searchTerm = query || searchQuery;
    
    let filtered = [...allJobs];

    // Filter by search query (bi-directional matching)
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(job => {
        const fields = [
          job.employer_name,
          job.destination_company_name,
          job.origin_location,
          job.destination_location,
          job.transport_type,
          job.transport_type_label,
          job.order_code,
          job.goods_type,
          job.equipment_list
        ];
        
        return fields.some(field => {
          if (!field) return false;
          const lowerField = field.toLowerCase();
          // Check both directions: search term in field OR field in search term
          return lowerField.includes(lowerSearchTerm) || lowerSearchTerm.includes(lowerField);
        });
      });
    }

    // Filter by domestic type (เที่ยวเดียว / หลายที่)
    if (domesticType) {
      filtered = filtered.filter(job => {
        const transportType = job.transport_type?.toLowerCase() || '';
        const transportLabel = job.transport_type_label?.toLowerCase() || '';
        const sendMode = job.send_mode?.toLowerCase() || '';
        
        if (domesticType === 'เที่ยวเดียว') {
          return transportType.includes('single') || 
                 transportLabel.includes('เที่ยวเดียว') || 
                 sendMode === 'single';
        } else if (domesticType === 'หลายที่') {
          return transportType.includes('multiple') || 
                 transportLabel.includes('หลายที่') || 
                 sendMode === 'multiple';
        }
        return true;
      });
    }

    // Filter by international type (ขาเข้า / ขาออก)
    if (internationalType) {
      filtered = filtered.filter(job => {
        const jobType = job.job_type?.toLowerCase() || '';
        const transportLabel = job.transport_type_label?.toLowerCase() || '';
        
        if (internationalType === 'ขาเข้า') {
          return jobType.includes('inbound') || 
                 jobType.includes('import') ||
                 transportLabel.includes('ขาเข้า');
        } else if (internationalType === 'ขาออก') {
          return jobType.includes('outbound') || 
                 jobType.includes('export') ||
                 transportLabel.includes('ขาออก');
        }
        return true;
      });
    }

    // Filter by province (search in origin/destination locations)
    if (province) {
      filtered = filtered.filter(job => {
        const origin = job.origin_location?.toLowerCase() || '';
        const destination = job.destination_location?.toLowerCase() || '';
        const lowerProvince = province.toLowerCase();
        return origin.includes(lowerProvince) || destination.includes(lowerProvince);
      });
    }

    // Filter by district (search in origin/destination locations)
    if (district) {
      filtered = filtered.filter(job => {
        const origin = job.origin_location?.toLowerCase() || '';
        const destination = job.destination_location?.toLowerCase() || '';
        const lowerDistrict = district.toLowerCase();
        return origin.includes(lowerDistrict) || destination.includes(lowerDistrict);
      });
    }

    // Filter by price range
    if (minPrice) {
      filtered = filtered.filter(job => job.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      filtered = filtered.filter(job => job.price <= parseFloat(maxPrice));
    }

    setSearchResults(filtered);
    setShowResults(true);
  };

  const handleSearch = () => {
    performSearch();
    setFilterOpen(false);
  };

  const handleSearchTermClick = (term: string) => {
    setSearchQuery(term);
    performSearch(term);
  };

  const handleAcceptJob = (job: any) => {
    setSelectedJob(job);
    setConfirmDialogOpen(true);
  };

  const confirmJobAcceptance = async () => {
    if (!selectedJob || !user) return;

    try {
      const { error } = await supabase
        .from('job_applications')
        .insert({
          job_id: selectedJob.id,
          driver_id: user.id,
          status: 'accepted',
        });

      if (error) throw error;

      toast({
        title: t('home.job_accepted'),
        description: `${t('confirm.order_code')}: ${selectedJob.order_code}`,
      });

      setConfirmDialogOpen(false);
      setSelectedJob(null);
      loadJobs();
    } catch (error: any) {
      toast({
        title: t('home.error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with rounded corners */}
      <header 
        className="text-gray-800 rounded-b-3xl shadow-lg overflow-hidden"
        style={{ backgroundColor: 'rgb(220, 232, 245)', paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate('/home')} className="p-1">
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center text-black">{t('search.title')}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-4 bg-white border-b">
        <div className="relative flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch();
              }
            }}
            placeholder={t('search.search')}
            className="flex-1 border-primary"
          />
          <button
            onClick={() => setFilterOpen(true)}
            className="p-2 border border-primary rounded-md"
          >
            <Filter className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Search Results or Suggestions */}
      {showResults ? (
        <div className="px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('search.results')}</h3>
            <span className="text-sm text-muted-foreground">
              {searchResults.length} {t('home.items')}
            </span>
          </div>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((job) => (
                <JobCard key={job.id} job={job} onAccept={handleAcceptJob} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('search.no_results')}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-muted-foreground">
          {t('search.start_search')}
        </div>
      )}

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{t('search.filter')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('search.filter_desc')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(85vh-200px)] pb-20">
            {/* Domestic Transport */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.domestic')}
              </label>
              <div className="flex flex-wrap gap-2">
                {domesticTypeValues.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setDomesticType(domesticType === type ? '' : type)
                    }
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      domesticType === type
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300'
                    }`}
                  >
                    {getDomesticTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* International Transport */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.international')}
              </label>
              <div className="flex flex-wrap gap-2">
                {internationalTypeValues.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setInternationalType(internationalType === type ? '' : type)
                    }
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      internationalType === type
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300'
                    }`}
                  >
                    {getInternationalTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Province */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('search.province')}</label>
              <Select value={province} onValueChange={handleProvinceChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('search.select_province')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {provinceValues.map((prov) => (
                    <SelectItem key={prov} value={prov}>
                      {prov}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* District */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('search.district')}</label>
              <Select 
                value={district} 
                onValueChange={setDistrict}
                disabled={!province}
              >
                <SelectTrigger>
                  <SelectValue placeholder={province ? t('search.select_district') : t('search.select_district_first')} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableDistricts.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t('search.price_range')}
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder={t('search.min_price')}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span>—</span>
                <Input
                  type="number"
                  placeholder={t('search.max_price')}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="absolute bottom-6 left-4 right-4 flex gap-3">
            <Button
              variant="outline"
              onClick={handleClearFilter}
              className="flex-1"
            >
              {t('search.clear')}
            </Button>
            <Button onClick={handleSearch} className="flex-1">
              {t('search.apply')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmJobDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmJobAcceptance}
        job={selectedJob}
      />
    </div>
  );
}
