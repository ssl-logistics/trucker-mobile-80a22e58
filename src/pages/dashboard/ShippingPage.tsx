import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

import profitIcon from '@/assets/profit-icon.png';
import successIcon from '@/assets/success-icon.png';
import deliveryIcon from '@/assets/delivery-icon.png';
import cancelIcon from '@/assets/cancel-icon.png';

interface JobStatsData {
  jobStats: {
    total: number;
    success: number;
    inProgress: number;
    cancelled: number;
  };
  regionStats: {
    north: number;
    central: number;
    northeast: number;
    east: number;
    west: number;
    south: number;
  };
}

export default function ShippingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    t,
    language
  } = useLanguage();
  const [timePeriod, setTimePeriod] = useState('month');
  const [vehicleType, setVehicleType] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statsData, setStatsData] = useState<JobStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const koreanMonths = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const chineseMonths = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const months = language === 'th' ? thaiMonths : language === 'ko' ? koreanMonths : language === 'zh' ? chineseMonths : englishMonths;

  // Fetch job stats from API
  useEffect(() => {
    const fetchJobStats = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-job-stats?freelance_driver_id=${user.id}&time_period=${timePeriod}&vehicle_type=${vehicleType}&date=${selectedDate.toISOString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setStatsData(data);
        } else {
          console.error('Failed to fetch job stats');
          // Set empty stats on error
          setStatsData({
            jobStats: { total: 0, success: 0, inProgress: 0, cancelled: 0 },
            regionStats: { north: 0, central: 0, northeast: 0, east: 0, west: 0, south: 0 }
          });
        }
      } catch (error) {
        console.error('Error fetching job stats:', error);
        setStatsData({
          jobStats: { total: 0, success: 0, inProgress: 0, cancelled: 0 },
          regionStats: { north: 0, central: 0, northeast: 0, east: 0, west: 0, south: 0 }
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobStats();
  }, [user?.id, timePeriod, vehicleType, selectedDate]);

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

  // Transform API data to display format
  const { jobStats, regionStats } = useMemo(() => {
    if (!statsData) {
      return {
        jobStats: [
          { label: t('shipping.all_jobs'), value: 0, change: 0, icon: 'profit' },
          { label: t('shipping.success'), value: 0, change: 0, icon: 'success' },
          { label: t('shipping.in_delivery'), value: 0, change: 0, icon: 'delivery' },
          { label: t('shipping.cancelled'), value: 0, change: 0, icon: 'cancel' }
        ],
        regionStats: [
          { region: t('shipping.north'), value: 0, change: 0 },
          { region: t('shipping.central'), value: 0, change: 0 },
          { region: t('shipping.northeast'), value: 0, change: 0 },
          { region: t('shipping.east'), value: 0, change: 0 },
          { region: t('shipping.west'), value: 0, change: 0 },
          { region: t('shipping.south'), value: 0, change: 0 }
        ]
      };
    }

    return {
      jobStats: [
        { label: t('shipping.all_jobs'), value: statsData.jobStats.total, change: 0, icon: 'profit' },
        { label: t('shipping.success'), value: statsData.jobStats.success, change: 0, icon: 'success' },
        { label: t('shipping.in_delivery'), value: statsData.jobStats.inProgress, change: 0, icon: 'delivery' },
        { label: t('shipping.cancelled'), value: statsData.jobStats.cancelled, change: 0, icon: 'cancel' }
      ],
      regionStats: [
        { region: t('shipping.north'), value: statsData.regionStats.north, change: 0 },
        { region: t('shipping.central'), value: statsData.regionStats.central, change: 0 },
        { region: t('shipping.northeast'), value: statsData.regionStats.northeast, change: 0 },
        { region: t('shipping.east'), value: statsData.regionStats.east, change: 0 },
        { region: t('shipping.west'), value: statsData.regionStats.west, change: 0 },
        { region: t('shipping.south'), value: statsData.regionStats.south, change: 0 }
      ]
    };
  }, [statsData, t]);
  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/dashboard')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{t('shipping.title')}</h1>
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

        {/* Vehicle Type Dropdown */}
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger className="w-full bg-white shadow-sm border-2 border-primary">
            <SelectValue placeholder={t('shipping.all_types')} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">{t('shipping.all_types')}</SelectItem>
            <SelectItem value="หัวลาก">{t('shipping.tractor')}</SelectItem>
            <SelectItem value="12ล้อ">{t('shipping.12wheels')}</SelectItem>
            <SelectItem value="10ล้อ">{t('shipping.10wheels')}</SelectItem>
            <SelectItem value="6ล้อ">{t('shipping.6wheels')}</SelectItem>
            <SelectItem value="4ล้อ">{t('shipping.4wheels')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Job Stats */}
        {isLoading ? (
          <Card className="p-8 bg-white shadow-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </Card>
        ) : (
          <Card key={`stats-${timePeriod}-${vehicleType}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">{t('shipping.job_data')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {jobStats.map((stat, index) => <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-2xl">
                    {stat.icon === 'profit' ? <img src={profitIcon} alt="Profit" className="w-10 h-10" /> : stat.icon === 'success' ? <img src={successIcon} alt="Success" className="w-10 h-10" /> : stat.icon === 'delivery' ? <img src={deliveryIcon} alt="Delivery" className="w-10 h-10" /> : stat.icon === 'cancel' ? <img src={cancelIcon} alt="Cancel" className="w-10 h-10" /> : stat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600">{stat.label}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-xl font-bold text-primary">{stat.value}</p>
                    </div>
                  </div>
                </div>)}
            </div>
          </Card>
        )}

        {/* Region Stats */}
        {isLoading ? (
          <Card className="p-8 bg-white shadow-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </Card>
        ) : (
          <Card key={`region-${timePeriod}-${vehicleType}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800">{t('shipping.by_region')}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {regionStats.map((stat, index) => <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-1">{stat.region}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-primary">{stat.value}</p>
                  </div>
                </div>)}
            </div>
          </Card>
        )}
      </div>
    </div>;
}