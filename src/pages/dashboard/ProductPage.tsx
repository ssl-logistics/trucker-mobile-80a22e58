import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { getDriverCheckins } from '@/lib/externalApi';
import { filterCompletedJobs } from '@/utils/jobCompletionFilter';
// External API job interface
interface ExternalJob {
  id: string;
  product_name: string;
  transport_price: number;
  sender_pickup_date: string;
  created_at: string;
  status: string;
}

// Unified job data for product aggregation
interface JobData {
  productName: string;
  amount: number;
  date: string;
}

interface ProductData {
  name: string;
  jobs: number;
  amount: number;
  color: string;
}

const COLORS = ['#10b981', '#1e40af', '#7c3aed', '#06b6d4', '#f59e0b', '#ef4444', '#f97316', '#6366f1'];

export default function ProductPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const koreanMonths = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const months = language === 'th' ? thaiMonths : language === 'ko' ? koreanMonths : englishMonths;

  // Fetch jobs from external API with delivery_confirmed check
  useEffect(() => {
    const fetchAllJobs = async () => {
      if (!user) return;
      setLoading(true);
      
      const allJobs: JobData[] = [];

      try {
        // Fetch jobs and checkins in parallel from external API
        const [jobsRes, checkinsResult] = await Promise.all([
          fetch(
            `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${encodeURIComponent(user.id)}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
              },
            }
          ),
          getDriverCheckins(user.id, 'freelance', 'all'),
        ]);

        const jobsJson = await jobsRes.json();

        const externalJobs: ExternalJob[] = Array.isArray(jobsJson) ? jobsJson : (jobsJson.data || []);
        const allCheckinsRaw = checkinsResult.error
          ? []
          : ((checkinsResult.data as any)?.data || checkinsResult.data || []);
        const checkins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

        // Use shared completion filter (POD + container return for international)
        const completedJobs = filterCompletedJobs(externalJobs, checkins, user.id);
        
        completedJobs.forEach(job => {
          allJobs.push({
            productName: job.product_name || 'ไม่ระบุสินค้า',
            amount: job.transport_price || 0,
            date: job.sender_pickup_date || job.created_at
          });
        });

        setJobs(allJobs);
      } catch (err) {
        console.error('Error fetching jobs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllJobs();
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

  // Filter jobs by selected date and aggregate by product
  const { pieData, productDetails } = useMemo(() => {
    // Filter jobs based on time period
    const filteredJobs = jobs.filter(job => {
      const jobDate = new Date(job.date);
      if (!jobDate || isNaN(jobDate.getTime())) return false;

      if (timePeriod === 'day') {
        return (
          jobDate.getDate() === selectedDate.getDate() &&
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      } else if (timePeriod === 'month') {
        return (
          jobDate.getMonth() === selectedDate.getMonth() &&
          jobDate.getFullYear() === selectedDate.getFullYear()
        );
      } else {
        return jobDate.getFullYear() === selectedDate.getFullYear();
      }
    });

    // Aggregate by product
    const productMap = new Map<string, { jobs: number; amount: number }>();

    filteredJobs.forEach(job => {
      const productName = job.productName || 'ไม่ระบุสินค้า';
      const existing = productMap.get(productName) || { jobs: 0, amount: 0 };
      productMap.set(productName, {
        jobs: existing.jobs + 1,
        amount: existing.amount + (job.amount || 0)
      });
    });

    // Convert to array and sort by jobs descending
    const sortedProducts: ProductData[] = Array.from(productMap.entries())
      .map(([name, data], index) => ({
        name,
        jobs: data.jobs,
        amount: data.amount,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 5); // Top 5

    const pieData = sortedProducts.map(p => ({
      name: p.name,
      value: p.jobs,
      color: p.color
    }));

    return { pieData, productDetails: sortedProducts };
  }, [jobs, selectedDate, timePeriod]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="app-sticky-header bg-header text-header-foreground px-4 py-4 shadow-md">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/dashboard')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t('product.title')}</h1>
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
          <button onClick={() => navigateDate('prev')} className="p-2 rounded-full transition-colors">
            <span className="text-2xl">{'<'}</span>
          </button>
          <span key={getDisplayDate()} className="text-xl font-bold animate-in fade-in duration-300 text-[#153860]">
            {getDisplayDate()}
          </span>
          <button onClick={() => navigateDate('next')} className="p-2 rounded-full transition-colors">
            <span className="text-2xl">{'>'}</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : productDetails.length === 0 ? (
          <Card className="p-8 bg-white shadow-sm text-center">
            <p className="text-gray-500">{t('finance.no_data')}</p>
          </Card>
        ) : (
          <>
            {/* Pie Chart */}
            <Card key={`chart-${timePeriod}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{t('product.product_types')}</h3>
                <span className="text-sm text-gray-500">{t('product.top_5')}</span>
              </div>
              <div className="flex items-center">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie 
                      data={pieData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={25} 
                      outerRadius={75}
                      paddingAngle={pieData.length === 1 ? 0 : 2} 
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                            {value}
                          </text>
                        );
                      }}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 min-w-0 pl-4">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-700 truncate max-w-[120px]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Product List */}
            <Card key={`list-${timePeriod}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-3">
                {productDetails.map((product, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{product.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{product.jobs} {t('product.jobs')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">฿ {product.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
