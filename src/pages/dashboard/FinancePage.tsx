import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function FinancePage() {
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState('month');

  // Mock data
  const chartData = [
    { month: 'ม.ค.', income: 45000, expense: 20000 },
    { month: 'ก.พ.', income: 52000, expense: 25000 },
    { month: 'มี.ค.', income: 48000, expense: 22000 },
    { month: 'เม.ย.', income: 61000, expense: 28000 },
    { month: 'พ.ค.', income: 55000, expense: 24000 },
    { month: 'มิ.ย.', income: 67000, expense: 30000 },
    { month: 'ก.ค.', income: 59000, expense: 26000 },
    { month: 'ส.ค.', income: 71000, expense: 32000 },
    { month: 'ก.ย.', income: 64000, expense: 29000 },
    { month: 'ต.ค.', income: 58000, expense: 27000 },
    { month: 'พ.ย.', income: 70000, expense: 31000 },
    { month: 'ธ.ค.', income: 75000, expense: 33000 },
  ];

  const pendingPayments = [
    { id: 1, company: 'ช่องตรวม', amount: 13000 },
    { id: 2, company: 'ไอเดียพลัส จำกัดมหาชน', amount: 5000 },
    { id: 3, company: 'ไทยพีเอ็ม มารเก็ตเดอร์ จำกัด', amount: 3000 },
    { id: 4, company: 'สเซริเดกในไอเอ จำกัด', amount: 5000 },
  ];

  const totalIncome = 70000;
  const totalExpense = 10000;
  const profit = totalIncome - totalExpense;
  const profitPercentage = 2;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">การเงิน</h1>
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600">กำไร</p>
                <p className="text-2xl font-bold text-green-600">{profit.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600">ค่าใช้จ่าย</p>
                <p className="text-2xl font-bold text-red-600">{totalExpense.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Profit Info */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-600">รายได้ทั้งหมด</p>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <span>▲{profitPercentage}%</span>
            </span>
          </div>
          <p className="text-2xl font-bold text-primary">{profit.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">เปรียบเทียบกับปี: 2566</p>
        </Card>

        {/* Chart */}
        <Card className="p-4 bg-white shadow-sm">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="รายได้" />
              <Line type="monotone" dataKey="expense" stroke="#374151" strokeWidth={2} name="ค่าใช้จ่าย" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Pending Payments */}
        <Card className="p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">รายได้ค้างชำระ</h3>
            <span className="text-sm text-gray-500">3 บริษัท</span>
          </div>
          <div className="space-y-2">
            {pendingPayments.map((payment, index) => (
              <div
                key={payment.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-blue-900 text-white' : 'bg-gray-50'
                }`}
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
      </div>
    </div>
  );
}
