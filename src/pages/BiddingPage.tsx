import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
type BiddingJob = Database['public']['Tables']['jobs']['Row'];
type JobBid = Database['public']['Tables']['job_bids']['Row'];
interface Bid extends JobBid {
  jobs: BiddingJob;
}
export default function BiddingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [availableJobs, setAvailableJobs] = useState<BiddingJob[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [activeTab, setActiveTab] = useState('bidding');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const getMonthLabel = (monthValue: string) => {
    const monthNames = {
      th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
      ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    };
    const index = parseInt(monthValue);
    return monthNames[language as keyof typeof monthNames]?.[index] || monthNames.en[index];
  };

  const months = [
    { value: 'all', label: t('jobHistory.allMonths') },
    { value: '0', label: getMonthLabel('0') },
    { value: '1', label: getMonthLabel('1') },
    { value: '2', label: getMonthLabel('2') },
    { value: '3', label: getMonthLabel('3') },
    { value: '4', label: getMonthLabel('4') },
    { value: '5', label: getMonthLabel('5') },
    { value: '6', label: getMonthLabel('6') },
    { value: '7', label: getMonthLabel('7') },
    { value: '8', label: getMonthLabel('8') },
    { value: '9', label: getMonthLabel('9') },
    { value: '10', label: getMonthLabel('10') },
    { value: '11', label: getMonthLabel('11') },
  ];

  const filteredBids = selectedMonth === 'all' 
    ? myBids 
    : myBids.filter(bid => {
        const bidMonth = new Date(bid.created_at).getMonth();
        return bidMonth === parseInt(selectedMonth);
      });
  useEffect(() => {
    if (user) {
      loadAvailableJobs();
      loadMyBids();
    }
  }, [user]);
  const loadAvailableJobs = async () => {
    const {
      data,
      error
    } = await supabase.from('jobs').select('*').eq('status', 'available').order('created_at', {
      ascending: false
    });
    if (!error && data) {
      setAvailableJobs(data);
    }
  };
  const loadMyBids = async () => {
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from('job_bids').select('*, jobs(*)').eq('driver_id', user.id).order('created_at', {
      ascending: false
    });
    if (!error && data) {
      setMyBids(data as Bid[]);
    }
  };
  const handlePlaceBid = (jobId: string) => {
    navigate(`/bidding/${jobId}`);
  };
  const getBidStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: t('bidding.statusPending'),
        variant: 'secondary' as const
      },
      accepted: {
        label: t('bidding.statusAccepted'),
        variant: 'default' as const
      },
      rejected: {
        label: t('bidding.statusRejected'),
        variant: 'destructive' as const
      }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-center px-4 py-4 bg-[#DDEDFF] rounded-b-xl relative">
          <button onClick={() => navigate('/home')} className="absolute left-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('bidding.title')}</h1>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
          <TabsTrigger value="bidding" className="rounded-none">
            {t('bidding.biddingTab')}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-none">
            {t('bidding.historyTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bidding" className="px-4 mt-4 space-y-4">
          {availableJobs.length === 0 ? <div className="text-center py-12 text-muted-foreground">
              {t('bidding.noJobs')}
            </div> : availableJobs.map(job => <Card key={job.id} className="p-4 space-y-3 bg-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                    {t('job.order_code')} {job.order_code}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(job.start_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: '2-digit'
              })} | {job.start_time.substring(0, 5)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('job.employer')} : </span>
                    <span className="font-medium">{job.destination_company_name || job.employer_name}</span>
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
                  </div>

                  {(job.equipment_list || job.safety_equipment) && <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                      {job.equipment_list && <div>
                          <span className="text-muted-foreground">{t('job.equipment')} : </span>
                          <span>{job.equipment_list}</span>
                        </div>}
                      {job.safety_equipment && <div>
                          <span className="text-muted-foreground">{t('job.safety')} : </span>
                          <span>{job.safety_equipment}</span>
                        </div>}
                    </div>}
                </div>

                <Button className="w-full h-11 text-base font-medium" onClick={() => handlePlaceBid(job.id)}>
                  {t('bidding.placeBid')}
                </Button>
              </Card>)}
        </TabsContent>

        <TabsContent value="history" className="px-4 mt-4">
          <div className="mb-4">
            <select 
              className="w-full p-3 border rounded-lg bg-background"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-sm mb-3">{t('bidding.monthLabel')}</h3>
            {filteredBids.length === 0 ? <div className="text-center py-12 text-muted-foreground">
                {t('bidding.noHistory')}
              </div> : <div className="space-y-4">
                {filteredBids.map(bid => <Card key={bid.id} className="p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between mb-3">
                      <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
                        {t('job.order_code')} {bid.jobs.order_code}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(bid.jobs.start_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit'
                  })} | {bid.jobs.start_time.substring(0, 5)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t('job.employer')} : </span>
                        <span className="font-medium">{bid.jobs.destination_company_name || bid.jobs.employer_name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {bid.jobs.transport_type}
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs">
                              <div className="text-muted-foreground">{t('job.origin')}</div>
                              <div className="font-medium">{bid.jobs.origin_location}</div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs">
                              <div className="text-muted-foreground">{t('job.destination')}</div>
                              <div className="font-medium">{bid.jobs.destination_location}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50">
                          <span className="text-lg font-bold text-teal-700">฿ {bid.bid_amount.toLocaleString()}</span>
                        </div>
                      </div>

                      {(bid.jobs.equipment_list || bid.jobs.safety_equipment) && <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
                          {bid.jobs.equipment_list && <div>
                              <span className="text-muted-foreground">{t('job.equipment')} : </span>
                              <span>{bid.jobs.equipment_list}</span>
                            </div>}
                          {bid.jobs.safety_equipment && <div>
                              <span className="text-muted-foreground">{t('job.safety')} : </span>
                              <span>{bid.jobs.safety_equipment}</span>
                            </div>}
                        </div>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">
                        {t('bidding.bidAt')} {new Date(bid.created_at).toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                      </span>
                      {getBidStatusBadge(bid.status)}
                    </div>
                  </Card>)}
              </div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}