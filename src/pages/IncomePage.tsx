import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function IncomePage() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Mock data - replace with actual data from Supabase
  const incomeData = {
    paid: [
      {
        id: 1,
        jobId: 'job-uuid-1', // Replace with actual job ID from database
        jobTitle: 'ไทยพีเอ็ม ชาร์เตอร์ จำกัด',
        employer: 'ไทยพีเอ็ม ชาร์เตอร์',
        amount: 3000,
        status: 'paid',
        date: '15/08/2025',
        month: 'มกราคม'
      },
      {
        id: 2,
        jobId: 'job-uuid-2', // Replace with actual job ID from database
        jobTitle: 'ซีพี ออลล์ จำกัดมหาชน',
        employer: 'ซีพี ออลล์',
        amount: 2000,
        status: 'paid',
        date: '14/08/2025',
        month: 'มกราคม'
      }
    ],
    unpaid: [
      {
        id: 3,
        jobId: 'job-uuid-3', // Replace with actual job ID from database
        jobTitle: 'ไทยพีเอ็ม ชาร์เตอร์ จำกัด',
        employer: 'ไทยพีเอ็ม ชาร์เตอร์',
        amount: 3000,
        status: 'pending',
        date: '16/08/2025',
        month: 'กุมภาพันธ์'
      }
    ]
  };

  const handleViewJobDetail = (jobId: string) => {
    navigate(`/job/${jobId}`, { state: { openExpensesTab: true } });
  };

  const allIncome = [...incomeData.paid, ...incomeData.unpaid];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/home')} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">รายได้ของฉัน</h1>
        </div>
      </header>

      <div className="px-4 pt-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
            <TabsTrigger value="paid">ชำระแล้ว</TabsTrigger>
            <TabsTrigger value="unpaid">ยังไม่ชำระ</TabsTrigger>
          </TabsList>

          {/* Month Filter */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full mb-4">
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเดือน</SelectItem>
              <SelectItem value="jan">มกราคม</SelectItem>
              <SelectItem value="feb">กุมภาพันธ์</SelectItem>
              <SelectItem value="mar">มีนาคม</SelectItem>
            </SelectContent>
          </Select>

          {/* All Tab */}
          <TabsContent value="all" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-2">มกราคม</div>
            {incomeData.paid.map((income) => (
              <Card key={income.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                    {income.status === 'paid' && (
                      <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-600 rounded-full" />
                      </div>
                    )}
                    ฿ {income.amount.toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => handleViewJobDetail(income.jobId)}
                  className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  ดูข้อมูลงาน
                </button>
              </Card>
            ))}

            <div className="text-sm text-muted-foreground mb-2 mt-6">กุมภาพันธ์</div>
            {incomeData.unpaid.map((income) => (
              <Card key={income.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                      <Receipt className="w-3 h-3" />
                    </div>
                    ฿ {income.amount.toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => handleViewJobDetail(income.jobId)}
                  className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  ดูข้อมูลงาน
                </button>
              </Card>
            ))}
          </TabsContent>

          {/* Paid Tab */}
          <TabsContent value="paid" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-2">มกราคม</div>
            {incomeData.paid.map((income) => (
              <Card key={income.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                    <div className="w-5 h-5 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                    </div>
                    ฿ {income.amount.toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => handleViewJobDetail(income.jobId)}
                  className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  ดูข้อมูลงาน
                </button>
              </Card>
            ))}
          </TabsContent>

          {/* Unpaid Tab */}
          <TabsContent value="unpaid" className="space-y-4">
            <div className="text-sm text-muted-foreground mb-2">กุมภาพันธ์</div>
            {incomeData.unpaid.map((income) => (
              <Card key={income.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-1">{income.jobTitle}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
                      <Receipt className="w-3 h-3" />
                    </div>
                    ฿ {income.amount.toLocaleString()}
                  </div>
                </div>
                <button 
                  onClick={() => handleViewJobDetail(income.jobId)}
                  className="w-full py-2.5 border-2 border-foreground rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  ดูข้อมูลงาน
                </button>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
