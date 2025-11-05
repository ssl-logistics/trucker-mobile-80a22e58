import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, CheckCircle, Circle, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';

interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  price: number;
  start_date: string;
  start_time: string;
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_bill_of_lading: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_contact_person: string | null;
  destination_bill_of_lading: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_time: string | null;
  destination_remarks: string | null;
}

interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  status: string;
}

interface DomesticJobDetailProps {
  job: JobDetail;
  jobApplication: JobApplication | null;
  userId: string;
  onUpdate: () => void;
  openExpensesTab?: boolean;
}

export default function DomesticJobDetail({ job, jobApplication, userId, onUpdate, openExpensesTab }: DomesticJobDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(openExpensesTab ? 'expenses' : 'route');

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleStartJob = async () => {
    const { error } = await supabase
      .from('job_applications')
      .update({ 
        job_started_at: new Date().toISOString(),
        status: 'job_started'
      })
      .eq('job_id', job.id)
      .eq('driver_id', userId);

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเริ่มงานได้',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'เริ่มงานสำเร็จ',
        description: 'คุณสามารถทำงานส่งของได้แล้ว'
      });
      onUpdate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/current-jobs')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">{job.order_code}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
                ขนส่งภายในประเทศ
              </Badge>
            </div>
          </div>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-teal-600">฿ {job.price.toLocaleString()}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-sm text-muted-foreground">จุดรับ/ส่ง</div>
            <div className="text-lg font-semibold">2</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-sm text-muted-foreground">สินค้ารวม</div>
            <div className="text-lg font-semibold">10</div>
          </Card>
        </div>

        {/* Payment Status */}
        {jobApplication?.status !== 'pending' && (
          <div className={`p-3 rounded-lg text-center font-medium ${
            jobApplication?.status === 'payment_completed' 
              ? 'bg-green-50 text-green-700' 
              : 'bg-gray-50 text-gray-700'
          }`}>
            • {jobApplication?.status === 'payment_completed' ? 'ชำระแล้ว' : 'รอชำระ'}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="route">เส้นทาง</TabsTrigger>
            <TabsTrigger value="expenses">ค่าใช้จ่าย</TabsTrigger>
          </TabsList>

          {/* Route Tab */}
          <TabsContent value="route" className="space-y-4">
            <div className="mb-3">
              <h2 className="text-lg font-semibold">
                ผู้จ้าง : {job.employer_name}
              </h2>
              <p className="text-base font-medium text-foreground">
                เลขที่ : {job.order_code}
              </p>
            </div>

            {/* Pickup Point */}
            <Card className={`p-4 mb-3 border-2 rounded-2xl ${
              jobApplication?.sop_completed_at
                ? 'border-green-500 bg-green-50'
                : 'border-teal-500 bg-white'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  {jobApplication?.sop_completed_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-teal-600" />
                  )}
                  <div className="w-0.5 h-full border-l-2 border-dashed border-gray-300 my-1" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดรับสินค้า {job.origin_bill_of_lading || 'Factory1'}</h3>
                    <span className={`text-xs font-medium ${
                      jobApplication?.sop_completed_at 
                        ? 'text-green-600' 
                        : jobApplication?.checked_in_at
                        ? 'text-orange-500'
                        : 'text-orange-500'
                    }`}>
                      • {jobApplication?.sop_completed_at 
                        ? 'SOP สำเร็จ' 
                        : jobApplication?.checked_in_at
                        ? 'รอ SOP'
                        : 'รอเช็คอิน'}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                      <span>: {job.origin_contact_person || 'คุณณัฏฐพงศ์'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ตำแหน่ง</span>
                      <span>: {job.origin_contact_role || 'เจ้าหน้าที่คลังสินค้า'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อสินค้า</span>
                      <span>: {job.origin_goods_type || 'คุณณัฏฐพงศ์ (เข้ามาที่กลังสินค้า)'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">เลขที่</span>
                      <span>: {job.order_code} สากพรา/</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]"></span>
                      <span>กรุงเทพมหานคร</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                      <span>: น้ำตาล (30 กล่อง)</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">เข้ารับสินค้า</span>
                      <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                      <span>: {job.origin_remarks || 'เข้าสถานที่ต้องแสดงบัตรชิด'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10"
                    >
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10"
                    >
                      <Navigation className="w-4 h-4" />
                      เส้นทาง
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        if (jobApplication?.sop_completed_at) {
                          navigate(`/job/${job.id}/pickup-summary`);
                        } else if (jobApplication?.checked_in_at) {
                          navigate(`/job/${job.id}/sop`);
                        } else {
                          navigate(`/job/${job.id}/pickup`);
                        }
                      }}
                    >
                      {jobApplication?.sop_completed_at 
                        ? 'ดูข้อมูล' 
                        : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Delivery Point */}
            <Card className={`p-4 border-2 rounded-2xl ${
              jobApplication?.delivery_sop_completed_at
                ? 'border-green-500 bg-green-50'
                : jobApplication?.job_started_at
                ? 'border-teal-500 bg-white' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  {jobApplication?.delivery_sop_completed_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                  ) : jobApplication?.job_started_at ? (
                    <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-teal-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                
                <div className={`flex-1 ${!jobApplication?.job_started_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดส่ง {job.destination_bill_of_lading || 'หอก.ชยันตา'}</h3>
                    {jobApplication?.job_started_at && (
                      <span className={`text-xs font-medium ${
                        jobApplication?.delivery_sop_completed_at 
                          ? 'text-green-600' 
                          : 'text-orange-500'
                      }`}>
                        • {jobApplication?.delivery_sop_completed_at 
                          ? 'POD สำเร็จ' 
                          : 'รอเช็คอิน'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                      <span>: {job.destination_contact_person || 'คุณธงใบย'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">เลขที่</span>
                      <span>: {job.order_code} เมือง/สมุทรปราการ</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                      <span>: น้ำตาล (10 กล่อง)</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ส่งสินค้า</span>
                      <span>: {formatDate(job.start_date)} | {job.destination_time?.substring(0, 5) || '11:00'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                      <span>: {job.destination_remarks || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10" 
                      disabled={!jobApplication?.job_started_at}
                    >
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10" 
                      disabled={!jobApplication?.job_started_at}
                    >
                      <Navigation className="w-4 h-4" />
                      เส้นทาง
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                      onClick={() => navigate(`/job/${job.id}/delivery`)}
                      disabled={!jobApplication?.job_started_at}
                    >
                      {jobApplication?.delivery_sop_completed_at 
                        ? 'ดูข้อมูล' 
                        : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Additional destinations if any */}
            <Card className="p-4 border-2 rounded-2xl border-green-500 bg-green-50">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดส่ง โรงงานน้ำตาลทรายรุ่งเรือง</h3>
                    <span className="text-xs font-medium text-green-600">
                      • POD สำเร็จ
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                      <span>: คุณศรุณ แสงทอง</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">เลขที่</span>
                      <span>: {job.order_code} เมือง/สมุทรปราการ</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                      <span>: น้ำตาล (10 กล่อง)</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ส่งสินค้า</span>
                      <span>: {formatDate(job.start_date)} | 14:00</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10"
                    >
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10"
                    >
                      <Navigation className="w-4 h-4" />
                      เส้นทาง
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                    >
                      ดูข้อมูล
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">ค่าใช้จ่าย</h2>
              <Button
                size="sm"
                onClick={() => navigate(`/job/${job.id}/add-expense`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มค่าใช้จ่าย
              </Button>
            </div>

            <div className="text-center py-12 text-muted-foreground">
              <p>ยังไม่มีข้อมูลค่าใช้จ่าย</p>
              <p className="text-sm mt-2">กดปุ่ม "เพิ่มค่าใช้จ่าย" เพื่อเพิ่มข้อมูล</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            className={`w-full h-12 text-base ${
              jobApplication?.sop_completed_at 
                ? 'text-white' 
                : 'text-gray-500 cursor-not-allowed'
            }`}
            style={jobApplication?.sop_completed_at ? {
              background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
            } : {
              background: '#E5E7EB'
            }}
            onClick={handleStartJob}
            disabled={!jobApplication?.sop_completed_at}
          >
            เริ่มงาน
          </Button>
        </div>
      )}
    </div>
  );
}
