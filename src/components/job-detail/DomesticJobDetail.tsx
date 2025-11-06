import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, CheckCircle, Circle } from 'lucide-react';
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
}
export default function DomesticJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate
}: DomesticJobDetailProps) {
  const navigate = useNavigate();
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState({
    card1: 0,
    card2: 0
  });
  useEffect(() => {
    // Calculate card heights for step positioning
    if (card1Ref.current && card2Ref.current) {
      setCardHeights({
        card1: card1Ref.current.offsetHeight,
        card2: card2Ref.current.offsetHeight
      });
    }
  }, [jobApplication]);
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  const handleStartJob = async () => {
    const {
      error
    } = await supabase.from('job_applications').update({
      job_started_at: new Date().toISOString(),
      status: 'job_started'
    }).eq('job_id', job.id).eq('driver_id', userId);
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
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/current-jobs')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">{job.order_code}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="secondary" className="text-white text-xs bg-blue-500">
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

        {/* Route Info */}
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">
              Booking : {job.order_code}
            </h2>
            <p className="text-base font-medium text-foreground">
              ผู้จ้าง : {job.employer_name}
            </p>
          </div>

          {/* Step Tracker + Content Wrapper */}
          <div className="relative flex gap-3">
            {/* Left Timeline Column with Continuous Line */}
            <div className="relative flex flex-col" style={{
            width: '28px',
            paddingTop: '8px'
          }}>
              {/* Continuous Vertical Line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5" style={{
              top: '8px',
              height: `calc(100% - 16px)`,
              background: jobApplication?.delivery_sop_completed_at ? '#ef4444' : jobApplication?.sop_completed_at ? `linear-gradient(to bottom, #ef4444 0%, #ef4444 ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2) * 100 : 50}%, #d1d5db ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2) * 100 : 50}%, #d1d5db 100%)` : '#d1d5db'
            }} />
              
              {/* Step 1 Circle - Pickup Point */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />}
                </div>
              </div>

              {/* Step 2 Circle - Delivery Point */}
              <div className="relative flex justify-center" style={{
              height: `${cardHeights.card2 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.delivery_sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Pickup Point Card */}
              <Card ref={card1Ref} className={`p-4 border-2 rounded-2xl ${jobApplication?.sop_completed_at ? 'border-green-500 bg-green-50' : 'border-teal-500 bg-white'}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดรับสินค้า</h3>
                    <span className={`text-xs font-medium ${jobApplication?.sop_completed_at ? 'text-green-600' : jobApplication?.checked_in_at ? 'text-orange-500' : 'text-orange-500'}`}>
                      • {jobApplication?.sop_completed_at ? 'SOP สำเร็จ' : jobApplication?.checked_in_at ? 'รอ SOP' : 'รอเช็คอิน'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {job.origin_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                      <span>: คุณณัฏฐพงศ์</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ตำแหน่ง</span>
                      <span>: เจ้าหน้าที่คลังสินค้า</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                      <span>: น้ำตาล (10 กล่อง)</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">เข้ารับสินค้า</span>
                      <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                      <span>: เข้าสถานที่ต้องแสดงบัตรชิด</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-10">
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button variant="outline" size="sm" className="h-10">
                      <Navigation className="w-4 h-4" />
                      เส้นทาง
                    </Button>
                    <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => {
                    if (jobApplication?.sop_completed_at) {
                      navigate(`/job/${job.id}/pickup-summary`);
                    } else if (jobApplication?.checked_in_at) {
                      navigate(`/job/${job.id}/sop`);
                    } else {
                      navigate(`/job/${job.id}/pickup`);
                    }
                  }}>
                      {jobApplication?.sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Delivery Point Card */}
              <Card ref={card2Ref} className={`p-4 border-2 rounded-2xl ${jobApplication?.delivery_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.job_started_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.job_started_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดส่งสินค้า</h3>
                    {jobApplication?.job_started_at && <span className={`text-xs font-medium ${jobApplication?.delivery_sop_completed_at ? 'text-green-600' : 'text-orange-500'}`}>
                        • {jobApplication?.delivery_sop_completed_at ? 'POD สำเร็จ' : 'รอเช็คอิน'}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {job.destination_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                      <span>: คุณธงใบย</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                      <span>: น้ำตาล (10 กล่อง)</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">ส่งสินค้า</span>
                      <span>: {formatDate(job.start_date)} | 11:00</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                      <span>: -</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.job_started_at}>
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.job_started_at}>
                      <Navigation className="w-4 h-4" />
                      เส้นทาง
                    </Button>
                    <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/job/${job.id}/delivery`)} disabled={!jobApplication?.job_started_at}>
                      {jobApplication?.delivery_sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button className={`w-full h-12 text-base ${jobApplication?.sop_completed_at ? 'text-white' : 'text-gray-500 cursor-not-allowed'}`} style={jobApplication?.sop_completed_at ? {
        background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
      } : {
        background: '#E5E7EB'
      }} onClick={handleStartJob} disabled={!jobApplication?.sop_completed_at}>
            เริ่มงาน
          </Button>
        </div>}
    </div>;
}