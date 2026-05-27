import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Wallet, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { getDriverCheckins, getDriverAssignedJobs, getFreelanceAcceptedJobs, getFactoryAssignedJobs } from '@/lib/externalApi';
import { buildCheckinMaps, isJobFullyCompleted, isInternationalJob } from '@/utils/jobCompletionFilter';
interface CompletedJob {
  id: string;
  order_number: string;
  sender_name: string;
  destination_company_name: string | null;
  transport_price: number;
  sender_pickup_date: string;
  status: string;
}

interface IncomeJob {
  id: string;
  jobId: string;
  jobTitle: string;
  employer: string;
  amount: number;
  status: "paid" | "pending";
  date: string;
  rawDate: string;
  month: string;
  orderCode: string;
  // Flag for bid jobs
  isBidJob?: boolean;
  ticketNumber?: string;
}

const monthMap: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const filterBySelectedMonth = (jobs: IncomeJob[], selected: string): IncomeJob[] => {
  if (selected === 'all') return jobs;
  const monthIndex = monthMap[selected];
  if (monthIndex === undefined) return jobs;
  return jobs.filter(job => {
    const d = new Date(job.rawDate);
    return !isNaN(d.getTime()) && d.getMonth() === monthIndex;
  });
};

export default function IncomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver, canViewPrice } = useUserRole();
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [paidJobs, setPaidJobs] = useState<IncomeJob[]>([]);
  const [unpaidJobs, setUnpaidJobs] = useState<IncomeJob[]>([]);

  useEffect(() => {
    if (user) {
      loadIncomeData();
    }
  }, [user, isInternalDriver, isExternalDriver]);

  const loadIncomeData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const driverId = user.id;

      // For Internal/External drivers, use get-driver-assigned-jobs API
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        
        // Single API call with comma-separated statuses (instead of N parallel calls)
        const statuses = ['in_progress', 'in_transit', 'delivered', 'completed'];
        const [checkinsResult, jobsResult] = await Promise.all([
          getDriverCheckins(driverId, driverType, 'all'),
          getDriverAssignedJobs(driverId, driverType, 1000, statuses.join(',')),
        ]);

        // Deduplicate jobs by id (single response, but keep guard)
        const allJobsRaw: any[] = [];
        const seenIds = new Set<string>();
        const jobs = (jobsResult.data as any)?.data || [];
        jobs.forEach((job: any) => {
          const id = String(job.id);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            allJobsRaw.push(job);
          }
        });

        const allJobs = allJobsRaw;
        const allCheckinsRaw = checkinsResult.error
          ? []
          : ((checkinsResult.data as any)?.data || checkinsResult.data || []);
        const allCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

        // Use shared filtering utility (same as history page)
        const dtType = isInternalDriver ? 'internal' as const : 'external' as const;
        const maps = buildCheckinMaps(allCheckins, driverId, dtType);

        console.log('[Income] All jobs count:', allJobs.length);
        console.log('[Income] All checkins count:', allCheckins.length);
        console.log('[Income] POD counts by transportId:', maps.podCountByTransportId);
        console.log('[Income] POD counts by orderNumber:', maps.podCountByOrderNumber);
        console.log('[Income] Container return confirmed:', [...maps.containerReturnConfirmedByTransportId]);

        // Only show completed jobs (same filtering as history page)
        const paid: IncomeJob[] = [];
        
        allJobs.forEach((job: any) => {
          const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
            ? job.destinations.length : 1;
          const podByTid = maps.podCountByTransportId[String(job.id)] || 0;
          const podByOn = maps.podCountByOrderNumber[job.order_number] || 0;
          console.log(`[Income] CHECK job ${job.order_number}: id=${job.id}, destinations=${destinationCount}, podByTransportId=${podByTid}, podByOrderNumber=${podByOn}, isIntl=${isInternationalJob(job)}`);
          
          const completed = isJobFullyCompleted(job, maps);
          
          if (!completed) {
            const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0 
              ? job.destinations.length : 1;
            const podCount = Math.max(
              maps.podCountByTransportId[String(job.id)] || 0,
              maps.podCountByOrderNumber[job.order_number] || 0
            );
            if (isInternationalJob(job)) {
              const hasReturn = maps.containerReturnConfirmedByTransportId.has(String(job.id)) ||
                maps.containerReturnConfirmedByOrderNumber.has(job.order_number);
              console.log(`[Income] SKIP international job ${job.order_number}: pods=${podCount}/${destinationCount}, containerReturn=${hasReturn}`);
            } else {
              console.log(`[Income] SKIP domestic job ${job.order_number}: pods=${podCount}/${destinationCount}`);
            }
            return;
          }
          
          console.log(`[Income] PASS job ${job.order_number}: date=${job.sender_pickup_date}`);
          
          paid.push({
            id: job.id,
            jobId: job.order_number,
            jobTitle: job.destination_company_name || job.factory_name || job.sender_name,
            employer: job.factory_name || job.sender_name,
            amount: job.transport_price || 0,
            status: "paid",
            date: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US'),
            rawDate: job.sender_pickup_date,
            month: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
              month: "long"
            }),
            orderCode: job.order_number
          });
        });

        console.log('[Income] Total completed:', paid.length, 'Order numbers:', paid.map(j => j.orderCode));
        setPaidJobs(paid);
        setUnpaidJobs([]);
        setLoading(false);
        return;
      }

      // For Freelance drivers: Fetch company jobs, factory jobs, checkins, and bid-won jobs in parallel
      const [companyJobsResult, factoryJobsResult, checkinsResult, bidWonJobsRes] = await Promise.all([
        getFreelanceAcceptedJobs(user.id, 1000),
        getFactoryAssignedJobs(user.id, 1000),
        getDriverCheckins(user.id, 'freelance', 'all'),
        // Fetch bid-won jobs from list-tickets API
        supabase.functions.invoke('list-tickets', {
          body: {
            freelance_driver_id: user.id,
            bids_status: 'accepted',
          },
        }).catch(() => null),
      ]);

      if (companyJobsResult.error) {
        console.error('Failed to fetch company jobs:', companyJobsResult.error);
      }

      const checkinsJson = checkinsResult.error ? null : checkinsResult.data;

      // Get company jobs
      const companyJobs: CompletedJob[] = (companyJobsResult.data as any)?.data || companyJobsResult.data || [];

      // Get factory jobs - only those that have been accepted
      const allFactoryJobs = (factoryJobsResult.data as any)?.data || factoryJobsResult.data || [];
      const acceptedFactoryJobs: CompletedJob[] = allFactoryJobs
        .filter((job: any) => job.freelance_accepted_at)
        .map((job: any) => ({
          id: job.id,
          order_number: job.order_number || job.job_order_number,
          sender_name: job.factory_name || job.sender_name,
          destination_company_name: job.destination_company_name,
          transport_price: job.transport_price || 0,
          sender_pickup_date: job.sender_pickup_date || job.pickup_date,
          status: job.status || 'accepted',
        }));

      // Combine company and factory jobs
      const allJobs = [...companyJobs, ...acceptedFactoryJobs];

      const allCheckins = checkinsJson?.data || checkinsJson || [];
      const checkins = Array.isArray(allCheckins) ? allCheckins : [];

      // Use shared filtering utility
      const freelanceMaps = buildCheckinMaps(checkins, user.id, 'freelance');

      console.log('Confirmed order numbers for bid jobs:', Object.keys(freelanceMaps.podCountByOrderNumber));

      // Process bid-won jobs - only show completed ones (same as history)
      let bidJobs: IncomeJob[] = [];
      if (bidWonJobsRes && bidWonJobsRes.data) {
        const bidData = bidWonJobsRes.data;
        const tickets = bidData.data || bidData.tickets || [];
        
        bidJobs = tickets
          .filter((ticket: any) => {
            const userAcceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === user.id
            );
            if (!userAcceptedBid) return false;
            
            // Only show if all PODs completed (same as history)
            const ticketNumber = ticket.ticket_number;
            const podCount = freelanceMaps.podCountByOrderNumber[ticketNumber] || 0;
            const destinationCount = Array.isArray(ticket.destinations) && ticket.destinations.length > 0
              ? ticket.destinations.length
              : 1;
            return podCount >= destinationCount;
          })
          .map((ticket: any) => {
            const customer = ticket.customer || {};
            const creator = ticket.creator || {};
            const employerName = customer.company_name || customer.full_name || creator.company_name || creator.full_name || '';
            
            const acceptedBid = ticket.bids?.find((b: any) => 
              b.status === 'accepted' && b.contractor_id === user.id
            );
            const bidPrice = acceptedBid?.bid_price || ticket.price || 0;
            const pickupDate = ticket.pickup_date || ticket.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
            
            return {
              id: ticket.id,
              jobId: ticket.ticket_number,
              jobTitle: employerName,
              employer: employerName,
              amount: bidPrice,
              status: "paid" as const,
              date: new Date(pickupDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US'),
              rawDate: pickupDate,
              month: new Date(pickupDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
                month: "long"
              }),
              orderCode: ticket.ticket_number,
              isBidJob: true,
              ticketNumber: ticket.ticket_number,
            };
          });
        
        console.log(`Found ${bidJobs.length} completed bid jobs for income`);
      }

      // Process transport jobs - only show completed ones (same as history)
      const transportJobs: IncomeJob[] = allJobs
        .filter((job) => isJobFullyCompleted(job, freelanceMaps))
        .map((job) => ({
          id: job.id,
          jobId: job.order_number,
          jobTitle: job.destination_company_name || job.sender_name,
          employer: job.sender_name,
          amount: job.transport_price,
          status: "paid" as const,
          date: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US'),
          rawDate: job.sender_pickup_date,
          month: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
            month: "long"
          }),
          orderCode: job.order_number,
          isBidJob: false,
        }));

      // Combine and deduplicate
      const allIncomeJobs = [...transportJobs, ...bidJobs];
      const uniqueJobs = allIncomeJobs.filter((job, index, self) =>
        index === self.findIndex((j) => j.orderCode === job.orderCode)
      );

      console.log('Total income jobs (completed only):', uniqueJobs.length);
      setPaidJobs(uniqueJobs);
      setUnpaidJobs([]);
    } catch (error) {
      console.error("Error loading income data:", error);
      toast({
        title: t('income.errorLoad'),
        description: t('income.errorLoadDesc'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleViewJobDetail = (income: IncomeJob) => {
    // Navigate to correct page based on job type
    if (income.isBidJob && income.ticketNumber) {
      navigate(`/bid-job/${encodeURIComponent(income.ticketNumber)}`);
    } else {
      navigate(`/job/${encodeURIComponent(income.orderCode)}/route-expenses`);
    }
  };

  // Group jobs by month
  const groupJobsByMonth = (jobs: IncomeJob[]) => {
    const grouped: {
      [key: string]: IncomeJob[];
    } = {};
    jobs.forEach(job => {
      if (!grouped[job.month]) {
        grouped[job.month] = [];
      }
      grouped[job.month].push(job);
    });
    return grouped;
  };
  // Loading state is now handled inline in the content area
  const allJobs = filterBySelectedMonth([...paidJobs, ...unpaidJobs], selectedMonth);
  const allGrouped = groupJobsByMonth(allJobs);
  const paidGrouped = groupJobsByMonth(filterBySelectedMonth(paidJobs, selectedMonth));
  const unpaidGrouped = groupJobsByMonth(filterBySelectedMonth(unpaidJobs, selectedMonth));
  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground rounded-b-xl shadow-lg page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate("/home")} className="absolute left-0 p-2 hover:bg-white/10 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('income.title')}</h1>
        </div>
      </header>

      <PullToRefresh onRefresh={async () => { await loadIncomeData(); }} className="px-4 pt-6">
        <Tabs defaultValue="all" className="w-full">
          {/* Hide paid/unpaid tabs for internal/external drivers */}
          {(isInternalDriver || isExternalDriver) ? (
            <div className="mb-4" />
          ) : (
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all">{t('income.all')}</TabsTrigger>
              <TabsTrigger value="paid">{t('income.paid')}</TabsTrigger>
              <TabsTrigger value="unpaid">{t('income.unpaid')}</TabsTrigger>
            </TabsList>
          )}

          {/* Month Filter */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder={t('income.selectMonth')} />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('jobHistory.allMonths')}</SelectItem>
            <SelectItem value="jan">{t('jobHistory.january')}</SelectItem>
            <SelectItem value="feb">{t('jobHistory.february')}</SelectItem>
            <SelectItem value="mar">{t('jobHistory.march')}</SelectItem>
            <SelectItem value="apr">{t('jobHistory.april')}</SelectItem>
            <SelectItem value="may">{t('jobHistory.may')}</SelectItem>
            <SelectItem value="jun">{t('jobHistory.june')}</SelectItem>
            <SelectItem value="jul">{t('jobHistory.july')}</SelectItem>
            <SelectItem value="aug">{t('jobHistory.august')}</SelectItem>
            <SelectItem value="sep">{t('jobHistory.september')}</SelectItem>
            <SelectItem value="oct">{t('jobHistory.october')}</SelectItem>
            <SelectItem value="nov">{t('jobHistory.november')}</SelectItem>
            <SelectItem value="dec">{t('jobHistory.december')}</SelectItem>
          </SelectContent>
          </Select>

          {/* All Tab */}
          <TabsContent value="all" className="space-y-4">
            {loading ? <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div> : Object.keys(allGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noData')}</div> : Object.entries(allGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.employer}</h3>
                        </div>
                        <div className={`flex items-center gap-2 font-semibold ${income.status === "paid" ? "text-green-600" : "text-muted-foreground"}`}>
                          {!(isInternalDriver || isExternalDriver) && (
                            income.status === "paid" ? <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                                <div className="w-2 h-2 bg-green-600 rounded-full" />
                              </div> : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                                <Receipt className="w-3 h-3" />
                              </div>
                          )}
                          {canViewPrice && <>฿ {income.amount.toLocaleString()}</>}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Paid Tab */}
          <TabsContent value="paid" className="space-y-4">
            {loading ? <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div> : Object.keys(paidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noPaid')}</div> : Object.entries(paidGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.employer}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                          <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-600 rounded-full" />
                          </div>
                          {canViewPrice && <>฿ {income.amount.toLocaleString()}</>}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Unpaid Tab */}
          <TabsContent value="unpaid" className="space-y-4">
            {loading ? <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div> : Object.keys(unpaidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noUnpaid')}</div> : Object.entries(unpaidGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.employer}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                            <Receipt className="w-3 h-3" />
                          </div>
                          {canViewPrice && <>฿ {income.amount.toLocaleString()}</>}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>
        </Tabs>
      </PullToRefresh>
    </div>;
}