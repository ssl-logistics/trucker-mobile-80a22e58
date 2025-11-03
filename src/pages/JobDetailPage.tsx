import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, CheckCircle, Circle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
}

interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
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
      .select('checked_in_at, sop_completed_at, delivery_checked_in_at, delivery_sop_completed_at, status')
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/current-jobs')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{job.order_code}</h1>
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
          <h2 className="text-lg font-semibold mb-3">ผู้รับ : {job.employer_name}</h2>

          {/* Pickup Point */}
          <Card className="p-4 mb-4 border-2 border-teal-200">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Circle className="w-6 h-6 text-teal-600 fill-teal-600" />
                <div className="w-0.5 h-full bg-dashed border-l-2 border-dashed border-muted-foreground my-1" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">จุดรับสินค้า Factory1</h3>
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
                  <div className="flex">
                    <span className="text-muted-foreground w-28">ชื่อผู้ติดต่อ</span>
                    <span>: คุณณัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">เลขทาง</span>
                    <span>: BKK001 ลาดพร้าว/กรุงเทพมหานคร</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">ประเภทสินค้า</span>
                    <span>: น้ำตาล (30 กล่อง)</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">เข้ารับสินค้า</span>
                    <span>: {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">หมายเหตุ</span>
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
          <Card className={`p-4 border-2 ${!jobApplication?.sop_completed_at ? 'border-gray-200 opacity-50' : 'border-teal-200'}`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <Circle className={`w-6 h-6 ${!jobApplication?.sop_completed_at ? 'text-gray-400' : jobApplication?.delivery_sop_completed_at ? 'text-teal-600 fill-teal-600' : 'text-teal-600'}`} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">จุดส่ง คศน.ชัยนาต</h3>
                  <span className={`text-xs font-medium ${
                    !jobApplication?.sop_completed_at
                      ? 'text-gray-400'
                      : jobApplication?.delivery_sop_completed_at 
                      ? 'text-green-600' 
                      : jobApplication?.delivery_checked_in_at 
                      ? 'text-blue-600' 
                      : 'text-orange-600'
                  }`}>
                    • {!jobApplication?.sop_completed_at
                      ? 'รอ SOP รับสินค้า'
                      : jobApplication?.delivery_sop_completed_at 
                      ? 'POD สำเร็จ' 
                      : jobApplication?.delivery_checked_in_at 
                      ? 'เช็คอินแล้ว' 
                      : 'รอเช็คอิน'}
                  </span>
                </div>

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex">
                    <span className="text-muted-foreground w-28">ชื่อผู้ติดต่อ</span>
                    <span>: คุณธงใบย</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">เลขทาง</span>
                    <span>: SAM001 เมือง/สมุทรปราการ</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">ประเภทสินค้า</span>
                    <span>: น้ำตาล (10 กล่อง)</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">ส่งสินค้า</span>
                    <span>: {formatDate(job.start_date)} | 11:00</span>
                  </div>
                  <div className="flex">
                    <span className="text-muted-foreground w-28">หมายเหตุ</span>
                    <span>: -</span>
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
                      if (jobApplication?.delivery_sop_completed_at) {
                        navigate(`/job/${job.id}/pickup-summary`);
                      } else if (jobApplication?.delivery_checked_in_at) {
                        navigate(`/job/${job.id}/delivery`);
                      } else {
                        navigate(`/job/${job.id}/delivery`);
                      }
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          variant="secondary" 
          className="w-full h-12 text-base"
          onClick={() => navigate('/current-jobs')}
        >
          เรียบงาม
        </Button>
      </div>
    </div>
  );
}
