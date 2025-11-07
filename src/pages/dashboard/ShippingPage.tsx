import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ShippingPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [timePeriod, setTimePeriod] = useState('month');
  const [vehicleType, setVehicleType] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const englishMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const months = language === 'th' ? thaiMonths : englishMonths;

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

  // Dynamic data based on filters
  const getFilteredData = () => {
    // Base multiplier based on time period
    let timeMultiplier = 1;
    if (timePeriod === 'day') {
      timeMultiplier = 0.1; // Daily data is smaller
    } else if (timePeriod === 'month') {
      timeMultiplier = 1;
    } else {
      timeMultiplier = 12; // Yearly data is larger
    }

    // Vehicle type multiplier
    const vehicleMultipliers: { [key: string]: number } = {
      'all': 1,
      'หัวลาก': 0.4,
      '12ล้อ': 0.25,
      '10ล้อ': 0.15,
      '6ล้อ': 0.12,
      '4ล้อ': 0.08,
    };
    const vehicleMultiplier = vehicleMultipliers[vehicleType] || 1;

    // Date-based variation (simulate different data for different dates)
    const dateHash = selectedDate.getTime() % 100;
    const dateVariation = 1 + (dateHash / 100);

    const finalMultiplier = timeMultiplier * vehicleMultiplier * dateVariation;

    const baseTotal = Math.round(300 * finalMultiplier);
    const baseSuccess = Math.round(baseTotal * 0.997);
    const baseInProgress = Math.round(baseTotal * 0.003);
    const baseCancelled = Math.round(baseTotal * 0.007);

    return {
      jobStats: [
        { label: t('shipping.all_jobs'), value: baseTotal, change: Math.round(2 * dateVariation), icon: '📦' },
        { label: t('shipping.success'), value: baseSuccess, change: Math.round(2 * dateVariation), icon: '✅' },
        { label: t('shipping.in_delivery'), value: baseInProgress, change: Math.round(1 * dateVariation), icon: '🚚' },
        { label: t('shipping.cancelled'), value: baseCancelled, change: Math.round(1 * dateVariation), icon: '❌' },
      ],
      regionStats: [
        { region: t('shipping.north'), value: Math.round(baseTotal * 0.18), change: Math.round(2 * dateVariation) },
        { region: t('shipping.central'), value: Math.round(baseTotal * 0.25), change: Math.round(3 * dateVariation) },
        { region: t('shipping.northeast'), value: Math.round(baseTotal * 0.15), change: Math.round(1 * dateVariation) },
        { region: t('shipping.east'), value: Math.round(baseTotal * 0.20), change: Math.round(2 * dateVariation) },
        { region: t('shipping.west'), value: Math.round(baseTotal * 0.10), change: Math.round(1 * dateVariation) },
        { region: t('shipping.south'), value: Math.round(baseTotal * 0.12), change: Math.round(2 * dateVariation) },
      ]
    };
  };

  const { jobStats, regionStats } = getFilteredData();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate('/dashboard')} className="absolute left-0 p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
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
          <button 
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <span className="text-2xl">{'<'}</span>
          </button>
          <span className="text-xl font-bold text-primary">{getDisplayDate()}</span>
          <button 
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
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
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">{t('shipping.job_data')}</h3>
            <span className="text-xs text-gray-500">{t('finance.compare_year')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {jobStats.map((stat, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                  {stat.icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-primary">{stat.value}</p>
                    <span className="text-xs text-green-600 flex items-center">
                      <TrendingUp className="w-3 h-3" />
                      {stat.change}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Region Stats */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">{t('shipping.by_region')}</h3>
            <span className="text-xs text-gray-500">{t('finance.compare_year')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {regionStats.map((stat, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 mb-1">{stat.region}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-primary">{stat.value}</p>
                  <span className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="w-3 h-3" />
                    {stat.change}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
