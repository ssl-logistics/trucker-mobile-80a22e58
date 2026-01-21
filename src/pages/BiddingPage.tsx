import { useState, useEffect } from "react";
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
import type { Database } from "@/integrations/supabase/types";

type BiddingJob = Database["public"]["Tables"]["jobs"]["Row"];
type JobBid = Database["public"]["Tables"]["job_bids"]["Row"];

interface Bid extends JobBid {
  jobs: BiddingJob;
}

// Interface for external API ticket response
interface ExternalTicket {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  destination_location: string;
  origin_company_name?: string;
  destination_company_name?: string;
  origin_goods_type?: string;
  equipment_list?: string;
  safety_equipment?: string;
  transport_type: string;
  job_type: string;
  price: number;
  start_date: string;
  start_time: string;
  status: string;
  created_at: string;
}

export default function BiddingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const [availableJobs, setAvailableJobs] = useState<BiddingJob[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [activeTab, setActiveTab] = useState("bidding");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await loadAvailableJobs();
      if (user) {
        await loadMyBids();
      }
      setIsLoading(false);
    };

    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading]);

  const loadAvailableJobs = async () => {
    try {
      // Fetch from external API via edge function
      const { data, error } = await supabase.functions.invoke('list-tickets', {
        body: null,
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
        }
        return;
      }

      // Transform external API data to match BiddingJob format
      if (data && Array.isArray(data)) {
        const transformedJobs: BiddingJob[] = data.map((ticket: ExternalTicket) => ({
          id: ticket.id,
          order_code: ticket.order_code || '',
          employer_name: ticket.employer_name || '',
          origin_location: ticket.origin_location || '',
          destination_location: ticket.destination_location || '',
          origin_company_name: ticket.origin_company_name || null,
          destination_company_name: ticket.destination_company_name || null,
          origin_goods_type: ticket.origin_goods_type || null,
          equipment_list: ticket.equipment_list || null,
          safety_equipment: ticket.safety_equipment || null,
          transport_type: ticket.transport_type || '',
          job_type: ticket.job_type || '',
          price: ticket.price || 0,
          start_date: ticket.start_date || '',
          start_time: ticket.start_time || '00:00',
          status: ticket.status || 'open_for_bidding',
          created_at: ticket.created_at || new Date().toISOString(),
          updated_at: ticket.created_at || new Date().toISOString(),
          // Optional fields with defaults
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
          destination_goods_quantity: null,
          destination_goods_type: null,
          destination_latitude: null,
          destination_longitude: null,
          destination_remarks: null,
          destination_time: null,
          district: null,
          empty_container_date: null,
          origin_address: null,
          origin_bill_of_lading: null,
          origin_contact_person: null,
          origin_contact_role: null,
          origin_goods_quantity: null,
          origin_latitude: null,
          origin_longitude: null,
          origin_remarks: null,
          province: null,
          return_full_container_date: null,
          return_full_container_location: null,
          seal_number: null,
          seal_number_2: null,
          shipper_load: null,
          tax_id: null,
        }));
        setAvailableJobs(transformedJobs);
      } else if (data && data.tickets && Array.isArray(data.tickets)) {
        // Handle if response is wrapped in { tickets: [...] }
        const transformedJobs: BiddingJob[] = data.tickets.map((ticket: ExternalTicket) => ({
          id: ticket.id,
          order_code: ticket.order_code || '',
          employer_name: ticket.employer_name || '',
          origin_location: ticket.origin_location || '',
          destination_location: ticket.destination_location || '',
          origin_company_name: ticket.origin_company_name || null,
          destination_company_name: ticket.destination_company_name || null,
          origin_goods_type: ticket.origin_goods_type || null,
          equipment_list: ticket.equipment_list || null,
          safety_equipment: ticket.safety_equipment || null,
          transport_type: ticket.transport_type || '',
          job_type: ticket.job_type || '',
          price: ticket.price || 0,
          start_date: ticket.start_date || '',
          start_time: ticket.start_time || '00:00',
          status: ticket.status || 'open_for_bidding',
          created_at: ticket.created_at || new Date().toISOString(),
          updated_at: ticket.created_at || new Date().toISOString(),
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
          destination_goods_quantity: null,
          destination_goods_type: null,
          destination_latitude: null,
          destination_longitude: null,
          destination_remarks: null,
          destination_time: null,
          district: null,
          empty_container_date: null,
          origin_address: null,
          origin_bill_of_lading: null,
          origin_contact_person: null,
          origin_contact_role: null,
          origin_goods_quantity: null,
          origin_latitude: null,
          origin_longitude: null,
          origin_remarks: null,
          province: null,
          return_full_container_date: null,
          return_full_container_location: null,
          seal_number: null,
          seal_number_2: null,
          shipper_load: null,
          tax_id: null,
        }));
        setAvailableJobs(transformedJobs);
      } else {
        console.log('No tickets data in response:', data);
        setAvailableJobs([]);
      }
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
      }
    }
  };

  const loadMyBids = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("job_bids")
      .select("*, jobs(*)")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMyBids(data as Bid[]);
    }
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

  const getBidStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: t("bidding.statusPending"),
        className: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
      },
      accepted: {
        label: t("bidding.statusAccepted"),
        className: "bg-green-50 text-green-700 hover:bg-green-100",
      },
      rejected: {
        label: t("bidding.statusRejected"),
        className: "bg-red-50 text-red-700 hover:bg-red-100",
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge variant="secondary" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // Filter available jobs
  const filteredAvailableJobs = availableJobs.filter((job) => {
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

  const renderJobCard = (job: BiddingJob, bidAmount?: number, bidStatus?: string, bidCreatedAt?: string) => (
    <Card key={job.id} className="overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 bg-white">
        <div className="bg-[#E0FFEA] text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-[#30503b]">
          {t("job.order_code")} {job.order_code}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {formatThaiDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100">
              <CalendarIconLucide className="w-4 h-4 text-gray-500" />
              <div className="text-left">
                <div className="text-xs text-[#375B7B]">{t("currentJobs.startJobDate")}</div>
                <div className="text-xs font-medium">
                  {formatThaiDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-3 space-y-1.5 text-xs bg-[#e6f8ff]">
          <div>
            <span className="text-[#375c7b]">{t("job.goodsType")} : </span>
            <span>{job.origin_goods_type || "-"}</span>
          </div>
          <div>
            <span className="text-[#375B7B]">{t("job.equipment")} : </span>
            <span>{job.equipment_list || "-"}</span>
          </div>
          <div>
            <span className="text-[#375B7B]">{t("job.safety")} : </span>
            <span>{job.safety_equipment || "-"}</span>
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

        {!bidAmount && (
          <Button className="w-full h-11 text-base font-medium" onClick={() => handlePlaceBid(job.id)}>
            {t("bidding.placeBid")}
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground sticky top-0 z-50 rounded-b-xl page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate("/home")} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t("bidding.title")}</h1>
        </div>
      </header>

      {/* Tabs */}
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
                    {bids.map((bid) => renderJobCard(bid.jobs, bid.bid_amount, bid.status, bid.created_at))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
