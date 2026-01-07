import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import profitIcon from '@/assets/profit-icon.png';
import expensesIcon from '@/assets/expenses-icon.png';
export default function FinancePage() {
  const navigate = useNavigate();
  const {
    t,
    language
  } = useLanguage();
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const englishMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const koreanMonths = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const englishMonthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const koreanMonthsShort = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const months = language === 'th' ? thaiMonths : language === 'ko' ? koreanMonths : englishMonths;
  const monthsShort = language === 'th' ? thaiMonthsShort : language === 'ko' ? koreanMonthsShort : englishMonthsShort;
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
  const {
    chartData,
    totalIncome,
    totalExpense,
    profit,
    profitPercentage,
    pendingPayments
  } = useMemo(() => {
    // Date-based variation
    const dateHash = selectedDate.getTime() % 100;
    const dateVariation = 1 + dateHash / 100;
    let chartData: any[] = [];
    let totalIncome = 0;
    let totalExpense = 0;
    if (timePeriod === 'day') {
      // Generate hourly data for a day
      const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
      chartData = hours.map((hour, i) => ({
        month: hour,
        income: Math.round((3000 + i * 500) * dateVariation),
        expense: Math.round((1000 + i * 200) * dateVariation)
      }));
      totalIncome = Math.round(18000 * dateVariation);
      totalExpense = Math.round(8000 * dateVariation);
    } else if (timePeriod === 'month') {
      // Generate data for days in current month
      const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
      const step = Math.ceil(daysInMonth / 10);
      for (let i = 1; i <= daysInMonth; i += step) {
        chartData.push({
          month: `${i}`,
          income: Math.round((50000 + Math.random() * 20000) * dateVariation),
          expense: Math.round((20000 + Math.random() * 10000) * dateVariation)
        });
      }
      totalIncome = Math.round(550000 * dateVariation);
      totalExpense = Math.round(250000 * dateVariation);
    } else {
      // Generate data for all months in year
      chartData = monthsShort.map((month, i) => ({
        month,
        income: Math.round((45000 + i * 2500) * dateVariation),
        expense: Math.round((20000 + i * 1000) * dateVariation)
      }));
      totalIncome = Math.round(700000 * dateVariation);
      totalExpense = Math.round(300000 * dateVariation);
    }
    const profit = totalIncome - totalExpense;
    const profitPercentage = Math.round(2 * dateVariation);
    const basePendingPayments = [{
      id: 1,
      company: 'ช่องตรวม',
      baseAmount: 13000
    }, {
      id: 2,
      company: 'ไอเดียพลัส จำกัดมหาชน',
      baseAmount: 5000
    }, {
      id: 3,
      company: 'ไทยพีเอ็ม มารเก็ตเดอร์ จำกัด',
      baseAmount: 3000
    }, {
      id: 4,
      company: 'สเซริเดกในไอเอ จำกัด',
      baseAmount: 5000
    }];
    const pendingPayments = basePendingPayments.map(p => ({
      id: p.id,
      company: p.company,
      amount: Math.round(p.baseAmount * dateVariation)
    }));
    return {
      chartData,
      totalIncome,
      totalExpense,
      profit,
      profitPercentage,
      pendingPayments
    };
  }, [selectedDate, timePeriod, monthsShort]);
  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-10 shadow-md">
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
                <p className="text-lg font-bold truncate text-[#118841]">{profit.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Divider */}
            <div className="w-px h-12 bg-gray-300 mx-2 flex-shrink-0"></div>
            
            {/* Expenses Section */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <img src={expensesIcon} alt="Expenses" className="w-12 h-12 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">{t('finance.expenses')}</p>
                <p className="text-lg font-bold truncate text-destructive">{totalExpense.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Profit Info + Chart Combined */}
        <Card key={`chart-${timePeriod}-${selectedDate.getTime()}`} className="p-4 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              <p className="text-xs text-gray-600">{t('finance.total_income')}</p>
              <p className="text-lg font-bold text-[#0a8576]">{profit.toLocaleString()}</p>
              <span className="text-xs font-medium text-[#118841]">
                ▲{profitPercentage}%
              </span>
            </div>
            <p className="text-xs text-gray-500 flex-shrink-0">{t('finance.compare_year')}</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{
              fontSize: 12
            }} />
              <YAxis tick={{
              fontSize: 12
            }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name={t('finance.income')} />
              <Line type="monotone" dataKey="expense" stroke="#374151" strokeWidth={2} name={t('finance.expenses')} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Pending Payments */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#153860]">{t('finance.pending_payments')}</h3>
            <span className="text-sm text-gray-500">3 {t('finance.companies')}</span>
          </div>
          <div className="space-y-2">
            {pendingPayments.map((payment, index) => <div key={payment.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-blue-900 text-white' : 'bg-gray-50'}`}>
                <span className={`text-sm ${index === 0 ? 'text-white' : 'text-gray-700'}`}>
                  {payment.company}
                </span>
                <span className={`font-bold ${index === 0 ? 'text-white' : 'text-gray-900'}`}>
                  ฿ {payment.amount.toLocaleString()}
                </span>
              </div>)}
          </div>
        </Card>
      </div>
    </div>;
}