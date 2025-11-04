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
      .select('checked_in_at, sop_completed_at, job_started_at, delivery_checked_in_at, delivery_sop_completed_at, status')
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
          <h2 className="text-lg font-semibold mb-3">
            {isInternational ? 'Booking' : 'ผู้รับ'} : {job.employer_name}
          </h2>

          {/* International: Container Checkpoint */}
          {isInternational && (
            <Card className="p-4 mb-4 border-2 border-teal-200">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <Circle className="w-6 h-6 text-teal-600 fill-teal-600" />
                  <div className="w-0.5 h-16 bg-dashed border-l-2 border-dashed border-muted-foreground my-1" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">จุดตรวจตู้เปล่า {job.container_checkpoint || job.origin_location}</h3>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    {job.container_checkpoint_code && (
                      <div className="flex">
                        <span className="text-muted-foreground w-40">จุดตรวจตู้เปล่า</span>
                        <span>: {job.container_checkpoint_code}</span>
                      </div>
                    )}
                    {job.empty_container_date && (
                      <div className="flex">
                        <span className="text-muted-foreground w-40">วันเริ่มเข้ารับตู้เปล่า</span>
                        <span>: {formatDate(job.empty_container_date)}</span>
                      </div>
                    )}
                    {job.container_number && (
                      <div className="flex">
                        <span className="text-muted-foreground w-40">เลขตู้คอนเทนเนอร์</span>
                        <span>: {job.container_number}</span>
                      </div>
                    )}
                    {job.seal_number && (
                      <div className="flex">
                        <span className="text-muted-foreground w-40">เลขซีล</span>
                        <span>: {job.seal_number}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10">
                      <Navigation className="w-4 h-4 mr-1" />
                      เส้นทาง
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-10 bg-blue-600 hover:bg-blue-700"
                    >
                      อัปเดตสถานะ
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Pickup Point */}
          <Card className="p-4 mb-4 border-2 border-teal-200">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Circle className="w-6 h-6 text-teal-600 fill-teal-600" />
                <div className="w-0.5 h-full bg-dashed border-l-2 border-dashed border-muted-foreground my-1" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">
                    {isInternational ? `จุดรับสินค้า ${job.origin_location}` : `จุดรับสินค้า Factory1`}
                  </h3>
                  <span className={`text-xs font-medium ${
                    jobApplication?.sop_completed_at 
                      ? 'text-green-600' 
                      : jobApplication?.checked_in_at 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    • {jobApplication?.sop_completed_at 
                      ? 'SOP สำเร็จ' 
                      : jobApplication?.checked_in_at 
                      ? 'เช็คอินแล้ว' 
                      : 'รอเช็คอิน'}
                  </span>
                </div>

                <div className="space-y-1 text-sm mb-3">
                  {(isInternational ? job.origin_contact_person : 'คุณณัฏฐพงศ์') && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">ชื่อผู้ติดต่อ</span>
                      <span>: {isInternational 
                        ? `${job.origin_contact_person}${job.origin_contact_role ? ` (${job.origin_contact_role})` : ''}` 
                        : 'คุณณัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)'}</span>
                    </div>
                  )}
                  {(isInternational ? job.origin_bill_of_lading : 'BKK001 ลาดพร้าว/กรุงเทพมหานคร') && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">{isInternational ? 'เลขที่ใบกำกับสินค้า' : 'เลขทาง'}</span>
                      <span>: {isInternational ? job.origin_bill_of_lading : 'BKK001 ลาดพร้าว/กรุงเทพมหานคร'}</span>
                    </div>
                  )}
                  {(isInternational ? job.origin_goods_type && job.origin_goods_quantity : true) && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">ประเภทสินค้า</span>
                      <span>: {isInternational 
                        ? `${job.origin_goods_type} (${job.origin_goods_quantity})` 
                        : 'น้ำตาล (30 กล่อง)'}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-muted-foreground w-40">เข้ารับสินค้า</span>
                    <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-40">หมายเหตุ</span>
                    <span>: {isInternational ? (job.origin_remarks || '-') : 'เข้าสถานที่ต้องแสดงบัตรชิด'}</span>
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
          <Card className={`p-4 border-2 ${!jobApplication?.job_started_at ? 'border-gray-200 opacity-50' : 'border-teal-200'}`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Circle className={`w-6 h-6 ${!jobApplication?.job_started_at ? 'text-gray-400' : jobApplication?.delivery_sop_completed_at ? 'text-teal-600 fill-teal-600' : 'text-teal-600'}`} />
              </div>
              
              <div className={`flex-1 ${!jobApplication?.job_started_at ? 'text-gray-400' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold ${!jobApplication?.job_started_at ? 'text-gray-400' : ''}`}>
                    จุดส่ง{isInternational ? 'สินค้า' : ''} {job.destination_location}
                  </h3>
                  <span className={`text-xs font-medium ${
                    !jobApplication?.job_started_at
                      ? 'text-gray-400'
                      : jobApplication?.delivery_sop_completed_at 
                      ? 'text-green-600' 
                      : jobApplication?.delivery_checked_in_at 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    • {!jobApplication?.job_started_at
                      ? 'รอเริ่มงาน'
                      : jobApplication?.delivery_sop_completed_at 
                      ? 'POD สำเร็จ' 
                      : jobApplication?.delivery_checked_in_at 
                      ? 'เช็คอินแล้ว' 
                      : 'รอเช็คอิน'}
                  </span>
                </div>

                <div className="space-y-1 text-sm mb-3">
                  {(isInternational ? job.destination_contact_person : 'คุณธงใบย') && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">ชื่อผู้ติดต่อ</span>
                      <span>: {isInternational ? job.destination_contact_person : 'คุณธงใบย'}</span>
                    </div>
                  )}
                  {(isInternational ? job.destination_bill_of_lading : 'SAM001 เมือง/สมุทรปราการ') && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">เลขทาง</span>
                      <span>: {isInternational ? job.destination_bill_of_lading : 'SAM001 เมือง/สมุทรปราการ'}</span>
                    </div>
                  )}
                  {(isInternational ? job.destination_goods_type && job.destination_goods_quantity : true) && (
                    <div className="flex">
                      <span className="text-muted-foreground w-40">ประเภทสินค้า</span>
                      <span>: {isInternational 
                        ? `${job.destination_goods_type} (${job.destination_goods_quantity})` 
                        : 'น้ำตาล (10 กล่อง)'}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-muted-foreground w-40">ส่งสินค้า</span>
                    <span>: {formatDate(job.start_date)} | {isInternational && job.destination_time ? job.destination_time.substring(0, 5) : '11:00'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-40">หมายเหตุ</span>
                    <span>: {isInternational ? (job.destination_remarks || '-') : '-'}</span>
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
                  <Button 
                    size="sm" 
                    className="h-10 bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      navigate(`/job/${job.id}/delivery`);
                    }}
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
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            variant="secondary" 
            className="w-full h-12 text-base disabled:opacity-100"
            style={{
              backgroundColor: !jobApplication?.sop_completed_at ? 'hsla(0, 0%, 66%, 1)' : undefined,
              color: !jobApplication?.sop_completed_at ? 'white' : undefined
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
                  description: 'คุณสามารถทำงานส่งของได้แล้ว'
                });
                loadJobDetail();
              }
            }}
            disabled={!jobApplication?.sop_completed_at}
          >
            เริ่มงาน
          </Button>
        </div>
      )}
    </div>
  );
}
