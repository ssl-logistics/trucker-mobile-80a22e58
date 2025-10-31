import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

export default function CustomerPage() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const getDisplayDate = () => {
    const day = selectedDate.getDate();
    const month = thaiMonths[selectedDate.getMonth()];
    const year = selectedDate.getFullYear() + 543;

    if (timePeriod === 'day') {
      return `${day} ${month} ${year}`;
    } else if (timePeriod === 'month') {
      return `${month} ${year}`;
    } else {
      return `พ.ศ. ${year}`;
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

    // Date-based variation
    const dateHash = selectedDate.getTime() % 100;
    const dateVariation = 1 + (dateHash / 100);

    const finalMultiplier = timeMultiplier * dateVariation;

    const baseCustomers = [
      { name: 'ปริกเก่า วงศ์ชัย', baseJobs: 30, baseAmount: 30000, avatar: '👤', color: '#10b981' },
      { name: 'ธนพันธ์ ศรีธัต', baseJobs: 25, baseAmount: 20000, avatar: '👤', color: '#1e40af' },
      { name: 'อรษมุ วิชัย', baseJobs: 20, baseAmount: 15000, avatar: '👤', color: '#7c3aed' },
      { name: 'พีชัยชัย สุนกี', baseJobs: 15, baseAmount: 5000, avatar: '👤', color: '#06b6d4' },
      { name: 'ขนมริป สุนเสอง', baseJobs: 10, baseAmount: 3000, avatar: '👤', color: '#f59e0b' },
    ];

    const pieData = baseCustomers.map(c => ({
      name: c.name,
      value: Math.round(c.baseJobs * finalMultiplier),
      color: c.color
    }));

    const customerDetails = baseCustomers.map(c => ({
      name: c.name,
      jobs: Math.round(c.baseJobs * finalMultiplier),
      amount: Math.round(c.baseAmount * finalMultiplier),
      avatar: c.avatar
    }));

    return { pieData, customerDetails };
  };

  const { pieData, customerDetails } = getFilteredData();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">ลูกค้า</h1>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Time Period Tabs */}
        <Tabs value={timePeriod} onValueChange={setTimePeriod} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm">
            <TabsTrigger value="day">วัน</TabsTrigger>
            <TabsTrigger value="month">เดือน</TabsTrigger>
            <TabsTrigger value="year">ปี</TabsTrigger>
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

        {/* Pie Chart */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">ลูกค้า</h3>
            <span className="text-sm text-gray-500">5 อันดับสูงสุด</span>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => entry.value}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span className="text-xs text-gray-700">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Customer List */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="space-y-3">
            {customerDetails.map((customer, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                  {customer.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{customer.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{customer.jobs} งาน</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">฿ {customer.amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
