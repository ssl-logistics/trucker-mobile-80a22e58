import { useState, useRef, useEffect } from 'react';
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
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  empty_container_date: string | null;
  destination_time: string | null;
}
interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  container_checked_in_at: string | null;
  container_sop_completed_at: string | null;
  status: string;
}
interface InternationalJobDetailProps {
  job: JobDetail;
  jobApplication: JobApplication | null;
  userId: string;
  onUpdate: () => void;
}
export default function InternationalJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate
}: InternationalJobDetailProps) {
  const navigate = useNavigate();
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState({
    card1: 0,
    card2: 0,
    card3: 0
  });
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');
  useEffect(() => {
    // Calculate card heights for step positioning
    if (card1Ref.current && card2Ref.current && card3Ref.current) {
      setCardHeights({
        card1: card1Ref.current.offsetHeight,
        card2: card2Ref.current.offsetHeight,
        card3: card3Ref.current.offsetHeight
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
        description: 'คุณสามารถเริ่มตรวจตู้เปล่าได้แล้ว'
      });
      onUpdate();
    }
  };
  const mockContainerData = {
    checkpoint: job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย',
    checkpointCode: job.container_checkpoint_code || 'LCB B1',
    emptyDate: job.empty_container_date || '2023-11-02',
    containers: [{
      number: 'TGHU4455667',
      seal: 'SEAL556677'
    }, {
      number: 'CAIU9988776',
      seal: 'SEAL112233'
    }]
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
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-white text-xs bg-blue-600">
                ขนส่งภายนอกประเทศ
              </Badge>
              {isInbound && <Badge variant="secondary" className="bg-blue-500/80 text-white hover:bg-blue-600/80 text-xs">
                  ขาเข้า
                </Badge>}
              {isOutbound && <Badge variant="secondary" className="bg-orange-500/80 text-white hover:bg-orange-600/80 text-xs">
                  ขาออก
                </Badge>}
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
            <div className="text-lg font-semibold">4</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-sm text-muted-foreground">สินค้ารวม</div>
            <div className="text-lg font-semibold">60</div>
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
              background: jobApplication?.delivery_sop_completed_at ? '#ef4444' : jobApplication?.sop_completed_at ? `linear-gradient(to bottom, #ef4444 0%, #ef4444 ${cardHeights.card1 + cardHeights.card2 > 0 ? (cardHeights.card1 + 12 + cardHeights.card2 / 2) / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 66}%, #d1d5db ${cardHeights.card1 + cardHeights.card2 > 0 ? (cardHeights.card1 + 12 + cardHeights.card2 / 2) / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 66}%, #d1d5db 100%)` : jobApplication?.container_sop_completed_at ? `linear-gradient(to bottom, #ef4444 0%, #ef4444 ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 33}%, #d1d5db ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 33}%, #d1d5db 100%)` : '#d1d5db'
            }} />
              
              {/* Step 1 Circle - Container Checkpoint */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.container_sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.job_started_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>

              {/* Step 2 Circle - Pickup/Loading Point */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card2 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.container_sop_completed_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>

              {/* Step 3 Circle - Delivery/Return Point */}
              <div className="relative flex justify-center" style={{
              height: `${cardHeights.card3 || 200}px`
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
              {/* Container Checkpoint Card */}
              <Card ref={card1Ref} className={`p-4 border-2 ${jobApplication?.container_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.job_started_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.job_started_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">จุดรับตู้เปล่า</h3>
                    {jobApplication?.job_started_at && <span className={`text-xs font-medium ${jobApplication?.container_sop_completed_at ? 'text-green-600' : jobApplication?.container_checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.container_sop_completed_at ? 'รับตู้เปล่าสำเร็จ' : jobApplication?.container_checked_in_at ? 'รอรับตู้เปล่า' : 'รอเช็คอิน'}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {mockContainerData.checkpoint}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">วัน/เวลาเริ่มต้น</span>
                      <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">วันรับเข้าช่างต้นต้น</span>
                      <span>: {formatDate(mockContainerData.emptyDate)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">ผู้รับสินค้า</span>
                      <span>: {isInbound ? 'บริษัท โซเดคซ์ จำกัด' : 'BKK001 ลาดพร้าว/กรุงเทพมหานคร'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">วันคนเทนเนอร์</span>
                      <span>: {isInbound ? 'FCL 2 x 40 HC' : mockContainerData.checkpointCode}</span>
                    </div>
                    
                    {/* Container Pairs - Only for Inbound */}
                    {isInbound && <>
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mt-2">
                          <div className="flex items-start gap-2">
                            <div className="bg-teal-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              1
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start">
                                <span className="text-muted-foreground text-xs min-w-[130px]">เลขตู้คอนเทนเนอร์</span>
                                <span className="text-xs font-medium">: {mockContainerData.containers[0].number}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-muted-foreground text-xs min-w-[130px]">เลขซีล</span>
                                <span className="text-xs font-medium">: {mockContainerData.containers[0].seal}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <div className="bg-teal-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              2
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-start">
                                <span className="text-muted-foreground text-xs min-w-[130px]">เลขตู้คอนเทนเนอร์</span>
                                <span className="text-xs font-medium">: {mockContainerData.containers[1].number}</span>
                              </div>
                              <div className="flex items-start">
                                <span className="text-muted-foreground text-xs min-w-[130px]">เลขซีล</span>
                                <span className="text-xs font-medium">: {mockContainerData.containers[1].seal}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.job_started_at || jobApplication?.container_sop_completed_at !== null}>
                      <Navigation className="w-4 h-4 mr-1" />
                      เส้นทาง
                    </Button>
                    <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" disabled={!jobApplication?.job_started_at} onClick={() => {
                    if (jobApplication?.container_sop_completed_at) {
                      navigate(`/job/${job.id}/container-summary`);
                    } else if (jobApplication?.container_checked_in_at) {
                      navigate(`/job/${job.id}/container-sop`);
                    } else {
                      navigate(`/job/${job.id}/container-checkin`);
                    }
                  }}>
                      {jobApplication?.container_sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Pickup/Loading Point Card */}
              <Card ref={card2Ref} className={`p-4 border-2 ${jobApplication?.sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.container_sop_completed_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.container_sop_completed_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      {isInbound ? 'จุดส่งสินค้า' : 'จุดรับสินค้า'}
                    </h3>
                    {jobApplication?.container_sop_completed_at && <span className={`text-xs font-medium ${jobApplication?.sop_completed_at ? 'text-green-600' : jobApplication?.checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.sop_completed_at ? 'SOP สำเร็จ' : jobApplication?.checked_in_at ? 'รอ SOP' : 'รอเช็คอิน'}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {isInbound ? 'คลังสินค้าทางบก, สมุทรปราการ' : job.origin_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เลขที่เอียด' : 'ชื่อผู้ติดต่อ'}</span>
                      <span>: {isInbound ? '123456789012345' : 'คุณณัฏฐพงศ์'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'ชื่อจุดติดต่อ' : 'ตำแหน่ง'}</span>
                      <span>: {isInbound ? 'คลังภัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)' : 'เจ้าหน้าที่คลังสินค้า'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เส้นทาง' : 'เลขทาง'}</span>
                      <span>: {isInbound ? 'SAM001 ลาดพร้าว, กรุงเทพมหานคร' : 'BKK001 ลาดพร้าว/กรุงเทพมหานคร'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เข้าส่งสินค้า' : 'ประเภทสินค้า'}</span>
                      <span>: {isInbound ? `${formatDate(job.start_date)} | 20:00` : 'น้ำตาล (10 กล่อง)'}</span>
                    </div>
                    {isInbound && <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                        <span>: เข้าสถานที่ต้องแสดงบัตรชิด</span>
                      </div>}
                    {!isInbound && <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">เข้ารับสินค้า</span>
                          <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                          <span>: เข้าสถานที่ต้องแสดงบัตรชิด</span>
                        </div>
                      </>}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.container_sop_completed_at}>
                      <Phone className="w-4 h-4" />
                      โทร
                    </Button>
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.container_sop_completed_at}>
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
                  }} disabled={!jobApplication?.container_sop_completed_at}>
                      {jobApplication?.sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Delivery/Return Point Card */}
              <Card ref={card3Ref} className={`p-4 border-2 ${jobApplication?.delivery_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.delivery_checked_in_at ? 'border-blue-500 bg-blue-50' : jobApplication?.sop_completed_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.sop_completed_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      {isInbound ? 'จุดคืนตู้เปล่า' : 'จุดคืนตู้เต็ม'}
                    </h3>
                    {jobApplication?.sop_completed_at && <span className={`text-xs font-medium ${jobApplication?.delivery_sop_completed_at ? 'text-green-600' : jobApplication?.delivery_checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.delivery_sop_completed_at ? 'ส่งคืนสำเร็จ' : jobApplication?.delivery_checked_in_at ? 'รอส่งคืน' : 'รอเช็คอิน'}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {isInbound ? 'ICD ลาดกระบัง' : job.destination_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    {isInbound ? <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">วันที่หมดคืนตู้เปล่า</span>
                          <span>: 03/11/2025 | 20:00</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">ผู้รับรอง</span>
                          <span>: บริษัท เอราวา เอรารา จำกัด</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">หมายเหตุ</span>
                          <span>: ต้องคืนตู้ก่อนนัดต้องถูดมา Detention</span>
                        </div>
                      </> : <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">วันคืนตู้คอนเทนเนอร์</span>
                          <span>: {formatDate(job.start_date)} | {job.destination_time || '20:00'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">ผู้รับรอง</span>
                          <span>: {job.employer_name}</span>
                        </div>
                      </>}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {isInbound ? <>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Phone className="w-4 h-4" />
                          โทร
                        </Button>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Navigation className="w-4 h-4" />
                          เส้นทาง
                        </Button>
                        <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/job/${job.id}/delivery`)} disabled={!jobApplication?.sop_completed_at}>
                          {jobApplication?.delivery_sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                        </Button>
                      </> : <>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Navigation className="w-4 h-4 mr-1" />
                          เส้นทาง
                        </Button>
                        <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/job/${job.id}/delivery`)} disabled={!jobApplication?.sop_completed_at}>
                          {jobApplication?.delivery_sop_completed_at ? 'ดูข้อมูล' : 'อัปเดตสถานะ'}
                        </Button>
                      </>}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button className="w-full h-12 text-base text-white" style={{
        background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
      }} onClick={handleStartJob}>
            เริ่มงานเลย
          </Button>
        </div>}
    </div>;
}