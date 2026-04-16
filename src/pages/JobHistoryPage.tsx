import { useState, useEffect, useCallback } from "react";
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
import { getFreelanceAcceptedJobs, getFactoryAssignedJobs, getDriverCheckins, getDriverAssignedJobs } from '@/lib/externalApi';
import { HistoryJobCard } from '@/components/history/HistoryJobCard';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
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
  // International job identifiers
  booking_no?: string | null;
  bl_no?: string | null;
  transport_category?: string | null;
  // Flag to identify bid jobs vs transport jobs
  isBidJob?: boolean;
  // For bid jobs, store the ticket_number for navigation
  ticket_number?: string;
  // Support for multiple origins/destinations
  origins?: Array<{ sequence: number; location?: string; address?: string; province?: string; district?: string }>;
  destinations?: Array<{ sequence: number; location?: string; address?: string; province?: string; district?: string }>;
  // Job type for domestic/international distinction
  job_type?: string;
  // Transferred job flags
  is_transferred?: boolean;
  status_at_transfer?: string;
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

      // For Internal/External drivers, use get-driver-assigned-jobs API (direct external call)
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        
        const [inTransitResult, returningContainerResult, containerReturnedResult, completedResult, closedResult, checkinsRes] = await Promise.all([
          getDriverAssignedJobs(driverId, driverType, 1000, 'in_transit'),
          getDriverAssignedJobs(driverId, driverType, 1000, 'returning_container'),
          getDriverAssignedJobs(driverId, driverType, 1000, 'container_returned'),
          getDriverAssignedJobs(driverId, driverType, 1000, 'completed'),
          getDriverAssignedJobs(driverId, driverType, 1000, 'closed'),
          getDriverCheckins(driverId, driverType),
        ]);

        const allJobsRaw = [
          ...((inTransitResult.data as any)?.data || []),
          ...((returningContainerResult.data as any)?.data || []),
          ...((containerReturnedResult.data as any)?.data || []),
          ...((completedResult.data as any)?.data || []),
          ...((closedResult.data as any)?.data || []),
        ];
        const allJobs = allJobsRaw.filter((job: any, index: number, self: any[]) =>
          index === self.findIndex((j: any) => j.id === job.id)
        );
        
        console.log('[JobHistory] Fetched jobs count -',
          'in_transit:', ((inTransitResult.data as any)?.data || []).length,
          'returning_container:', ((returningContainerResult.data as any)?.data || []).length,
          'container_returned:', ((containerReturnedResult.data as any)?.data || []).length,
          'completed:', ((completedResult.data as any)?.data || []).length,
          'closed:', ((closedResult.data as any)?.data || []).length,
          'unique total:', allJobs.length);
        const allCheckins = (checkinsRes.data as any)?.data || [];
        
        console.log('[JobHistory] Total checkins:', allCheckins.length);
        // Debug: show first 3 checkins to understand data structure
        if (allCheckins.length > 0) {
          console.log('[JobHistory] Sample checkin fields:', Object.keys(allCheckins[0]));
          console.log('[JobHistory] Sample checkins (first 3):', allCheckins.slice(0, 3).map((c: any) => ({
            checkin_type: c.checkin_type,
            internal_driver_id: c.internal_driver_id,
            external_driver_id: c.external_driver_id,
            driver_id: c.driver_id,
            transport_order_id: c.transport_order_id,
            order_number: c.order_number || c.transport_orders?.order_number,
          })));
        }

        // Count PODs per transport_order_id for multi-destination jobs
        const driverIdField = isInternalDriver ? 'internal_driver_id' : 'external_driver_id';
        const podCountByTransportId: Record<string, number> = {};
        const containerReturnConfirmedByTransportId: Set<string> = new Set();
        
        // Try matching with driverIdField first, fallback to driver_id
        const matchingCheckins = allCheckins.filter(
          (c: any) =>
            (c[driverIdField] === driverId || c.driver_id === driverId) &&
            c.transport_order_id
        );
        
        console.log('[JobHistory] Matching checkins count:', matchingCheckins.length, 'driverIdField:', driverIdField, 'driverId:', driverId);
        
        matchingCheckins.forEach((c: any) => {
            const transportId = String(c.transport_order_id);
            if (c.checkin_type === "delivery_confirmed" || c.checkin_type?.startsWith("delivery_confirmed_")) {
              podCountByTransportId[transportId] = (podCountByTransportId[transportId] || 0) + 1;
            }
            if (c.checkin_type === "container_return_confirmed") {
              containerReturnConfirmedByTransportId.add(transportId);
            }
          });
        
        console.log('POD counts by transport ID (history):', podCountByTransportId);
        console.log('Container return confirmed by transport ID:', [...containerReturnConfirmedByTransportId]);

        // Helper: check if job is international
        const isInternationalJob = (job: any) => !!(job.booking_no || job.bl_no || (job.transport_category && job.transport_category !== 'domestic'));

        // Filter jobs that have ALL destinations POD completed
        // Status must be completed/closed AND POD must be verified
        const completedFromApi: CompletedJob[] = allJobs
          .filter((job: any) => {
            // Always include transferred jobs in history
            if (job.is_transferred) return true;
            
            const transportId = String(job.id);
            const podCount = podCountByTransportId[transportId] || 0;
            const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
              ? job.destinations.length 
              : 1;
            
            const allPodsCompleted = podCount >= destinationCount;
            
            // For international jobs:
            // - Booking jobs: completed when container return is confirmed
            // - BL jobs: require all PODs + container return confirmed
            if (isInternationalJob(job)) {
              const hasContainerReturnConfirmed = containerReturnConfirmedByTransportId.has(transportId);
              const isBookingJob = !!job.booking_no && !job.bl_no;
              return isBookingJob
                ? hasContainerReturnConfirmed
                : (allPodsCompleted && hasContainerReturnConfirmed);
            }
            
            // Domestic jobs: need all PODs completed
            return allPodsCompleted;
          })
          .map((job: any) => ({
            id: job.id,
            order_number: job.order_number,
            transport_type_id: job.transport_type_id,
            transport_mode: job.transport_mode,
            status: job.is_transferred ? 'transferred' : 'completed',
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
            // Preserve origins/destinations arrays for multi-destination detection
            origins: job.origins,
            destinations: job.destinations,
            job_type: job.job_type || 'domestic',
            // International job identifiers
            booking_no: job.booking_no || null,
            bl_no: job.bl_no || null,
            transport_category: job.transport_category || null,
          }));

        console.log('Total completed jobs for internal/external driver:', completedFromApi.length);
        setCompletedJobs(completedFromApi);
        setLoading(false);
        return;
      }

      // For Freelance drivers: Fetch company jobs, factory jobs, checkins, and bid-won jobs in parallel
      const freelanceDriverId = driverId;
      const [companyJobsRes, factoryJobsRes, checkinsRes2, bidWonJobsRes] = await Promise.all([
        getFreelanceAcceptedJobs(freelanceDriverId, 1000),
        getFactoryAssignedJobs(freelanceDriverId, 1000),
        getDriverCheckins(freelanceDriverId, 'freelance'),
        // Fetch bid-won jobs from list-tickets API (includes completed status)
        supabase.functions.invoke('list-tickets', {
          body: {
            freelance_driver_id: freelanceDriverId,
            bids_status: 'accepted', // Get all won bids
          },
        }).catch(() => null),
      ]);

      const { data: companyJobsJson, error: companyError } = await companyJobsRes;
      const { data: factoryJobsJson, error: factoryError } = await factoryJobsRes;
      const { data: checkinsJson, error: checkinsError } = await checkinsRes2;

      if (companyError) {
        console.error("Error loading company jobs:", companyError);
      }

      if (factoryError) {
        console.error("Error loading factory jobs:", factoryError);
      }

      if (checkinsError) {
        console.error("Error loading checkins:", checkinsError);
      }

      // Get company jobs
      const companyJobs: CompletedJob[] = Array.isArray(companyJobsJson)
        ? companyJobsJson
        : (companyJobsJson?.data || []);

      // Get factory jobs - only those that have been accepted
      const allFactoryJobs = factoryJobsJson?.data || [];
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
          // International job identifiers
          booking_no: job.booking_no || null,
          bl_no: job.bl_no || null,
          transport_category: job.transport_category || null,
        }));

      // Combine company and factory jobs
      const allJobs = [...companyJobs, ...acceptedFactoryJobs];

      const allCheckins = checkinsJson?.data || checkinsJson || [];
      const checkins = Array.isArray(allCheckins) ? allCheckins : [];

       // Count PODs and container returns per transport_order_id and order_number
       const podCountByTransportId: Record<string, number> = {};
       const podCountByOrderNumber: Record<string, number> = {};
       const containerReturnConfirmedByTransportId: Set<string> = new Set();
       const containerReturnConfirmedByOrderNumber: Set<string> = new Set();
      
      checkins
        .filter(
          (c: any) => c.freelance_driver_id === freelanceDriverId
        )
        .forEach((c: any) => {
          if (c.checkin_type === "delivery_confirmed" || c.checkin_type?.startsWith("delivery_confirmed_")) {
            if (c.transport_order_id) {
              const transportId = String(c.transport_order_id);
              podCountByTransportId[transportId] = (podCountByTransportId[transportId] || 0) + 1;
            }
            const orderNumber = c.transport_orders?.order_number || c.order_number || '';
            if (orderNumber) {
              podCountByOrderNumber[orderNumber] = (podCountByOrderNumber[orderNumber] || 0) + 1;
            }
          }
           if (c.checkin_type === "container_return_confirmed") {
             if (c.transport_order_id) {
               containerReturnConfirmedByTransportId.add(String(c.transport_order_id));
             }
             const orderNumber = c.transport_orders?.order_number || c.order_number || '';
             if (orderNumber) {
               containerReturnConfirmedByOrderNumber.add(orderNumber);
             }
           }
        });
      
       console.log('Freelance POD counts (history):', { byTransportId: podCountByTransportId, byOrderNumber: podCountByOrderNumber });
       console.log('Freelance container return confirmed (history):', { byTransportId: [...containerReturnConfirmedByTransportId], byOrderNumber: [...containerReturnConfirmedByOrderNumber] });

      // Helper: check if job is international
      const isInternationalJob = (job: any) => !!(job.booking_no || job.bl_no || (job.transport_category && job.transport_category !== 'domestic'));

      // Helper function to check if job has ALL PODs completed
      const isJobFullyCompleted = (job: any): boolean => {
        const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
          ? job.destinations.length 
          : 1; // Single destination if no array
        
        const podCount = Math.max(
          podCountByTransportId[String(job.id)] || 0,
          podCountByOrderNumber[job.order_number] || 0
        );
        
        const allPodsCompleted = podCount >= destinationCount;
        
        // For international jobs:
        // - Booking jobs: completed when container return is confirmed
        // - BL jobs: require all PODs + container return confirmed
        if (isInternationalJob(job)) {
          const hasContainerReturnConfirmed = containerReturnConfirmedByTransportId.has(String(job.id)) || 
            containerReturnConfirmedByOrderNumber.has(job.order_number);
          const isBookingJob = !!job.booking_no && !job.bl_no;
          return isBookingJob
            ? hasContainerReturnConfirmed
            : (allPodsCompleted && hasContainerReturnConfirmed);
        }
        
        return allPodsCompleted;
      };

      // Filter jobs that have ALL destinations POD completed (verified by checkins)
      const completedFromApi = allJobs
        .filter((job: any) => isJobFullyCompleted(job))
        .map((job: any) => ({ 
          ...job, 
          status: "completed",
          // Preserve origins/destinations arrays for multi-destination detection
          origins: job.origins,
          destinations: job.destinations,
          job_type: job.job_type || 'domestic',
          // Preserve international job identifiers
          booking_no: job.booking_no || null,
          bl_no: job.bl_no || null,
          transport_category: job.transport_category || null,
        }));

      // Process bid-won jobs from list-tickets API
      // Only show bid jobs that have ALL PODs completed
      let bidCompletedJobs: CompletedJob[] = [];
      if (bidWonJobsRes && bidWonJobsRes.data) {
        const bidData = bidWonJobsRes.data;
        console.log('Loaded bid-won jobs from API:', bidData);
        const tickets = bidData.data || bidData.tickets || [];
        
        // Filter tickets where current user has an accepted bid AND has ALL PODs completed
        bidCompletedJobs = tickets
          .filter((ticket: any) => {
            const ticketNumber = ticket.ticket_number || '';
            
            // Check if current user has an accepted bid on this ticket
            const userAcceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === freelanceDriverId
            );
            if (!userAcceptedBid) return false;
            
            // Check if all PODs are completed for this ticket
            const podCount = podCountByOrderNumber[ticketNumber] || 0;
            const destinationCount = Array.isArray(ticket.destinations) && ticket.destinations.length > 0
              ? ticket.destinations.length
              : 1;
            
            return podCount >= destinationCount;
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
              // Preserve origins/destinations arrays for multi-destination detection
              origins: ticket.origins,
              destinations: ticket.destinations,
              job_type: ticket.job_type || 'domestic',
              // International job identifiers (bid jobs)
              booking_no: ticket.booking_no || null,
              bl_no: ticket.bl_no || null,
              transport_category: ticket.transport_category || null,
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
  // Calculate 1-month cutoff date
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  oneMonthAgo.setHours(0, 0, 0, 0);

  const filterApplications = (apps: JobApplication[]) => {
    // First filter out applications with null jobs
    let filtered = apps.filter(app => app.jobs !== null);

    // Filter to last 1 month only
    filtered = filtered.filter(app => new Date(app.applied_at) >= oneMonthAgo);

    // Filter by tab
    if (activeTab === "completed") {
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

    // Filter to last 1 month by latest activity date (completion/update)
    filtered = filtered.filter(job => {
      const latestActivityDate = new Date(job.updated_at || job.sender_pickup_date || job.created_at);
      return !Number.isNaN(latestActivityDate.getTime()) && latestActivityDate >= oneMonthAgo;
    });

    // Filter by tab - completed tab shows all (since we only fetch completed/closed)

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
      <PullToRefresh onRefresh={async () => { await Promise.all([loadCompletedJobs(), loadJobHistory()]); }}>
      <Tabs value="all" className="w-full">

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
                {/* Domestic jobs section */}
                {(() => {
                  const domesticJobs = filteredCompletedJobs.filter(job => !job.booking_no && !job.bl_no && !job.transport_category);
                  const domesticApps = filteredApplications.filter(app => app.jobs && app.jobs.job_type !== 'international');
                  if (domesticJobs.length === 0 && domesticApps.length === 0) return null;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                          {t('jobType.domestic')}
                        </span>
                      </div>
                      {domesticJobs.map(job => (
                        <HistoryJobCard 
                          key={job.id}
                          job={job}
                          onClick={() => {
                            if (job.isBidJob && job.ticket_number) {
                              navigate(`/bid-job/${job.ticket_number}?from=history`, { state: { jobData: job } });
                            } else {
                              navigate(`/job/${job.order_number}?from=history`, { state: { jobData: job } });
                            }
                          }}
                          getTranslatedVehicleType={getTranslatedVehicleType}
                        />
                      ))}
                      {domesticApps.map(app => {
                        if (!app.jobs) return null;
                        return (
                          <HistoryJobCard 
                            key={app.id}
                            job={{
                              id: app.jobs.id,
                              order_number: app.jobs.order_code,
                              sender_name: app.jobs.destination_company_name || app.jobs.employer_name,
                              sender_pickup_date: app.jobs.start_date,
                              sender_pickup_time: app.jobs.start_time,
                              transport_price: app.jobs.price,
                              job_type: app.jobs.job_type,
                              status: app.status,
                            }}
                            onClick={() => navigate(`/job/${app.jobs!.id}`)}
                            getTranslatedVehicleType={getTranslatedVehicleType}
                          />
                        );
                      })}
                    </div>
                  );
                })()}

                {/* International jobs section */}
                {(() => {
                  const internationalJobs = filteredCompletedJobs.filter(job => !!(job.booking_no || job.bl_no || job.transport_category));
                  const internationalApps = filteredApplications.filter(app => app.jobs && app.jobs.job_type === 'international');
                  if (internationalJobs.length === 0 && internationalApps.length === 0) return null;
                  return (
                    <div className="space-y-3 mt-4">
                      {internationalJobs.map(job => (
                        <HistoryJobCard 
                          key={`intl-${job.id}`}
                          job={job}
                          onClick={() => {
                            if (job.isBidJob && job.ticket_number) {
                              navigate(`/bid-job/${job.ticket_number}?from=history`, { state: { jobData: job } });
                            } else {
                              navigate(`/job/${job.order_number}?from=history`, { state: { jobData: job } });
                            }
                          }}
                          getTranslatedVehicleType={getTranslatedVehicleType}
                        />
                      ))}
                      {internationalApps.map(app => {
                        if (!app.jobs) return null;
                        return (
                          <HistoryJobCard 
                            key={`intl-${app.id}`}
                            job={{
                              id: app.jobs.id,
                              order_number: app.jobs.order_code,
                              sender_name: app.jobs.destination_company_name || app.jobs.employer_name,
                              sender_pickup_date: app.jobs.start_date,
                              sender_pickup_time: app.jobs.start_time,
                              transport_price: app.jobs.price,
                              job_type: app.jobs.job_type,
                              status: app.status,
                            }}
                            onClick={() => navigate(`/job/${app.jobs!.id}`)}
                            getTranslatedVehicleType={getTranslatedVehicleType}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </PullToRefresh>
    </div>;
}