import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getDriverCheckins } from '@/lib/externalApi';
import { filterCompletedJobs } from '@/utils/jobCompletionFilter';
import profitIcon from '@/assets/profit-icon.png';
import expensesIcon from '@/assets/expenses-icon.png';

interface CompletedJob {
  id: string;
  order_number: string;
  sender_name: string;
  destination_company_name: string | null;
  transport_price: number;
  sender_pickup_date: string;
  status: string;
}

interface FinanceData {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  chartData: { label: string; income: number; expense: number }[];
  pendingPayments: { id: string; company: string; amount: number }[];
}

export default function FinancePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [expenses, setExpenses] = useState<{ job_id: string; amount: number; created_at: string }[]>([]);

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const koreanMonths = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const englishMonthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const koreanMonthsShort = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  
  const months = language === 'th' ? thaiMonths : language === 'ko' ? koreanMonths : englishMonths;
  const monthsShort = language === 'th' ? thaiMonthsShort : language === 'ko' ? koreanMonthsShort : englishMonthsShort;

  // Fetch data from API
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Fetch jobs and checkins in parallel
        const [jobsRes, checkinsResult, expenseRes] = await Promise.all([
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(user.id)}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          ),
          getDriverCheckins(user.id, 'freelance', 'all'),
          supabase
            .from('expenses')
            .select('job_id, amount, created_at')
            .eq('driver_id', user.id),
        ]);

        const jobsJson = await jobsRes.json();

        const allJobs: CompletedJob[] = jobsJson?.data || [];
        const allCheckinsRaw = checkinsResult.error
          ? []
          : ((checkinsResult.data as any)?.data || checkinsResult.data || []);
        const checkins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

        // Use shared completion filter (POD + container return for international)
        const completedJobs = filterCompletedJobs(allJobs, checkins, user.id);
        setJobs(completedJobs);

        setExpenses(expenseRes.data || []);
      } catch (error) {
        console.error('Error loading finance data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const getDisplayDate = () => {
    const day = selectedDate.getDate();
    const month = months[selectedDate.getMonth()];
    const year = language === 'th' ? selectedDate.getFullYear() + 543 : selectedDate.getFullYear();
    if (timePeriod === 'day') {
      return `${day} ${month} ${year}`;
    } else if (timePeriod === 'month') {
      return `${month} ${year}`;
    } else {
      return `${t('finance.buddhist_era')} ${year}`;
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (timePeriod === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (timePeriod === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Calculate finance data based on jobs and expenses
  const financeData = useMemo<FinanceData>(() => {
    const filterByPeriod = (dateStr: string) => {
      const date = new Date(dateStr);
      if (timePeriod === 'day') {
        return (
          date.getDate() === selectedDate.getDate() &&
          date.getMonth() === selectedDate.getMonth() &&
          date.getFullYear() === selectedDate.getFullYear()
        );
      } else if (timePeriod === 'month') {
        return (
          date.getMonth() === selectedDate.getMonth() &&
          date.getFullYear() === selectedDate.getFullYear()
        );
      } else {
        return date.getFullYear() === selectedDate.getFullYear();
      }
    };

    // Filter jobs by period (already filtered by delivery_confirmed in loadData)
    const filteredJobs = jobs.filter(
      job => job.sender_pickup_date && filterByPeriod(job.sender_pickup_date)
    );

    // Filter expenses by period
    const filteredExpenses = expenses.filter(
      exp => exp.created_at && filterByPeriod(exp.created_at)
    );

    // Calculate totals
    const totalIncome = filteredJobs.reduce((sum, job) => sum + (job.transport_price || 0), 0);
    const totalExpense = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const profit = totalIncome - totalExpense;

    // Generate chart data
    let chartData: { label: string; income: number; expense: number }[] = [];

    if (timePeriod === 'day') {
      // Group by hours
      const hours = ['00:00', '06:00', '12:00', '18:00', '23:59'];
      chartData = hours.map(hour => ({
        label: hour,
        income: 0,
        expense: 0
      }));
      // For day view, just show totals at end of day
      if (chartData.length > 0) {
        chartData[chartData.length - 1].income = totalIncome;
        chartData[chartData.length - 1].expense = totalExpense;
      }
    } else if (timePeriod === 'month') {
      // Group by weeks
      const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
      const weekData: { [week: number]: { income: number; expense: number } } = {};
      
      filteredJobs.forEach(job => {
        const jobDate = new Date(job.sender_pickup_date);
        const week = Math.ceil(jobDate.getDate() / 7);
        if (!weekData[week]) weekData[week] = { income: 0, expense: 0 };
        weekData[week].income += job.transport_price || 0;
      });

      filteredExpenses.forEach(exp => {
        const expDate = new Date(exp.created_at);
        const week = Math.ceil(expDate.getDate() / 7);
        if (!weekData[week]) weekData[week] = { income: 0, expense: 0 };
        weekData[week].expense += exp.amount || 0;
      });

      const totalWeeks = Math.ceil(daysInMonth / 7);
      for (let w = 1; w <= totalWeeks; w++) {
        chartData.push({
          label: `สัปดาห์ ${w}`,
          income: weekData[w]?.income || 0,
          expense: weekData[w]?.expense || 0
        });
      }
    } else {
      // Group by months
      const monthData: { [month: number]: { income: number; expense: number } } = {};
      
      filteredJobs.forEach(job => {
        const jobDate = new Date(job.sender_pickup_date);
        const month = jobDate.getMonth();
        if (!monthData[month]) monthData[month] = { income: 0, expense: 0 };
        monthData[month].income += job.transport_price || 0;
      });

      filteredExpenses.forEach(exp => {
        const expDate = new Date(exp.created_at);
        const month = expDate.getMonth();
        if (!monthData[month]) monthData[month] = { income: 0, expense: 0 };
        monthData[month].expense += exp.amount || 0;
      });

      chartData = monthsShort.map((label, i) => ({
        label,
        income: monthData[i]?.income || 0,
        expense: monthData[i]?.expense || 0
      }));
    }

    // Calculate pending payments (unpaid jobs grouped by company)
    const pendingJobs = jobs.filter(
      job => job.status === 'delivered' && 
             job.sender_pickup_date && 
             filterByPeriod(job.sender_pickup_date)
    );

    const pendingByCompany: { [company: string]: number } = {};
    pendingJobs.forEach(job => {
      const company = job.sender_name || 'Unknown';
      if (!pendingByCompany[company]) pendingByCompany[company] = 0;
      pendingByCompany[company] += job.transport_price || 0;
    });

    const pendingPayments = Object.entries(pendingByCompany)
      .map(([company, amount], index) => ({
        id: `pending-${index}`,
        company,
        amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      totalIncome,
      totalExpense,
      profit,
      chartData,
      pendingPayments
    };
  }, [jobs, expenses, selectedDate, timePeriod, monthsShort]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground px-4 py-4 shadow-md">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/dashboard')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t('finance.title')}</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Time Period Tabs */}
        <Tabs value={timePeriod} onValueChange={setTimePeriod} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm">
            <TabsTrigger value="day">{t('finance.day')}</TabsTrigger>
            <TabsTrigger value="month">{t('finance.month')}</TabsTrigger>
            <TabsTrigger value="year">{t('finance.year')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4 py-2">
          <button onClick={() => navigateDate('prev')} className="p-2 rounded-full">
            <span className="text-2xl">{'<'}</span>
          </button>
          <span key={getDisplayDate()} className="text-xl font-bold animate-in fade-in duration-300 text-[#153860]">
            {getDisplayDate()}
          </span>
          <button onClick={() => navigateDate('next')} className="p-2 rounded-full">
            <span className="text-2xl">{'>'}</span>
          </button>
        </div>

        {/* Summary Cards */}
        <Card key={`${timePeriod}-${selectedDate.getTime()}`} className="p-4 bg-gray-50 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center">
            {/* Profit Section */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <img src={profitIcon} alt="Profit" className="w-12 h-12 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">{t('finance.profit')}</p>
                <p className="text-lg font-bold truncate text-[#118841]">
                  {financeData.profit.toLocaleString()}
                </p>
              </div>
            </div>
            
            {/* Divider */}
            <div className="w-px h-12 bg-gray-300 mx-2 flex-shrink-0"></div>
            
            {/* Expenses Section */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <img src={expensesIcon} alt="Expenses" className="w-12 h-12 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">{t('finance.expenses')}</p>
                <p className="text-lg font-bold truncate text-destructive">
                  {financeData.totalExpense.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Chart */}
        <Card key={`chart-${timePeriod}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              <p className="text-xs text-gray-600">{t('finance.total_income')}</p>
              <p className="text-lg font-bold text-[#0a8576]">
                {financeData.totalIncome.toLocaleString()}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={financeData.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name={t('finance.income')} />
              <Line type="monotone" dataKey="expense" stroke="#374151" strokeWidth={2} name={t('finance.expenses')} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Pending Payments */}
        {financeData.pendingPayments.length > 0 && (
          <Card className="p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#153860]">{t('finance.pending_payments')}</h3>
              <span className="text-sm text-gray-500">
                {financeData.pendingPayments.length} {t('finance.companies')}
              </span>
            </div>
            <div className="space-y-2">
              {financeData.pendingPayments.map((payment, index) => (
                <div 
                  key={payment.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-blue-900 text-white' : 'bg-gray-50'}`}
                >
                  <span className={`text-sm ${index === 0 ? 'text-white' : 'text-gray-700'}`}>
                    {payment.company}
                  </span>
                  <span className={`font-bold ${index === 0 ? 'text-white' : 'text-gray-900'}`}>
                    ฿ {payment.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* No data message */}
        {financeData.totalIncome === 0 && financeData.totalExpense === 0 && (
          <Card className="p-8 bg-white shadow-sm text-center">
            <p className="text-gray-500">{t('finance.no_data') || 'ไม่มีข้อมูลในช่วงเวลานี้'}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
