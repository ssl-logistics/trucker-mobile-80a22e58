import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, CheckCircle, Circle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

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
  equipment_list: string | null;
  safety_equipment: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  empty_container_date: string | null;
  container_number: string | null;
  seal_number: string | null;
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
  container_checked_in_at: string | null;
  container_sop_completed_at: string | null;
  status: string;
}

export default function JobDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    // Load job details
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลงานได้',
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } else {
      setJob(data);
    }

    // Load job application status
    const { data: appData } = await supabase
      .from('job_applications')
      .select('checked_in_at, sop_completed_at, job_started_at, delivery_checked_in_at, delivery_sop_completed_at, container_checked_in_at, container_sop_completed_at, status')
      .eq('job_id', jobId)
      .eq('driver_id', user.id)
      .single();

    if (appData) {
      setJobApplication(appData);
    }

    setLoading(false);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) return null;

  // Determine if domestic or international
  const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');
  const isInbound = job.transport_type?.includes('ขาเข้า'); // International inbound
  const isOutbound = job.transport_type?.includes('ขาออก'); // International outbound

  // Mock data for international transport
  const mockContainerData = {
    checkpoint: job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย',
    checkpointCode: job.container_checkpoint_code || 'LCB B1',
    emptyDate: job.empty_container_date || '2023-11-02',
    containers: [
      {
        number: 'TGHU4455667',
        seal: 'SEAL556677'
      },
      {
        number: 'CAIU9988776',
        seal: 'SEAL112233'
      }
    ]
  };

  const mockOriginData = {
    contactPerson: job.origin_contact_person || 'คุณณัฏฐพงศ์',
    contactRole: job.origin_contact_role || 'เจ้าหน้าที่คลังสินค้า',
    billOfLading: job.origin_bill_of_lading || 'BKK001 ลาดพร้าว/กรุงเทพมหานคร',
    goodsType: job.origin_goods_type || 'น้ำตาล',
    goodsQuantity: job.origin_goods_quantity || '10 กล่อง',
    remarks: job.origin_remarks || 'เข้าสถานที่ต้องแสดงบัตรชิด'
  };

  const mockDestinationData = {
    contactPerson: job.destination_contact_person || 'บริษัท เอเซีย เทรนส์ โลจิสติกส์ จำกัด',
    time: job.destination_time || '20:00',
    remarks: job.destination_remarks || job.employer_name || 'แปซิฟิค อิมปอร์ต จำกัด'
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
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              {isDomestic && (
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
                  ขนส่งภายในประเทศ
                </Badge>
              )}
              {isInternational && (
                <>
                  <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
                    ขนส่งภายนอกประเทศ
                  </Badge>
                  {isInbound && (
                    <Badge variant="secondary" className="bg-blue-500/80 text-white hover:bg-blue-600/80 text-xs">
                      ขาเข้า
                    </Badge>
                  )}
                  {isOutbound && (
                    <Badge variant="secondary" className="bg-orange-500/80 text-white hover:bg-orange-600/80 text-xs">
                      ขาออก
                    </Badge>
                  )}
                </>
              )}
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

        {/* Report Problem Button */}
        <Button variant="outline" className="w-full">
          📋 แจ้งปัญหา
        </Button>

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

          {/* International: Container Checkpoint */}
          {isInternational && (
            <Card className={`p-4 mb-3 border-2 ${
              jobApplication?.container_sop_completed_at 
                ? 'border-green-500 bg-green-50' 
                : jobApplication?.job_started_at
                ? 'border-teal-500 bg-white' 
                : 'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  {jobApplication?.container_sop_completed_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                  ) : jobApplication?.job_started_at ? (
                    <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="w-0.5 h-full border-l-2 border-dashed border-gray-300 my-1" />
                </div>
                
                <div className={`flex-1 ${!jobApplication?.job_started_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      จุดรับตู้เปล่า
                    </h3>
                    {jobApplication?.job_started_at && (
                      <span className={`text-xs font-medium ${
                        jobApplication?.container_sop_completed_at 
                          ? 'text-green-600' 
                          : 'text-orange-500'
                      }`}>
                        • {jobApplication?.container_sop_completed_at 
                          ? 'รับตู้เปล่าสำเร็จ' 
                          : 'รอเช็คอิน'}
                      </span>
                    )}
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
                      <span>: {isInbound ? 'บริษัท โซเดคซ์ จำกัด' : mockOriginData.billOfLading}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">วันคนเทนเนอร์</span>
                      <span>: {isInbound ? 'FCL 2 x 40 HC' : mockContainerData.checkpointCode}</span>
                    </div>
                    
                    {/* Container Pairs - Only for Inbound */}
                    {isInbound && (
                      <>
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
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-10"
                      disabled={!jobApplication?.job_started_at || jobApplication?.container_sop_completed_at !== null}
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      เส้นทาง
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                      disabled={!jobApplication?.job_started_at}
                      onClick={() => {
                        if (jobApplication?.container_sop_completed_at) {
                          navigate(`/job/${job.id}/container-summary`);
                        } else if (jobApplication?.container_checked_in_at) {
                          navigate(`/job/${job.id}/container-sop`);
                        } else {
                          navigate(`/job/${job.id}/container-checkin`);
                        }
                      }}
                    >
                      {jobApplication?.container_sop_completed_at 
                        ? 'ดูข้อมูล' 
                        : 'อัปเดตสถานะ'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Pickup Point */}
          <Card className={`p-4 mb-3 border-2 ${
            jobApplication?.sop_completed_at
              ? 'border-green-500 bg-green-50'
              : (!isInternational || jobApplication?.container_sop_completed_at)
              ? 'border-teal-500 bg-white' 
              : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                {jobApplication?.sop_completed_at ? (
                  <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                ) : (!isInternational || jobApplication?.container_sop_completed_at) ? (
                  <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
                <div className="w-0.5 h-full border-l-2 border-dashed border-gray-300 my-1" />
              </div>
              
                <div className={`flex-1 ${isInternational && !jobApplication?.container_sop_completed_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      {isInbound ? 'จุดรับสินค้า' : 'จุดส่งสินค้า'}
                    </h3>
                  {(!isInternational || jobApplication?.container_sop_completed_at) && (
                    <span className={`text-xs font-medium ${
                      jobApplication?.sop_completed_at 
                        ? 'text-green-600' 
                        : 'text-orange-500'
                    }`}>
                      • {jobApplication?.sop_completed_at 
                        ? 'SOP สำเร็จ' 
                        : 'รอเช็คอิน'}
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-base mb-2">
                  {isInbound ? 'คลังสินค้าทางบก, สมุทรปราการ' : (isInternational ? job.origin_location : 'Factory1')}
                </h4>

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เลขที่เอียด' : 'ชื่อผู้ติดต่อ'}</span>
                    <span>: {isInbound ? '123456789012345' : mockOriginData.contactPerson}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'ชื่อจุดติดต่อ' : 'ตำแหน่ง'}</span>
                    <span>: {isInbound 
                      ? 'คลังภัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)'
                      : mockOriginData.contactRole}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เส้นทาง' : 'เลขทาง'}</span>
                    <span>: {isInbound 
                      ? 'SAM001 ลาดพร้าว, กรุงเทพมหานคร'
                      : mockOriginData.billOfLading}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'เข้าส่งสินค้า' : 'ประเภทสินค้า'}</span>
                    <span>: {isInbound 
                      ? `${formatDate(job.start_date)} | 20:00`
                      : mockOriginData.goodsType}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">{isInbound ? 'หมายเหตุ' : 'จำนวนสินค้า'}</span>
                    <span>: {isInbound ? 'เข้าสถานที่ต้องแสดงบัตรชิด' : mockOriginData.goodsQuantity}</span>
                  </div>
                  {!isInbound && (
                    <>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">เข้ารับสินค้า</span>
                        <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                        <span>: {mockOriginData.remarks}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-10"
                    disabled={isInternational && !jobApplication?.container_sop_completed_at}
                  >
                    <Phone className="w-4 h-4" />
                    โทร
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-10"
                    disabled={isInternational && !jobApplication?.container_sop_completed_at}
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
                    disabled={(isInternational && !jobApplication?.container_sop_completed_at) || (!isInternational && !jobApplication?.job_started_at)}
                  >
                    {jobApplication?.sop_completed_at 
                      ? 'ดูข้อมูล' 
                      : 'อัปเดตสถานะ'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery Point / Return Empty Container for Inbound */}
          <Card className={`p-4 border-2 ${
            jobApplication?.delivery_sop_completed_at
              ? 'border-green-500 bg-green-50'
              : jobApplication?.sop_completed_at
              ? 'border-teal-500 bg-white' 
              : 'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                {jobApplication?.delivery_sop_completed_at ? (
                  <CheckCircle className="w-5 h-5 text-green-600 fill-green-600" />
                ) : jobApplication?.sop_completed_at ? (
                  <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              
              <div className={`flex-1 ${!jobApplication?.sop_completed_at ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">
                    {isInbound ? 'จุดคืนตู้เปล่า' : (isOutbound ? 'จุดคืนตู้เต็ม' : 'จุดส่ง')}
                  </h3>
                  {jobApplication?.sop_completed_at && (
                    <span className={`text-xs font-medium ${
                      jobApplication?.delivery_sop_completed_at 
                        ? 'text-green-600' 
                        : 'text-gray-400'
                    }`}>
                      • {jobApplication?.delivery_sop_completed_at 
                        ? 'POD สำเร็จ' 
                        : 'อัปเดตงาน'}
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-base mb-2">
                  {isInbound ? 'ICD ลาดกระบัง' : job.destination_location}
                </h4>

                <div className="space-y-1 text-sm mb-3">
                  {isInbound ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="flex">
                        <span className="text-muted-foreground min-w-[140px]">
                          {isOutbound ? 'วันคืนตู้คอนเทนเนอร์' : 'ชื่อผู้ติดต่อ'}
                        </span>
                        <span>: {isOutbound 
                          ? `${formatDate(job.start_date)} | ${mockDestinationData.time}`
                          : 'คุณธงใบย'}</span>
                      </div>
                      {isOutbound ? (
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">ผู้รับรอง</span>
                          <span>: {mockDestinationData.remarks}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex">
                            <span className="text-muted-foreground min-w-[140px]">เลขทาง</span>
                            <span>: SAM001 เมือง/สมุทรปราการ</span>
                          </div>
                          <div className="flex">
                            <span className="text-muted-foreground min-w-[140px]">ประเภทสินค้า</span>
                            <span>: น้ำตาล (10 กล่อง)</span>
                          </div>
                          <div className="flex">
                            <span className="text-muted-foreground min-w-[140px]">ส่งสินค้า</span>
                            <span>: {formatDate(job.start_date)} | 11:00</span>
                          </div>
                          <div className="flex">
                            <span className="text-muted-foreground min-w-[140px]">หมายเหตุ</span>
                            <span>: -</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {isInbound ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-10"
                        disabled={!jobApplication?.sop_completed_at}
                      >
                        <Phone className="w-4 h-4" />
                        โทร
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-10" 
                        disabled={!jobApplication?.sop_completed_at}
                      >
                        <Navigation className="w-4 h-4" />
                        เส้นทาง
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-10 bg-gray-300 hover:bg-gray-300 text-gray-500 cursor-not-allowed"
                        disabled
                      >
                        อัปเดตงาน
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-10" 
                        disabled={!jobApplication?.sop_completed_at}
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        เส้นทาง
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-10 bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          navigate(`/job/${job.id}/delivery`);
                        }}
                        disabled={!jobApplication?.sop_completed_at}
                      >
                        {jobApplication?.delivery_sop_completed_at 
                          ? 'ดูข้อมูล' 
                          : 'อัปเดตสถานะ'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            className="w-full h-12 text-base text-white disabled:opacity-100"
            style={{
              background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
            }}
            onClick={async () => {
              if (!user || !jobId) return;
              
              const { error } = await supabase
                .from('job_applications')
                .update({ 
                  job_started_at: new Date().toISOString(),
                  status: 'job_started'
                })
                .eq('job_id', jobId)
                .eq('driver_id', user.id);

              if (error) {
                toast({
                  title: 'เกิดข้อผิดพลาด',
                  description: 'ไม่สามารถเริ่มงานได้',
                  variant: 'destructive'
                });
              } else {
                toast({
                  title: 'เริ่มงานสำเร็จ',
                  description: isInternational 
                    ? 'คุณสามารถเริ่มตรวจตู้เปล่าได้แล้ว' 
                    : 'คุณสามารถทำงานส่งของได้แล้ว'
                });
                loadJobDetail();
              }
            }}
          >
            เริ่มงานเลย
          </Button>
        </div>
      )}
    </div>
  );
}
