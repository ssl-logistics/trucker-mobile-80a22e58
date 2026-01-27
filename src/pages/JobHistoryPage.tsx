import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, CircleDot, MapPin, Calendar as CalendarIconLucide } from "lucide-react";
import coinsIcon from '@/assets/coins-icon.png';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { formatDate } from '@/lib/dateUtils';
import { toast } from '@/hooks/use-toast';
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
interface JobApplication {
  id: string;
  applied_at: string;
  status: string;
  job_started_at: string | null;
  payment_completed_at: string | null;
  jobs: {
    id: string;
    order_code: string;
    employer_name: string;
    destination_company_name: string | null;
    transport_type: string;
    origin_location: string;
    destination_location: string;
    price: number;
    start_date: string;
    start_time: string;
    job_type: string;
  } | null;
}

// Interface for completed jobs from external API
interface CompletedJob {
  id: string;
  order_number: string;
  transport_type_id: string | null;
  transport_mode: string | null;
  status: string;
  sender_name: string;
  sender_address: string;
  sender_province: string;
  sender_district: string;
  sender_pickup_date: string;
  sender_pickup_time: string;
  destination_name: string;
  destination_address: string;
  destination_province: string;
  destination_district: string;
  destination_delivery_date: string;
  destination_delivery_time: string;
  destination_company_name: string | null;
  product_name: string | null;
  product_weight: number | null;
  product_quantity: number | null;
  product_unit: string | null;
  vehicle_type: string | null;
  transport_price: number;
  created_at: string;
  updated_at: string;
  // Flag to identify bid jobs vs transport jobs
  isBidJob?: boolean;
  // For bid jobs, store the ticket_number for navigation
  ticket_number?: string;
}

export default function JobHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (user) {
      // Load from both external API and local database (for bid-won jobs)
      loadCompletedJobs();
      loadJobHistory(); // Also load local job applications
    }
  }, [user, isInternalDriver, isExternalDriver]);

  const loadJobHistory = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("job_applications").select(`
          id,
          applied_at,
          status,
          job_started_at,
          payment_completed_at,
          jobs:job_id (
            id,
            order_code,
            employer_name,
            destination_company_name,
            transport_type,
            origin_location,
            destination_location,
            price,
            start_date,
            start_time,
            job_type
          )
        `).eq("driver_id", user?.id).order("applied_at", {
        ascending: false
      });
      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error loading job history:", error);
    }
  };

  const loadCompletedJobs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const driverId = user.id;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // For Internal/External drivers, use get-driver-assigned-jobs API
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        
        const [jobsRes, checkinsRes] = await Promise.all([
          fetch(
            `${supabaseUrl}/functions/v1/get-driver-assigned-jobs?driver_id=${driverId}&driver_type=${driverType}&limit=100`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": "fld_sk_2026_xY9kWewT3xNySk8kGsRq_live",
              },
            }
          ),
          fetch(
            `${supabaseUrl}/functions/v1/get-driver-checkins-proxy?driver_id=${driverId}&driver_type=${driverType}&order_number=all`,
            { method: "GET", headers: { "Content-Type": "application/json" } }
          ),
        ]);

        const jobsJson = await jobsRes.json();
        const checkinsJson = await checkinsRes.json();

        const allJobs = jobsJson.data || [];
        const allCheckins = checkinsJson?.data || [];

        // Get transport_order_ids that have delivery_confirmed
        const driverIdField = isInternalDriver ? 'internal_driver_id' : 'external_driver_id';
        const confirmedTransportIds = new Set(
          allCheckins
            .filter(
              (c: any) =>
                c[driverIdField] === driverId &&
                c.checkin_type === "delivery_confirmed" &&
                c.transport_order_id
            )
            .map((c: any) => String(c.transport_order_id))
        );

        // Filter jobs with delivery_confirmed
        const completedFromApi: CompletedJob[] = allJobs
          .filter((job: any) => confirmedTransportIds.has(String(job.id)))
          .map((job: any) => ({
            id: job.id,
            order_number: job.order_number,
            transport_type_id: job.transport_type_id,
            transport_mode: job.transport_mode,
            status: 'completed',
            sender_name: job.factory_name || job.sender_name,
            sender_address: job.sender_address || '',
            sender_province: job.sender_province || '',
            sender_district: job.sender_district || '',
            sender_pickup_date: job.sender_pickup_date,
            sender_pickup_time: job.sender_pickup_time || '00:00',
            destination_name: job.destination_name || '',
            destination_address: job.destination_address || '',
            destination_province: job.destination_province || '',
            destination_district: job.destination_district || '',
            destination_delivery_date: job.destination_delivery_date,
            destination_delivery_time: job.destination_delivery_time || '00:00',
            destination_company_name: job.destination_company_name,
            product_name: job.product_name,
            product_weight: job.product_weight,
            product_quantity: job.product_quantity,
            product_unit: job.product_unit,
            vehicle_type: job.vehicle_type,
            transport_price: job.transport_price || 0,
            created_at: job.created_at,
            updated_at: job.updated_at,
          }));

        console.log('Total completed jobs for internal/external driver:', completedFromApi.length);
        setCompletedJobs(completedFromApi);
        setLoading(false);
        return;
      }

      // For Freelance drivers: Fetch company jobs, factory jobs, checkins, and bid-won jobs in parallel
      const freelanceDriverId = driverId;
      const [companyJobsRes, factoryJobsRes, checkinsRes, bidWonJobsRes] = await Promise.all([
        fetch(
          `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(
            freelanceDriverId
          )}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "fld_sk_2026_xY9kWewT3xNySk8kGsRq_live",
            },
          }
        ),
        fetch(
          `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-factory-assigned-jobs?freelance_driver_id=${encodeURIComponent(
            freelanceDriverId
          )}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": "fld_sk_2026_xY9kWewT3xNySk8kGsRq_live",
            },
          }
        ),
        fetch(
          `${supabaseUrl}/functions/v1/get-driver-checkins-proxy?freelance_driver_id=${encodeURIComponent(
            freelanceDriverId
          )}&order_number=all`,
          { method: "GET", headers: { "Content-Type": "application/json" } }
        ),
        // Fetch bid-won jobs from list-tickets API (includes completed status)
        supabase.functions.invoke('list-tickets', {
          body: {
            freelance_driver_id: freelanceDriverId,
            bids_status: 'accepted', // Get all won bids
          },
        }).catch(() => null),
      ]);

      const companyJobsJson = await companyJobsRes.json();
      const factoryJobsJson = await factoryJobsRes.json();
      const checkinsJson = await checkinsRes.json();

      if (!companyJobsRes.ok) {
        console.error("Error loading company jobs:", companyJobsJson);
      }

      if (!factoryJobsRes.ok) {
        console.error("Error loading factory jobs:", factoryJobsJson);
      }

      if (!checkinsRes.ok) {
        console.error("Error loading checkins:", checkinsJson);
      }

      // Get company jobs
      const companyJobs: CompletedJob[] = Array.isArray(companyJobsJson)
        ? companyJobsJson
        : companyJobsJson.data || [];

      // Get factory jobs - only those that have been accepted
      const allFactoryJobs = factoryJobsJson.data || [];
      const acceptedFactoryJobs = allFactoryJobs
        .filter((job: any) => job.freelance_accepted_at)
        .map((job: any) => ({
          id: job.id,
          order_number: job.order_number || job.job_order_number,
          transport_type_id: null,
          transport_mode: null,
          status: job.status || 'accepted',
          sender_name: job.factory_name || job.sender_name,
          sender_address: job.sender_address || '',
          sender_province: job.sender_province || job.origin_province || '',
          sender_district: job.sender_district || job.origin_district || '',
          sender_pickup_date: job.sender_pickup_date || job.pickup_date,
          sender_pickup_time: job.sender_pickup_time || job.pickup_time || '00:00',
          destination_name: job.destination_name || '',
          destination_address: job.destination_address || '',
          destination_province: job.destination_province || job.drop_off_province || '',
          destination_district: job.destination_district || job.drop_off_district || '',
          destination_delivery_date: job.destination_delivery_date || job.delivery_date,
          destination_delivery_time: job.destination_delivery_time || job.delivery_time || '00:00',
          destination_company_name: job.destination_company_name,
          product_name: job.product_name || job.goods_name,
          product_weight: job.product_weight || job.goods_weight,
          product_quantity: job.product_quantity || job.goods_quantity,
          product_unit: job.product_unit || 'kg',
          vehicle_type: job.vehicle_type || job.truck_type,
          transport_price: job.transport_price || 0,
          created_at: job.created_at,
          updated_at: job.updated_at,
        }));

      // Combine company and factory jobs
      const allJobs = [...companyJobs, ...acceptedFactoryJobs];

      const allCheckins = checkinsJson?.data || checkinsJson || [];
      const checkins = Array.isArray(allCheckins) ? allCheckins : [];

      // ✅ Completed = มี delivery_confirmed ของ transport_order_id (POD ส่งแล้ว)
      const confirmedTransportIds = new Set(
        checkins
          .filter(
            (c: any) =>
              c.freelance_driver_id === freelanceDriverId &&
              c.checkin_type === "delivery_confirmed" &&
              c.transport_order_id
          )
          .map((c: any) => String(c.transport_order_id))
      );

      const completedFromApi = allJobs
        .filter((job) => confirmedTransportIds.has(String(job.id)))
        .map((job) => ({ ...job, status: "completed" }));

      // Process bid-won jobs from list-tickets API
      // Only show bid jobs that have delivery_confirmed check-in (not just status=completed)
      let bidCompletedJobs: CompletedJob[] = [];
      if (bidWonJobsRes && bidWonJobsRes.data) {
        const bidData = bidWonJobsRes.data;
        console.log('Loaded bid-won jobs from API:', bidData);
        const tickets = bidData.data || bidData.tickets || [];
        
        // Get order numbers that have delivery_confirmed from check-ins
        const confirmedOrderNumbers = new Set(
          checkins
            .filter(
              (c: any) =>
                c.freelance_driver_id === freelanceDriverId &&
                c.checkin_type === 'delivery_confirmed'
            )
            .map((c: any) => c.transport_orders?.order_number || c.order_number || '')
            .filter(Boolean)
        );
        
        console.log('Bid job order numbers with delivery_confirmed:', Array.from(confirmedOrderNumbers));
        
        // Filter tickets where current user has an accepted bid AND has delivery_confirmed
        bidCompletedJobs = tickets
          .filter((ticket: any) => {
            const ticketNumber = ticket.ticket_number || '';
            
            // Check if current user has an accepted bid on this ticket
            const userAcceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === freelanceDriverId
            );
            if (!userAcceptedBid) return false;
            
            // Only show in history if has delivery_confirmed check-in
            return confirmedOrderNumbers.has(ticketNumber);
          })
          .map((ticket: any) => {
            // Extract location info from route object (list-tickets API structure)
            const route = ticket.route || {};
            const originDistrict = route.origin_district || {};
            const destinationDistrict = route.destination_district || {};
            const originProvince = originDistrict.province || {};
            const destProvince = destinationDistrict.province || {};
            
            // Extract employer/company name from customer or creator
            const customer = ticket.customer || {};
            const creator = ticket.creator || {};
            const employerName = customer.company_name || customer.full_name || creator.company_name || creator.full_name || '';
            
            // Get accepted bid price for this user
            const acceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === freelanceDriverId
            );
            const bidPrice = acceptedBid?.bid_price || ticket.price || 0;
            
            return {
              id: ticket.id,
              order_number: ticket.ticket_number || ticket.order_code || ticket.post_code,
              transport_type_id: null,
              transport_mode: ticket.transport_type || ticket.post_type,
              status: 'completed',
              sender_name: employerName,
              sender_address: '',
              sender_province: originProvince.name || '',
              sender_district: originDistrict.name || '',
              sender_pickup_date: ticket.pickup_date || ticket.start_date || ticket.created_at?.split('T')[0],
              sender_pickup_time: ticket.pickup_time || ticket.start_time || '00:00',
              destination_name: '',
              destination_address: '',
              destination_province: destProvince.name || '',
              destination_district: destinationDistrict.name || '',
              destination_delivery_date: ticket.delivery_date || ticket.destination_date || ticket.created_at?.split('T')[0],
              destination_delivery_time: ticket.delivery_time || ticket.destination_time || '00:00',
              destination_company_name: ticket.destination_company_name || null,
              product_name: ticket.product || ticket.product_name || null,
              product_weight: ticket.weight_tons || ticket.product_weight || null,
              product_quantity: ticket.trips_per_month || ticket.product_quantity || null,
              product_unit: ticket.product_unit || 'ตัน',
              vehicle_type: ticket.vehicle_type?.name || ticket.truck_type || null,
              transport_price: bidPrice,
              created_at: ticket.created_at,
              updated_at: ticket.updated_at || ticket.created_at,
              // Mark as bid job for correct navigation
              isBidJob: true,
              ticket_number: ticket.ticket_number,
            };
          });
        
        console.log(`Found ${bidCompletedJobs.length} completed bid jobs for user ${freelanceDriverId} (with delivery_confirmed)`);
      }

      // Merge API completed jobs with bid completed jobs, dedupe by order_number
      const allCompleted = [...completedFromApi, ...bidCompletedJobs];
      const uniqueCompleted = allCompleted.filter((job, index, self) =>
        index === self.findIndex((j) => j.order_number === job.order_number)
      );

      console.log('Total completed jobs:', uniqueCompleted.length, '(API:', completedFromApi.length, ', Bid:', bidCompletedJobs.length, ')');
      setCompletedJobs(uniqueCompleted);
    } catch (error) {
      console.error("Error fetching completed jobs:", error);
      setCompletedJobs([]);
    } finally {
      setLoading(false);
    }
  };
  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };
  const getStatusColor = (status: string) => {
    if (status === "accepted" || status === "in_progress") return "bg-green-50 border-green-200";
    if (status === "completed") return "bg-gray-50 border-gray-200";
    return "bg-yellow-50 border-yellow-200";
  };
  const getStatusBadge = (app: JobApplication) => {
    if (app.payment_completed_at) {
      return <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="text-xs font-medium text-gray-700">{t('jobHistory.statusCompleted')}</span>
        </div>;
    }
    if (app.job_started_at) {
      return <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span className="text-xs font-medium text-orange-700">{t('jobHistory.statusDelivering')}</span>
        </div>;
    }
    return <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 rounded-lg">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        <span className="text-xs font-medium text-blue-700">{t('jobHistory.statusAccepted')}</span>
      </div>;
  };
  const filterApplications = (apps: JobApplication[]) => {
    // First filter out applications with null jobs
    let filtered = apps.filter(app => app.jobs !== null);

    // Filter by tab
    if (activeTab === "in-progress") {
      filtered = filtered.filter(app => app.job_started_at && !app.payment_completed_at);
    } else if (activeTab === "completed") {
      filtered = filtered.filter(app => app.payment_completed_at);
    }

    // Filter by month
    if (selectedMonth !== "all") {
      const targetMonth = parseInt(selectedMonth);
      filtered = filtered.filter(app => {
        const month = new Date(app.applied_at).getMonth();
        return month === targetMonth;
      });
    }
    return filtered;
  };

  const filterCompletedJobs = (jobs: CompletedJob[]) => {
    let filtered = [...jobs];

    // Filter by tab - only show in "all" or "completed" tabs
    if (activeTab === "in-progress") {
      return [];
    }

    // Filter by month
    if (selectedMonth !== "all") {
      const targetMonth = parseInt(selectedMonth);
      filtered = filtered.filter(job => {
        const month = new Date(job.sender_pickup_date).getMonth();
        return month === targetMonth;
      });
    }
    return filtered;
  };

  const filteredApplications = filterApplications(applications);
  const filteredCompletedJobs = filterCompletedJobs(completedJobs);
  return <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-[#DDEDFF] rounded-b-xl sticky top-0 z-10 page-header-safe">
        <div className="px-4 py-3 flex items-center justify-center relative">
          <button onClick={() => navigate("/home")} className="absolute left-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">{t('jobHistory.title')}</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-white h-auto p-0">
          <TabsTrigger value="all" className="flex-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t('jobHistory.all')}
          </TabsTrigger>
          <TabsTrigger value="in-progress" className="flex-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t('jobHistory.inProgress')}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {t('jobHistory.completed')}
          </TabsTrigger>
        </TabsList>

        {/* Month Filter */}
        <div className="p-4 bg-white">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('jobHistory.selectMonth')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('jobHistory.allMonths')}</SelectItem>
              <SelectItem value="0">{t('jobHistory.january')}</SelectItem>
              <SelectItem value="1">{t('jobHistory.february')}</SelectItem>
              <SelectItem value="2">{t('jobHistory.march')}</SelectItem>
              <SelectItem value="3">{t('jobHistory.april')}</SelectItem>
              <SelectItem value="4">{t('jobHistory.may')}</SelectItem>
              <SelectItem value="5">{t('jobHistory.june')}</SelectItem>
              <SelectItem value="6">{t('jobHistory.july')}</SelectItem>
              <SelectItem value="7">{t('jobHistory.august')}</SelectItem>
              <SelectItem value="8">{t('jobHistory.september')}</SelectItem>
              <SelectItem value="9">{t('jobHistory.october')}</SelectItem>
              <SelectItem value="10">{t('jobHistory.november')}</SelectItem>
              <SelectItem value="11">{t('jobHistory.december')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">{t('jobHistory.loading')}</div>
            ) : (filteredApplications.length === 0 && filteredCompletedJobs.length === 0) ? (
              <div className="text-center py-8 text-gray-500">{t('jobHistory.noData')}</div>
            ) : (
              <>
                {/* Completed jobs from external API */}
                {filteredCompletedJobs.map(job => (
                  <Card key={job.id} className="overflow-hidden bg-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                    // Navigate to correct page based on job type
                    if (job.isBidJob && job.ticket_number) {
                      navigate(`/bid-job/${job.ticket_number}`);
                    } else {
                      navigate(`/job/${job.order_number}?from=history`);
                    }
                  }}>
                    <div className="flex items-center justify-between px-3 py-2 bg-white">
                      <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
                        {t('job.order_code')} {job.order_number}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(job.sender_pickup_date, language)} | {job.sender_pickup_time?.substring(0, 5)}
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t('job.employer')} : </span>
                        <span className="font-medium">{job.sender_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {job.vehicle_type && (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                            {getTranslatedVehicleType(job.vehicle_type, t)}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50">
                          {job.status === 'completed' ? t('jobStatus.completed') : t('jobStatus.delivered')}
                        </Badge>
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
                              <div className="font-medium">{job.sender_province}, {job.sender_district}</div>
                            </div>
                            <div className="text-xs">
                              <div className="text-muted-foreground">{t('job.destination')}</div>
                              <div className="font-medium">{job.destination_province}, {job.destination_district}</div>
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
                              <div className="text-xs text-[#375B7B]">{t('job.deliveryDate')}</div>
                              <div className="text-xs font-medium">
                                {formatDate(job.destination_delivery_date, language)} | {job.destination_delivery_time?.substring(0, 5)}
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
                          <span className="text-[#375B7B]">{t('job.weight')} : </span>
                          <span>{job.product_weight ? `${job.product_weight.toLocaleString()} ${job.product_unit || 'kg'}` : '-'}</span>
                        </div>
                        <div>
                          <span className="text-[#375B7B]">{t('job.quantity')} : </span>
                          <span>{job.product_quantity || '-'}</span>
                        </div>
                      </div>

                      <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-medium text-green-700">{t('jobHistory.statusCompleted')}</span>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Local job applications */}
                {filteredApplications.map(app => {
                  if (!app.jobs) return null;
                  
                  return (
                    <Card key={app.id} className="overflow-hidden bg-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/job/${app.jobs!.id}`)}>
                      <div className="flex items-center justify-between px-3 py-2 bg-white">
                        <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
                          {t('job.order_code')} {app.jobs.order_code}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(app.jobs.start_date, language)} | {formatTime(app.jobs.start_time)}
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t('job.employer')} : </span>
                          <span className="font-medium">{app.jobs.destination_company_name || app.jobs.employer_name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {app.jobs.job_type === "domestic" ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                              {t('job.domestic')}
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                                {t('job.international')}
                              </Badge>
                              {app.jobs.transport_type?.includes("inbound") && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                  {t('job.inbound')}
                                </Badge>
                              )}
                              {app.jobs.transport_type?.includes("outbound") && (
                                <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                                  {t('job.outbound')}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {app.jobs.transport_type}
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
                                <div className="font-medium">{app.jobs.origin_location}</div>
                              </div>
                              <div className="text-xs">
                                <div className="text-muted-foreground">{t('job.destination')}</div>
                                <div className="font-medium">{app.jobs.destination_location}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                            <img src={coinsIcon} alt="coins" className="w-5 h-5" />
                            <span className="text-lg font-bold text-teal-500">฿ {app.jobs.price.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="mt-3">
                          {getStatusBadge(app)}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}