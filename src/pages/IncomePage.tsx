import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
interface IncomeJob {
  id: string;
  jobId: string;
  jobTitle: string;
  employer: string;
  amount: number;
  status: 'paid' | 'pending';
  date: string;
  month: string;
  orderCode: string;
}
export default function IncomePage() {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('all');
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
      // Fetch all accepted job applications (excluding pending and rejected)
      const {
        data: applications,
        error
      } = await supabase.from('job_applications').select(`
          id,
          job_id,
          payment_completed_at,
          status,
          jobs (
            id,
            order_code,
            employer_name,
            price,
            start_date
          )
        `).eq('driver_id', user.id).neq('status', 'pending').neq('status', 'rejected');
      if (error) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถโหลดข้อมูลรายได้ได้',
          variant: 'destructive'
        });
        return;
      }

      // Process the data
      const paid: IncomeJob[] = [];
      const unpaid: IncomeJob[] = [];
      applications?.forEach((app: any) => {
        if (!app.jobs) return;
        const job: IncomeJob = {
          id: app.id,
          jobId: app.job_id,
          jobTitle: app.jobs.employer_name,
          employer: app.jobs.employer_name,
          amount: app.jobs.price,
          status: app.payment_completed_at ? 'paid' : 'pending',
          date: new Date(app.jobs.start_date).toLocaleDateString('th-TH'),
          month: new Date(app.jobs.start_date).toLocaleDateString('th-TH', {
            month: 'long'
          }),
          orderCode: app.jobs.order_code
        };
        if (app.payment_completed_at) {
          paid.push(job);
        } else {
          unpaid.push(job);
        }
      });
      setPaidJobs(paid);
      setUnpaidJobs(unpaid);
    } catch (error) {
      console.error('Error loading income data:', error);
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
      <header className="bg-header text-header-foreground px-4 py-4 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-center relative mb-4">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">รายได้ของฉัน</h1>
        </div>
      </header>

      <div className="px-4 pt-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="paid">ชำระแล้ว</TabsTrigger>
            <TabsTrigger value="unpaid">ยังไม่ชำระ</TabsTrigger>
          </TabsList>

          {/* Month Filter */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเดือน</SelectItem>
              <SelectItem value="jan">มกราคม</SelectItem>
              <SelectItem value="feb">กุมภาพันธ์</SelectItem>
              <SelectItem value="mar">มีนาคม</SelectItem>
            </SelectContent>
          </Select>

          {/* All Tab */}
          <TabsContent value="all" className="space-y-4">
            {Object.keys(allGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">
                ไม่มีข้อมูลรายได้
              </div> : Object.entries(allGrouped).map(([month, jobs]) => <div key={month}>
                  <div className="text-sm text-muted-foreground mb-2">{month}</div>
                  {jobs.map(income => <Card key={income.id} className="p-4 mb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                        </div>
                        <div className={`flex items-center gap-2 font-semibold ${income.status === 'paid' ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {income.status === 'paid' ? <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                              <div className="w-2 h-2 bg-green-600 rounded-full" />
                            </div> : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                              <Receipt className="w-3 h-3" />
                            </div>}
                          ฿ {income.amount.toLocaleString()}
                        </div>
                      </div>
                      <button onClick={() => handleViewJobDetail(income.jobId)} className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors">
                        ดูข้อมูลงาน
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Paid Tab */}
          <TabsContent value="paid" className="space-y-4">
            {Object.keys(paidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">
                ไม่มีงานที่ชำระแล้ว
              </div> : Object.entries(paidGrouped).map(([month, jobs]) => <div key={month}>
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
                        ดูข้อมูลงาน
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>

          {/* Unpaid Tab */}
          <TabsContent value="unpaid" className="space-y-4">
            {Object.keys(unpaidGrouped).length === 0 ? <div className="text-center py-8 text-muted-foreground">
                ไม่มีงานที่ยังไม่ชำระ
              </div> : Object.entries(unpaidGrouped).map(([month, jobs]) => <div key={month}>
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
                        ดูข้อมูลงาน
                      </button>
                    </Card>)}
                </div>)}
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}