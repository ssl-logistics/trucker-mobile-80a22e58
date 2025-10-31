import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

export default function ProductPage() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('year');

  // Mock data
  const pieData = [
    { name: 'ไม้แปรรูป', value: 25, color: '#1e40af' },
    { name: 'อาหารแปรรูป', value: 20, color: '#7c3aed' },
    { name: 'อาหารสด', value: 15, color: '#06b6d4' },
    { name: 'เครื่องจักร', value: 10, color: '#f59e0b' },
    { name: 'เครื่องบุ่งห้ม', value: 30, color: '#10b981' },
  ];

  const productDetails = [
    { name: 'เครื่องบุ่งห้ม', jobs: 30, amount: 30000 },
    { name: 'ไม้แปรรูป', jobs: 25, amount: 20000 },
    { name: 'อาหารแปรรูป', jobs: 20, amount: 15000 },
    { name: 'อาหารสด', jobs: 15, amount: 5000 },
    { name: 'เครื่องจักร', jobs: 10, amount: 3000 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">สินค้า</h1>
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
            <h3 className="font-bold text-gray-800">ประเภทสินค้า</h3>
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

        {/* Product List */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="space-y-3">
            {productDetails.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <p className="font-medium text-gray-800">{product.name}</p>
                <div className="flex items-center gap-8">
                  <p className="text-sm font-bold text-primary">{product.jobs} งาน</p>
                  <p className="text-sm font-bold text-gray-900">฿ {product.amount.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
