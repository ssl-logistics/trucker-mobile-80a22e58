import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Wallet, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

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
  month: string;
  orderCode: string;
}

export default function IncomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [paidJobs, setPaidJobs] = useState<IncomeJob[]>([]);
  const [unpaidJobs, setUnpaidJobs] = useState<IncomeJob[]>([]);

  useEffect(() => {
    if (user) {
      loadIncomeData();
    }
  }, [user]);

  const loadIncomeData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch completed jobs from external API (same as job history)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(user.id)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch completed jobs');
      }

      const result = await response.json();
      const completedJobs: CompletedJob[] = result.data || [];

      // Filter only completed/delivered jobs
      const finishedJobs = completedJobs.filter(
        job => job.status === 'completed' || job.status === 'delivered'
      );

      // Process the data
      const paid: IncomeJob[] = [];
      const unpaid: IncomeJob[] = [];

      finishedJobs.forEach((job) => {
        const incomeJob: IncomeJob = {
          id: job.id,
          jobId: job.order_number,
          jobTitle: job.destination_company_name || job.sender_name,
          employer: job.sender_name,
          amount: job.transport_price,
          status: job.status === 'completed' ? "paid" : "pending",
          date: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US'),
          month: new Date(job.sender_pickup_date).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
            month: "long"
          }),
          orderCode: job.order_number
        };

        // Consider "completed" as paid, "delivered" as pending payment
        if (job.status === 'completed') {
          paid.push(incomeJob);
        } else {
          unpaid.push(incomeJob);
        }
      });

      setPaidJobs(paid);
      setUnpaidJobs(unpaid);
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
  const handleViewJobDetail = (jobId: string) => {
    navigate(`/job/${jobId}/route-expenses`);
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
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  const allJobs = [...paidJobs, ...unpaidJobs];
  const allGrouped = groupJobsByMonth(allJobs);
  const paidGrouped = groupJobsByMonth(paidJobs);
  const unpaidGrouped = groupJobsByMonth(unpaidJobs);
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

      <div className="px-4 pt-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">{t('income.all')}</TabsTrigger>
            <TabsTrigger value="paid">{t('income.paid')}</TabsTrigger>
            <TabsTrigger value="unpaid">{t('income.unpaid')}</TabsTrigger>
          </TabsList>

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
            {Object.keys(allGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noData')}</div> : Object.entries(allGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                        </div>
                        <div className={`flex items-center gap-2 font-semibold ${income.status === "paid" ? "text-green-600" : "text-muted-foreground"}`}>
                          {income.status === "paid" ? <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                              <div className="w-2 h-2 bg-green-600 rounded-full" />
                            </div> : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                              <Receipt className="w-3 h-3" />
                            </div>}
                          ฿ {income.amount.toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income.jobId)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Paid Tab */}
          <TabsContent value="paid" className="space-y-4">
            {Object.keys(paidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noPaid')}</div> : Object.entries(paidGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-green-600 font-semibold">
                          <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-600 rounded-full" />
                          </div>
                          ฿ {income.amount.toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income.jobId)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Unpaid Tab */}
          <TabsContent value="unpaid" className="space-y-4">
            {Object.keys(unpaidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">{t('income.noUnpaid')}</div> : Object.entries(unpaidGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                            <Receipt className="w-3 h-3" />
                          </div>
                          ฿ {income.amount.toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income.jobId)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        {t('income.viewDetails')}
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}