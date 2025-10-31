import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ShippingPage() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('month');
  const [vehicleType, setVehicleType] = useState('all');
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

  // Mock data
  const jobStats = [
    { label: 'งานทั้งหมด', value: 300, change: 2, icon: '📦' },
    { label: 'สำเร็จ', value: 299, change: 2, icon: '✅' },
    { label: 'กำลังจัดส่ง', value: 1, change: 2, icon: '🚚' },
    { label: 'ยกเลิก', value: 2, change: 2, icon: '❌' },
  ];

  const regionStats = [
    { region: 'ภาคเหนือ', value: 300, change: 2 },
    { region: 'ภาคกลาง', value: 300, change: 2 },
    { region: 'ภาคอีสาน', value: 300, change: 2 },
    { region: 'ภาคตะวันออก', value: 300, change: 2 },
    { region: 'ภาคตะวันตก', value: 300, change: 2 },
    { region: 'ภาคใต้', value: 300, change: 2 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">การจัดส่ง</h1>
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

        {/* Vehicle Type Dropdown */}
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger className="w-full bg-white shadow-sm border-2 border-primary">
            <SelectValue placeholder="ทุกประเภทการขนส่ง" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">ทุกประเภทการขนส่ง</SelectItem>
            <SelectItem value="หัวลาก">หัวลาก</SelectItem>
            <SelectItem value="12ล้อ">12 ล้อ</SelectItem>
            <SelectItem value="10ล้อ">10 ล้อ</SelectItem>
            <SelectItem value="6ล้อ">6 ล้อ</SelectItem>
            <SelectItem value="4ล้อ">4 ล้อ</SelectItem>
          </SelectContent>
        </Select>

        {/* Job Stats */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">ข้อมูลงานจัดส่ง</h3>
            <span className="text-xs text-gray-500">เปรียบเทียบกับปี: 2566</span>
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
            <h3 className="font-bold text-gray-800">การขนส่งแต่ละภาค</h3>
            <span className="text-xs text-gray-500">เปรียบเทียบกับปี: 2566</span>
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
