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

  // Mock data for international transport
  const mockContainerData = {
    checkpoint: job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย',
    checkpointCode: job.container_checkpoint_code || 'LCB B1',
    emptyDate: job.empty_container_date || '2023-11-02',
    containerNumber: job.container_number || 'MSKU1234567',
    sealNumber: job.seal_number || 'SEAL987654'
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
            <div className="flex items-center justify-center gap-2 mt-1">
              {isDomestic && (
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
                  ขนส่งภายในประเทศ
                </Badge>
              )}
              {isInternational && (
                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-xs">
                  ขนส่งภายนอกประเทศ
                </Badge>
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
                          ? 'SOP สำเร็จ' 
                          : 'รอเช็คอิน'}
                      </span>
                    )}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {mockContainerData.checkpoint}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">จุดตรวจตู้เปล่า</span>
                      <span>: {mockContainerData.checkpointCode}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">วันเริ่มเข้ารับตู้เปล่า</span>
                      <span>: {formatDate(mockContainerData.emptyDate)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">เลขตู้คอนเทนเนอร์</span>
                      <span>: {mockContainerData.containerNumber}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[140px]">เลขซีล</span>
                      <span>: {mockContainerData.sealNumber}</span>
                    </div>
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
                      disabled={!jobApplication?.job_started_at || jobApplication?.container_sop_completed_at !== null}
                      onClick={() => {
                        navigate(`/job/${job.id}/container-checkin`);
                      }}
                    >
                      อัปเดตสถานะ
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
                    จุดรับสินค้า
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
                  {isInternational ? job.origin_location : 'Factory1'}
                </h4>

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">ชื่อผู้ติดต่อ</span>
                    <span>: {isInternational 
                      ? `${mockOriginData.contactPerson} (${mockOriginData.contactRole})` 
                      : 'คุณณัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">เลขทาง</span>
                    <span>: {mockOriginData.billOfLading}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">ประเภทสินค้า</span>
                    <span>: {isInternational 
                      ? `${mockOriginData.goodsType} (${mockOriginData.goodsQuantity})` 
                      : 'น้ำตาล (10 กล่อง)'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">เข้ารับสินค้า</span>
                    <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[100px]">หมายเหตุ</span>
                    <span>: {mockOriginData.remarks}</span>
                  </div>
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

          {/* Delivery Point */}
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
                    {isInternational ? 'จุดคืนตู้เต็ม' : 'จุดส่ง'}
                  </h3>
                  {jobApplication?.sop_completed_at && (
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

                <h4 className="font-semibold text-base mb-2">
                  {job.destination_location}
                </h4>

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex">
                    <span className="text-muted-foreground min-w-[140px]">
                      {isInternational ? 'วันคืนตู้คอนเทนเนอร์' : 'ชื่อผู้ติดต่อ'}
                    </span>
                    <span>: {isInternational 
                      ? `${formatDate(job.start_date)} | ${mockDestinationData.time}`
                      : 'คุณธงใบย'}</span>
                  </div>
                  {isInternational ? (
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
                </div>

                <div className="grid grid-cols-2 gap-2">
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
            disabled={(isDomestic && !jobApplication?.sop_completed_at) || (isInternational && !jobApplication?.container_sop_completed_at)}
          >
            เริ่มงานเลย
          </Button>
        </div>
      )}
    </div>
  );
}
