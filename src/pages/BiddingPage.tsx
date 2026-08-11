import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Search,
  Filter,
  Clock,
  MapPin,
  CircleDot,
  X,
  CalendarIcon,
  Calendar as CalendarIconLucide,
  CheckSquare,
  Square,
} from "lucide-react";
import coinsIcon from "@/assets/coins-icon.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerFooter } from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDate as formatThaiDate } from "@/lib/dateUtils";
import { MultiBidPaymentModal } from "@/components/bidding/MultiBidPaymentModal";
import { listTickets } from "@/lib/externalApi";
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import type { Database } from "@/integrations/supabase/types";

type BiddingJob = Database["public"]["Tables"]["jobs"]["Row"];
type JobBid = Database["public"]["Tables"]["job_bids"]["Row"];

interface Bid extends JobBid {
  jobs: BiddingJob;
}

// Interface for external API ticket response
interface ExternalTicketRoute {
  id: string;
  route_code: string;
  is_multi_destination: boolean;
  origin_district: {
    id: string;
    name: string;
    district_code: string;
    province: {
      id: string;
      name: string;
      province_code: string;
    };
  } | null;
  destination_district: {
    id: string;
    name: string;
    district_code: string;
    province: {
      id: string;
      name: string;
      province_code: string;
    };
  } | null;
}

interface ExternalTicketUser {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ExternalTicket {
  id: string;
  ticket_number: string;
  status: string;
  product: string;
  weight_tons: number;
  trips_per_month: number;
  price: number | null;
  price_hint: number | null; // Fee to reveal market_price
  market_price: number | null; // The middle/market price (revealed after paying hint)
  price_unit: string;
  price_type: string;
  distance_km: number;
  notes: string | null;
  company_name?: string;
  employer_name?: string;
  customer?: ExternalTicketUser;
  creator?: ExternalTicketUser;
  created_at: string;
  updated_at: string;
  vehicle_type: {
    id: string;
    name: string;
    vehicle_code: string;
  };
  route: ExternalTicketRoute;
  bids: {
    id: string;
    status: string;
    bid_price: number;
    created_at: string;
    updated_at: string;
    contractor_id: string;
    contractor?: {
      id: string;
      full_name: string;
      company_name: string | null;
      email: string | null;
      phone: string | null;
      user_type: string;
    };
  }[];
}

export default function BiddingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [availableJobs, setAvailableJobs] = useState<BiddingJob[]>([]);
  const [rawTickets, setRawTickets] = useState<ExternalTicket[]>([]);
  const [acceptedTickets, setAcceptedTickets] = useState<ExternalTicket[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [activeTab, setActiveTab] = useState("bidding");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Multi-select state - always enabled like shopping cart
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Filter states for bidding tab
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Month value to month index mapping
  const monthMap: { [key: string]: number } = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };

  const transformTicketToJob = (ticket: ExternalTicket): BiddingJob => {
    // Build origin location string
    const originDistrict = ticket.route?.origin_district;
    const originLocation = originDistrict
      ? `${originDistrict.name}, ${originDistrict.province?.name || ''}`
      : '';

    // Build destination location string
    const destDistrict = ticket.route?.destination_district;
    const destinationLocation = ticket.route?.is_multi_destination
      ? 'หลายจุดหมาย'
      : destDistrict
        ? `${destDistrict.name}, ${destDistrict.province?.name || ''}`
        : '';

    // API doesn't provide specific date - leave as empty string to indicate no data
    const startDate = '';

    // Get employer name from customer or creator
    const employerName = 
      ticket.customer?.company_name || 
      ticket.creator?.company_name || 
      ticket.customer?.full_name ||
      ticket.creator?.full_name ||
      ticket.company_name || 
      ticket.employer_name || 
      'ไม่ระบุผู้จ้าง';

    return {
      id: ticket.id,
      order_code: ticket.ticket_number || '',
      employer_name: employerName,
      origin_location: originLocation,
      destination_location: destinationLocation,
      origin_company_name: null,
      destination_company_name: null,
      origin_goods_type: ticket.product || null,
      equipment_list: ticket.vehicle_type?.name || null,
      safety_equipment: ticket.notes || null,
      transport_type: ticket.route?.is_multi_destination ? 'ขนส่งหลายที่' : 'ขนส่งเที่ยวเดียว',
      job_type: 'งานประมูล',
      price: ticket.price || 0,
      start_date: startDate,
      start_time: '',
      status: 'open_for_bidding',
      created_at: ticket.created_at || new Date().toISOString(),
      updated_at: ticket.updated_at || new Date().toISOString(),
      assigned_role: null,
      container_checkpoint: null,
      container_checkpoint_code: null,
      container_checkpoint_latitude: null,
      container_checkpoint_longitude: null,
      container_number: null,
      container_number_2: null,
      destination_address: null,
      destination_bill_of_lading: null,
      destination_contact_person: null,
      destination_date: null,
      destination_goods_quantity: `${ticket.weight_tons || 0} ตัน`,
      destination_goods_type: ticket.product || null,
      destination_latitude: null,
      destination_longitude: null,
      destination_remarks: null,
      destination_time: null,
      district: originDistrict?.name || null,
      empty_container_date: null,
      origin_address: null,
      origin_bill_of_lading: null,
      origin_contact_person: null,
      origin_contact_role: null,
      origin_goods_quantity: `${ticket.weight_tons || 0} ตัน`,
      origin_latitude: null,
      origin_longitude: null,
      origin_remarks: null,
      province: originDistrict?.province?.name || null,
      return_full_container_date: null,
      return_full_container_location: null,
      seal_number: null,
      seal_number_2: null,
      shipper_load: null,
      tax_id: null,
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadAvailableJobs(), loadAcceptedJobs()]);
      setIsLoading(false);
    };

    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  // Load bids after rawTickets or acceptedTickets are loaded
  useEffect(() => {
    if (user && (rawTickets.length > 0 || acceptedTickets.length > 0)) {
      loadMyBids();
    }
  }, [user, rawTickets, acceptedTickets]);

  const loadAvailableJobs = async () => {
    try {
      // Fetch from external API with correct filters
      const { data, error } = await listTickets({
        status: 'active',
        createdByRole: 'trucking_company',
        limit: 10,
      });

      if (error) {
        console.error('Error fetching tickets from API:', error);
        // Fallback to local database
        const { data: localData, error: localError } = await supabase
          .from("jobs")
          .select("*")
          .eq("status", "open_for_bidding")
          .order("created_at", { ascending: false });

        if (!localError && localData) {
          setAvailableJobs(localData);
          setRawTickets([]);
        }
        return;
      }

      // Get tickets array from response
      let ticketsData: ExternalTicket[] = [];
      if (data && Array.isArray(data)) {
        ticketsData = data;
      } else if (data && (data as any).data && Array.isArray((data as any).data)) {
        ticketsData = (data as any).data;
      } else if (data && (data as any).tickets && Array.isArray((data as any).tickets)) {
        ticketsData = (data as any).tickets;
      }

      // Store raw tickets for bid extraction
      setRawTickets(ticketsData);

      // Transform to jobs
      const transformedJobs: BiddingJob[] = ticketsData.map((ticket: ExternalTicket) => transformTicketToJob(ticket));
      setAvailableJobs(transformedJobs);
      
      console.log('Loaded tickets:', ticketsData.length);
    } catch (err) {
      console.error('Error in loadAvailableJobs:', err);
      // Fallback to local database
      const { data: localData, error: localError } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "open_for_bidding")
        .order("created_at", { ascending: false });

      if (!localError && localData) {
        setAvailableJobs(localData);
        setRawTickets([]);
      }
    }
  };

  const loadAcceptedJobs = async () => {
    try {
      // Fetch accepted/completed jobs via external API directly
      const { data: responseData, error } = await listTickets({ bidsStatus: 'accepted' });

      if (error) {
        console.error('Error fetching accepted tickets:', error);
        return;
      }

      // Get tickets array from response
      let ticketsData: ExternalTicket[] = [];
      if (responseData && Array.isArray(responseData)) {
        ticketsData = responseData;
      } else if (responseData && (responseData as any).data && Array.isArray((responseData as any).data)) {
        ticketsData = (responseData as any).data;
      } else if (responseData && (responseData as any).tickets && Array.isArray((responseData as any).tickets)) {
        ticketsData = (responseData as any).tickets;
      }

      console.log('Loaded accepted tickets:', ticketsData.length);
      setAcceptedTickets(ticketsData);
    } catch (err) {
      console.error('Error in loadAcceptedJobs:', err);
    }
  };

  const loadMyBids = () => {
    if (!user) {
      return;
    }

    // Extract bids that belong to the current user from all tickets
    const userBids: Bid[] = [];
    const processedBidIds = new Set<string>();

    // Process raw tickets (pending bids)
    rawTickets.forEach((ticket) => {
      if (ticket.bids && Array.isArray(ticket.bids)) {
        ticket.bids.forEach((bid) => {
          if (bid.contractor_id === user.id && !processedBidIds.has(bid.id)) {
            processedBidIds.add(bid.id);
            const jobData: BiddingJob = transformTicketToJob(ticket);
            
            userBids.push({
              id: bid.id,
              job_id: ticket.id,
              driver_id: user.id,
              bid_amount: bid.bid_price,
              status: bid.status || 'pending',
              created_at: bid.created_at,
              updated_at: bid.updated_at,
              jobs: jobData
            } as Bid);
          }
        });
      }
    });

    // Process accepted tickets (completed/won bids)
    acceptedTickets.forEach((ticket) => {
      if (ticket.bids && Array.isArray(ticket.bids)) {
        ticket.bids.forEach((bid) => {
          if (bid.contractor_id === user.id && !processedBidIds.has(bid.id)) {
            processedBidIds.add(bid.id);
            const jobData: BiddingJob = transformTicketToJob(ticket);
            
            userBids.push({
              id: bid.id,
              job_id: ticket.id,
              driver_id: user.id,
              bid_amount: bid.bid_price,
              status: bid.status || 'accepted',
              created_at: bid.created_at,
              updated_at: bid.updated_at,
              jobs: jobData
            } as Bid);
          }
        });
      }
    });

    console.log('User bids found:', userBids.length);
    setMyBids(userBids);
  };

  const handlePlaceBid = (jobId: string) => {
    navigate(`/bidding/${jobId}`);
  };

  const handleApplyFilter = () => {
    setFilterOpen(false);
  };

  const handleResetFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const clearSelection = () => {
    setSelectedJobIds(new Set());
  };

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const selectAllJobs = () => {
    const allIds = new Set(filteredAvailableJobs.map((job) => job.id));
    setSelectedJobIds(allIds);
  };

  const deselectAllJobs = () => {
    setSelectedJobIds(new Set());
  };

  const handleMultiBid = () => {
    if (selectedJobIds.size === 0) {
      toast({
        title: t("bidding.noJobsSelected"),
        description: t("bidding.pleaseSelectJobs"),
        variant: "destructive",
      });
      return;
    }
    setShowPaymentModal(true);
  };

  const handleMultiBidSuccess = () => {
    setSelectedJobIds(new Set());
    loadAvailableJobs();
  };

  const getBidStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; className: string } } = {
      pending: {
        label: t("bidding.statusPending"),
        className: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
      },
      accepted: {
        label: t("bidding.statusAccepted"),
        className: "bg-green-50 text-green-700 hover:bg-green-100",
      },
      won: {
        label: t("bidding.statusWon") || "ชนะประมูล",
        className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      },
      completed: {
        label: t("bidding.statusCompleted") || "เสร็จสิ้น",
        className: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      },
      rejected: {
        label: t("bidding.statusRejected"),
        className: "bg-red-50 text-red-700 hover:bg-red-100",
      },
      lost: {
        label: t("bidding.statusLost") || "แพ้ประมูล",
        className: "bg-gray-50 text-gray-700 hover:bg-gray-100",
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant="secondary" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Get set of job IDs that user has already bid on
  const biddedJobIds = new Set(myBids.map((bid) => bid.job_id));

  // Filter available jobs (exclude jobs user has already bid on)
  const filteredAvailableJobs = availableJobs.filter((job) => {
    // Exclude jobs that user has already bid on
    if (biddedJobIds.has(job.id)) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        job.order_code.toLowerCase().includes(query) ||
        job.employer_name.toLowerCase().includes(query) ||
        (job.destination_company_name && job.destination_company_name.toLowerCase().includes(query)) ||
        job.origin_location.toLowerCase().includes(query) ||
        job.destination_location.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

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

  // Filter my bids by month
  const filteredBids = myBids.filter((bid) => {
    if (!bid.jobs) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        bid.jobs.order_code.toLowerCase().includes(query) ||
        bid.jobs.employer_name.toLowerCase().includes(query) ||
        (bid.jobs.destination_company_name && bid.jobs.destination_company_name.toLowerCase().includes(query)) ||
        bid.jobs.origin_location.toLowerCase().includes(query) ||
        bid.jobs.destination_location.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Month filter
    if (selectedMonth !== "all") {
      const bidMonth = new Date(bid.created_at).getMonth();
      if (bidMonth !== monthMap[selectedMonth]) return false;
    }
    return true;
  });

  // Group bids by month
  const groupBidsByMonth = () => {
    const grouped: { [key: string]: Bid[] } = {};
    filteredBids.forEach((bid) => {
      const monthName = new Date(bid.created_at).toLocaleDateString(language === "th" ? "th-TH" : "en-US", {
        month: "long",
      });
      if (!grouped[monthName]) {
        grouped[monthName] = [];
      }
      grouped[monthName].push(bid);
    });
    return grouped;
  };

  const groupedBids = groupBidsByMonth();

  // Get selected jobs data for modal - include price_hint and market_price from raw tickets
  const selectedJobsData = availableJobs
    .filter((job) => selectedJobIds.has(job.id))
    .map((job) => {
      // Find the raw ticket to get price_hint and market_price
      const rawTicket = rawTickets.find(t => t.id === job.id);
      return {
        id: job.id,
        order_code: job.order_code,
        employer_name: job.employer_name,
        origin_location: job.origin_location,
        destination_location: job.destination_location,
        price: job.price,
        price_hint: rawTicket?.price_hint ?? null,
        market_price: rawTicket?.market_price ?? null,
      };
    });

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4">
        <MapPin className="w-16 h-16 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-center">
        {activeTab === "bidding" ? t("bidding.noJobs") : t("bidding.noHistory")}
      </p>
    </div>
  );

  const renderJobCard = (job: BiddingJob, bidAmount?: number, bidStatus?: string, bidCreatedAt?: string, disableSelection?: boolean) => {
    const isSelected = selectedJobIds.has(job.id);
    const isClickable = !disableSelection;
    
    return (
      <Card 
        key={job.id} 
        className={cn(
          "overflow-hidden bg-card transition-all",
          isClickable && "cursor-pointer",
          isSelected && !disableSelection && "ring-2 ring-primary"
        )}
        onClick={isClickable ? () => toggleJobSelection(job.id) : undefined}
      >
        <div className="flex items-center justify-between bg-white">
          <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl text-[#30503b]">
            {t("job.order_code")} {job.order_code}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pr-3">
            <Clock className="w-3.5 h-3.5" />
            {job.created_at 
              ? formatThaiDate(job.created_at.split('T')[0], language)
              : t('common.noData') || 'ไม่มีข้อมูล'}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">{t("job.employer")} : </span>
            <span className="font-medium">{job.employer_name}</span>
          </div>
          <div className="flex items-center gap-2">
            {(job.transport_type?.includes("เที่ยวเดียว") || job.transport_type?.includes("หลายที่")) && (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                {t("job.domestic")}
              </Badge>
            )}
            {(job.transport_type?.includes("ขาเข้า") || job.transport_type?.includes("ขาออก")) && (
              <>
                <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                  {t("job.international")}
                </Badge>
                {job.transport_type?.includes("ขาเข้า") && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                    {t("job.inbound")}
                  </Badge>
                )}
                {job.transport_type?.includes("ขาออก") && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                    {t("job.outbound")}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="text-sm text-muted-foreground">{job.transport_type}</div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 flex gap-2">
              <div className="flex flex-col items-center">
                <CircleDot className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="w-0.5 flex-1 border-l-2 border-dashed border-gray-300 my-1"></div>
                <MapPin className="w-4 h-4 text-red-600 flex-shrink-0" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">{t("job.origin")}</div>
                  <div className="font-medium">{job.origin_location}</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">{t("job.destination")}</div>
                  <div className="font-medium">{job.destination_location}</div>
                </div>
              </div>
            </div>

            <div className="text-right space-y-2">
              {bidAmount !== undefined ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                  <img src={coinsIcon} alt="coins" className="w-5 h-5" />
                  <span className="text-lg font-bold text-teal-500">฿ {bidAmount.toLocaleString()}</span>
                </div>
              ) : null}
              {/* Start date hidden - API data not available yet */}
              {/* <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
                <CalendarIconLucide className="w-4 h-4 text-gray-500" />
                <div className="text-left">
                  <div className="text-xs text-[#375B7B]">{t("currentJobs.startJobDate")}</div>
                  <div className="text-xs font-medium">
                    {formatThaiDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
                  </div>
                </div>
              </div> */}
            </div>
          </div>

          <div className="rounded-lg p-3 space-y-1.5 text-xs bg-[#e6f8ff]">
            <div>
              <span className="text-[#375c7b]">{t("job.goodsType")} : </span>
              <span>{job.origin_goods_type || "-"}</span>
            </div>
            <div>
              <span className="text-[#375B7B]">{t("job.requiredTruck")} : </span>
              <span>{job.equipment_list || "-"}</span>
            </div>
          </div>

          {bidStatus && bidCreatedAt && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {t("bidding.bidAt")}{" "}
                {new Date(bidCreatedAt).toLocaleString(language === "th" ? "th-TH" : "en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {getBidStatusBadge(bidStatus)}
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate("/home")} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t("bidding.title")}</h1>
        </div>
      </header>

      {/* Tabs */}
      <PullToRefresh onRefresh={async () => { await Promise.all([loadAvailableJobs(), loadAcceptedJobs()]); }}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b bg-white">
          <TabsTrigger value="bidding" className="rounded-none">
            {t("bidding.biddingTab")}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none">
            {t("bidding.historyTab")}
          </TabsTrigger>
        </TabsList>

        {/* Bidding Tab */}
        <TabsContent value="bidding" className="mt-0">
          {/* Search and Filter Bar */}
          <div className="bg-[#FAFAFF] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={t("currentJobs.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-white"
                />
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setFilterOpen(true)}>
                <Filter className="w-4 h-4" />
              </Button>
            </div>

            {/* Selection Controls */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckSquare className="w-4 h-4" />
                <span>{t("bidding.selectedJobs")}: <span className="font-semibold text-foreground">{selectedJobIds.size}</span></span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllJobs}>
                  {t("bidding.selectAll")}
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllJobs}>
                  {t("bidding.deselectAll")}
                </Button>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            {authLoading || isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAvailableJobs.length === 0 ? (
              <EmptyState />
            ) : (
              filteredAvailableJobs.map((job) => renderJobCard(job))
            )}
          </div>

        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-0 px-4 py-4">
          {/* Month Filter */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder={t("income.selectMonth")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("jobHistory.allMonths")}</SelectItem>
              <SelectItem value="jan">{t("jobHistory.january")}</SelectItem>
              <SelectItem value="feb">{t("jobHistory.february")}</SelectItem>
              <SelectItem value="mar">{t("jobHistory.march")}</SelectItem>
              <SelectItem value="apr">{t("jobHistory.april")}</SelectItem>
              <SelectItem value="may">{t("jobHistory.may")}</SelectItem>
              <SelectItem value="jun">{t("jobHistory.june")}</SelectItem>
              <SelectItem value="jul">{t("jobHistory.july")}</SelectItem>
              <SelectItem value="aug">{t("jobHistory.august")}</SelectItem>
              <SelectItem value="sep">{t("jobHistory.september")}</SelectItem>
              <SelectItem value="oct">{t("jobHistory.october")}</SelectItem>
              <SelectItem value="nov">{t("jobHistory.november")}</SelectItem>
              <SelectItem value="dec">{t("jobHistory.december")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Grouped Bids by Month */}
          {Object.keys(groupedBids).length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedBids).map(([month, bids]) => (
                <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  <div className="space-y-4">
                    {bids.map((bid) => renderJobCard(bid.jobs, bid.bid_amount, bid.status, bid.created_at, true))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </PullToRefresh>

      {/* Filter Drawer for Bidding Tab */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle>{t("currentJobs.filter")}</DrawerTitle>
              <DrawerClose>
                <X className="w-5 h-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-4 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t("currentJobs.dateRange")}</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal h-11",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : t("currentJobs.startDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <span className="text-muted-foreground">—</span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal h-11",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : t("currentJobs.endDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleResetFilter}>
                {t("currentJobs.clearFilter")}
              </Button>
              <Button onClick={handleApplyFilter}>{t("currentJobs.applyFilter")}</Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Floating Action Panel for Payment - Rendered via Portal */}
      {selectedJobIds.size > 0 && !showPaymentModal && activeTab === "bidding" && createPortal(
        <div 
          className="fixed bottom-24 left-4 right-7 z-[99999] bg-background rounded-lg shadow-xl border p-3"
          style={{
            animation: 'slideUpBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
          }}
        >
          {selectedJobIds.size === 1 ? (
            <Button 
              className="w-full h-10 text-sm font-semibold"
              onClick={handleMultiBid}
            >
              {t("bidding.placeBid")}
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground">{t("bidding.selectedJobs")}</p>
                  <p className="text-sm font-bold">{selectedJobIds.size} {t("bidding.jobs")}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 text-right">
                  <p className="text-xs text-muted-foreground">{t("bidding.totalDeposit")}</p>
                  <p className="text-sm font-bold text-primary">฿{(selectedJobIds.size * 100).toLocaleString()}</p>
                </div>
              </div>
              <Button 
                className="w-full h-10 text-sm font-semibold"
                onClick={handleMultiBid}
              >
                {t("bidding.proceedToPayment")}
              </Button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Multi-Bid Payment Modal */}
      <MultiBidPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        selectedJobs={selectedJobsData}
        onSuccess={handleMultiBidSuccess}
      />
    </div>
  );
}
