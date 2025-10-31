import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

export default function CustomerPage() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('month');

  // Mock data
  const pieData = [
    { name: 'ธนพันธ์ ศรีธัต', value: 25, color: '#1e40af' },
    { name: 'อรษมุ วิชัย', value: 20, color: '#7c3aed' },
    { name: 'พีชัยชัย สุนกี', value: 15, color: '#06b6d4' },
    { name: 'ขนมริป สุนเสอง', value: 10, color: '#f59e0b' },
    { name: 'ปริกเก่า วงศ์ชัย', value: 30, color: '#10b981' },
  ];

  const customerDetails = [
    { name: 'ปริกเก่า วงศ์ชัย', jobs: 30, amount: 30000, avatar: '👤' },
    { name: 'ธนพันธ์ ศรีธัต', jobs: 25, amount: 20000, avatar: '👤' },
    { name: 'อรษมุ วิชัย', jobs: 20, amount: 15000, avatar: '👤' },
    { name: 'พีชัยชัย สุนกี', jobs: 15, amount: 5000, avatar: '👤' },
    { name: 'ขนมริป สุนเสอง', jobs: 10, amount: 3000, avatar: '👤' },
  ];

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
          <button className="p-2 hover:bg-accent rounded-full transition-colors">
            <span className="text-2xl">{'<'}</span>
          </button>
          <span className="text-xl font-bold text-primary">พ.ศ.2567</span>
          <button className="p-2 hover:bg-accent rounded-full transition-colors">
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
