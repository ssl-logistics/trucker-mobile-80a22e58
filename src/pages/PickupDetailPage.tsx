import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
}

export default function PickupDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, origin_location, start_date, start_time')
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
    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!job || !user) return;

    // TODO: Update job application status to 'checked_in' or similar
    toast({
      title: 'เช็คอินสำเร็จ',
      description: 'คุณได้เช็คอินที่จุดรับสินค้าเรียบร้อยแล้ว',
    });
    setShowConfirmDialog(false);
    navigate(`/job/${job.id}`);
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
          <button onClick={() => navigate(`/job/${job.id}`)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">จุดรับสินค้า Factory1</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Contact Name */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">ชื่อผู้ติดต่อ</div>
          <div className="text-base">คุณณัฏฐพงศ์ (เจ้าหน้าที่คลังสินค้า)</div>
        </div>

        {/* Route Number */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">เลขทาง</div>
          <div className="text-base">BKK001 ลาดพร้าว/กรุงเทพมหานคร</div>
        </div>

        {/* Address */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">ที่อยู่</div>
          <div className="text-base">55/5 ซ.ลาดพร้าว 101 แขวงคลองจั่น กทม.</div>
        </div>

        {/* Map Placeholder */}
        <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">แผนที่</p>
          </div>
        </div>

        {/* Product Type */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">ประเภทสินค้า</div>
          <div className="text-base">น้ำตาล (30 กล่อง)</div>
        </div>

        {/* Pickup Time */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">เข้ารับสินค้า</div>
          <div className="text-base">{formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</div>
        </div>

        {/* Note */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">หมายเหตุ</div>
          <div className="text-base">เข้าสถานที่ต้องแสดงบัตรชิด</div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button variant="outline" className="w-full h-12 text-base">
            <Phone className="w-5 h-5 mr-2" />
            โทร
          </Button>
          <Button variant="outline" className="w-full h-12 text-base">
            <Navigation className="w-5 h-5 mr-2" />
            เส้นทาง
          </Button>
        </div>
      </div>

      {/* Check-in Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={() => setShowConfirmDialog(true)}
        >
          <MapPin className="w-5 h-5 mr-2" />
          เช็คอิน
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl text-center">
              แจ้งเตือนการยืนยันสถานะ
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              คุณต้องการเช็คอินที่ "จุดรับสินค้า Factory1" ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 h-11"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleCheckIn}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
            >
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
