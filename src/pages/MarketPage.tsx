import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Store, Gavel, Hand, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useVehiclePhoto } from '@/hooks/useVehiclePhoto';
import { useBankCheck } from '@/hooks/useBankCheck';
import { logClientEvent } from '@/lib/trackingRoomClient';
import { JobCard } from '@/components/home/JobCard';
import { ConfirmJobDialog } from '@/components/home/ConfirmJobDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import {
  getTaladJobs,
  getTaladMarketType,
  acceptTaladJob,
  submitTaladBid,
  expressTaladInterest,
  type TaladMarketType,
} from '@/lib/taladApi';


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
  price: number | null;
  start_date: string;
  pickup_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  goods_weight?: number | null;
  goods_unit?: string | null;
  goods_quantity_unit?: string | null;
  remarks?: string | null;
  invoice_number?: string | null;
  isAccepted?: boolean;
  bl_no?: string | null;
  booking_no?: string | null;
  marketType?: TaladMarketType;
}

// Helper: filter out numeric-only or very short code values from name fields
const isValidName = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim();
  const invalidNames = ['-', 'ไม่ระบุ', 'ไม่มีข้อมูล', 'n/a', 'na', 'null', 'undefined'];
  if (!s || invalidNames.includes(s.toLowerCase()) || /^\d+$/.test(s) || s.length <= 2) return '';
  return s;
};

const formatPriceInput = (raw: string): string => {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

export default function MarketPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { isFreelanceDriver, loading: roleLoading } = useUserRole();
  const { vehiclePhoto } = useVehiclePhoto();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TaladMarketType>('urgent');

  // Accept / interest confirm dialog
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'accept' | 'interest'>('accept');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bid dialog
  const [bidJob, setBidJob] = useState<Job | null>(null);
  const [bidPrice, setBidPrice] = useState('');

  const JOBS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // Guard: marketplace is freelance-only
  useEffect(() => {
    if (!roleLoading && !isFreelanceDriver) {
      navigate('/', { replace: true });
    }
  }, [roleLoading, isFreelanceDriver, navigate]);

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const loadJobs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { jobs: taladJobs, error } = await getTaladJobs();
      if (error) {
        console.error('[Market] Error loading talad jobs:', error);
        toast({
          title: t('home.error_load'),
          description: t('home.error_load_desc'),
          variant: 'destructive'
        });
        return;
      }

      const transformedJobs: Job[] = (taladJobs || [])
        .filter((item) => {
          const status = (item.status || '').toLowerCase();
          if (status && status !== 'open') return false;
          const auction = (item.auction_status || '').toLowerCase();
          if (auction && auction !== 'open') return false;
          if (item.auction_deadline) {
            const deadline = new Date(item.auction_deadline);
            if (!isNaN(deadline.getTime()) && deadline < new Date()) return false;
          }
          return true;
        })
        .map((item) => {
          const bookingNo = item.container?.booking_no || null;
          const weightNumber = typeof item.weight === 'number'
            ? item.weight
            : (typeof item.weight === 'string' ? parseFloat(item.weight.replace(/[^\d.]/g, '')) : null);

          return {
            id: item.job_id,
            post_id: item.job_id,
            order_code: item.talad_code || (item.job_id ? item.job_id.slice(0, 8).toUpperCase() : ''),
            job_type: bookingNo || item.service_type === 'container' ? 'international' : (item.job_type || 'domestic'),
            employer_name: isValidName(item.poster?.company_name) || isValidName(item.poster?.contact_name) || '',
            transport_type: item.truck_type || 'single',
            transport_type_label: item.truck_type || '',
            origin_location: item.locations?.pickup || item.origin || '',
            destination_location: item.locations?.dropoff || item.destination || '',
            destination_company_name: null,
            price: item.final_price ?? item.price ?? null,
            start_date: (item.locations?.pickup_date || item.created_at || '').slice(0, 10),
            pickup_time: '',
            equipment_list: item.truck_type || null,
            safety_equipment: null,
            goods_type: item.title || null,
            goods_quantity: null,
            goods_weight: weightNumber && !isNaN(weightNumber) ? weightNumber : null,
            goods_unit: null,
            goods_quantity_unit: null,
            isAccepted: false,
            bl_no: null,
            booking_no: bookingNo,
            invoice_number: null,
            remarks: item.description || null,
            marketType: getTaladMarketType(item),
          } as Job;
        });

      setJobs(transformedJobs);
    } catch (err) {
      console.error('[Market] Error fetching jobs:', err);
      toast({
        title: t('home.error_load'),
        description: t('home.error_load_desc'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, t]);


  useEffect(() => {
    if (user && isFreelanceDriver) {
      loadJobs();
    }
  }, [user, isFreelanceDriver, loadJobs]);

  const tabCounts = useMemo(() => {
    const counts: Record<TaladMarketType, number> = { urgent: 0, auction: 0, interest: 0 };
    jobs.forEach((j) => { counts[j.marketType || 'auction'] += 1; });
    return counts;
  }, [jobs]);

  const applySearch = (jobList: Job[]) => {
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) return jobList;
    return jobList.filter((job) => {
      const haystack = [
        job.order_code,
        job.bl_no,
        job.booking_no,
        job.employer_name,
        job.destination_company_name,
        job.origin_location,
        job.destination_location,
        job.goods_type,
        job.transport_type,
        job.transport_type_label,
        job.equipment_list,
      ]
        .filter((f) => typeof f === 'string')
        .join(' ')
        .toLowerCase();
      return haystack.includes(raw);
    });
  };

  const tabJobs = useMemo(
    () => jobs.filter((j) => (j.marketType || 'auction') === activeTab),
    [jobs, activeTab]
  );
  const displayedJobs = applySearch(tabJobs);
  const totalPages = Math.ceil(displayedJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = displayedJobs.slice((currentPage - 1) * JOBS_PER_PAGE, currentPage * JOBS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, jobs.length, activeTab]);

  // Card primary button → route by market type
  const handleAcceptJob = (job: Job) => {
    const type = job.marketType || 'auction';
    logClientEvent({
      event: `market:${type}:pressed`,
      driver_id: localStorage.getItem('auth_driver_id') ?? user?.id ?? null,
      order_number: job.order_code,
      payload: { context: 'market-page', job_id: job.id, market_type: type },
    });

    if (type === 'auction') {
      setBidJob(job);
      setBidPrice('');
    } else {
      setSelectedJob(job);
      setConfirmMode(type === 'interest' ? 'interest' : 'accept');
      setConfirmDialogOpen(true);
    }
  };

  // Urgent accept / interest confirm — Talad endpoints not available yet (UI รอ API)
  const confirmJobAction = async () => {
    if (!selectedJob || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const type = selectedJob.marketType || 'auction';
      if (type === 'interest') {
        await expressTaladInterest(selectedJob.id);
      } else {
        await acceptTaladJob({ job_id: selectedJob.id });
      }
      toast({
        title: t('market.pending_title'),
        description: t('market.pending_desc'),
      });
      setConfirmDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auction bid submit — Talad bid endpoint not available yet (UI รอ API)
  const confirmBid = async () => {
    if (!bidJob || isSubmitting) return;
    const price = Number(bidPrice.replace(/[^\d]/g, ''));
    if (!price || price <= 0) {
      toast({
        title: t('market.bid_dialog_title'),
        description: t('market.bid_invalid'),
        variant: 'destructive',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitTaladBid(bidJob.id, price);
      toast({
        title: t('market.pending_title'),
        description: t('market.pending_desc'),
      });
      setBidJob(null);
      setBidPrice('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const tabs: Array<{ key: TaladMarketType; labelKey: string; icon: typeof Zap }> = [
    { key: 'urgent', labelKey: 'market.tab_urgent', icon: Zap },
    { key: 'auction', labelKey: 'market.tab_auction', icon: Gavel },
    { key: 'interest', labelKey: 'market.tab_interest', icon: Hand },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <AppHeader
        userName={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.full_name || user?.name || user?.username}
        profilePhoto={user?.profile_photo_url || user?.avatar_url || vehiclePhoto || undefined}
        onSignOut={handleSignOut}
        showQuickMenu={false}
      />

      <PullToRefresh onRefresh={loadJobs} className="flex-1 pb-24 lg:pb-8">
        <div className="px-4 mt-6 sm:px-6 lg:px-8 xl:px-10 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold sm:text-xl lg:text-2xl flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              {t('market.title')}
            </h2>
            <span className="text-sm text-muted-foreground sm:text-base">
              {displayedJobs.length} {t('home.items')}
              {totalPages > 1 && ` • ${currentPage}/${totalPages}`}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-md lg:max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('market.search_placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>

          {/* Market type tabs */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {tabs.map(({ key, labelKey, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-center gap-1.5 h-11 rounded-xl border text-sm font-medium transition-colors sm:text-base ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t(labelKey)}</span>
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${active ? 'bg-white/20' : 'bg-muted'}`}>
                    {tabCounts[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Job Cards */}
          <div className="card-grid-responsive">
            {isLoading && displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-muted-foreground sm:text-lg">
                  {t('common.loading') || 'กำลังโหลด...'}
                </p>
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center col-span-full">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 sm:w-20 sm:h-20">
                  <Store className="w-8 h-8 text-muted-foreground sm:w-10 sm:h-10" />
                </div>
                <p className="text-muted-foreground sm:text-lg">
                  {t('market.empty')}
                </p>
              </div>
            ) : (
              paginatedJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onAccept={handleAcceptJob}
                  isProcessing={isSubmitting}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 mb-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => { setCurrentPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </PullToRefresh>

      <BottomNavigation />

      {/* Accept / Interest confirm */}
      <ConfirmJobDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={confirmJobAction}
        job={selectedJob}
        isLoading={isSubmitting}
        titleKey={confirmMode === 'interest' ? 'market.interest_title' : undefined}
        messageKey={confirmMode === 'interest' ? 'market.interest_message' : undefined}
      />

      {/* Bid dialog (auction) */}
      <Dialog open={!!bidJob} onOpenChange={(open) => { if (!open) { setBidJob(null); setBidPrice(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              {t('market.bid_dialog_title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t('job.orderCode')}</p>
              <p className="font-bold text-primary text-lg">{bidJob?.order_code}</p>
              {(bidJob?.origin_location || bidJob?.destination_location) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {bidJob?.origin_location || '-'} → {bidJob?.destination_location || '-'}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('market.bid_price_label')}</label>
              <Input
                inputMode="numeric"
                placeholder={t('market.bid_price_placeholder')}
                value={bidPrice}
                onChange={(e) => setBidPrice(formatPriceInput(e.target.value))}
                className="h-11 text-lg font-semibold text-right"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-3 sm:justify-center">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => { setBidJob(null); setBidPrice(''); }}
            >
              {t('confirm.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={isSubmitting || !bidPrice}
              onClick={confirmBid}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('job.processing')}
                </span>
              ) : (
                t('market.bid_confirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
