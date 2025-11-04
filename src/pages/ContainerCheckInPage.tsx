import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Navigation, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface JobDetail {
  id: string;
  order_code: string;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  empty_container_date: string | null;
  container_number: string | null;
  seal_number: string | null;
}

export default function ContainerCheckInPage() {
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
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลงานได้',
        variant: 'destructive'
      });
      navigate(`/job/${jobId}`);
    } else {
      setJob(data);
    }

    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!user || !jobId) return;

    const { error } = await supabase
      .from('job_applications')
      .update({ 
        container_checked_in_at: new Date().toISOString(),
        status: 'รอรับตู้เปล่า'
      })
      .eq('job_id', jobId)
      .eq('driver_id', user.id);

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเช็คอินได้',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'เช็คอินสำเร็จ',
        description: 'สถานะเปลี่ยนเป็น รอรับตู้เปล่า แล้ว'
      });
      setShowConfirmDialog(false);
      loadJobDetail();
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) return null;

  const mockContainerData = {
    checkpoint: job.container_checkpoint || 'ท่าเรือแหลมฉบัง, ประเทศไทย',
    checkpointCode: job.container_checkpoint_code || 'LCB B1',
    emptyDate: job.empty_container_date || '2023-11-02',
    containerNumber: job.container_number || 'MSKU1234567',
    sealNumber: job.seal_number || 'SEAL987654'
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/job/${jobId}`)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">จุดรับตู้เปล่า ท่าเรือแหลมฉบัง, ประเทศไทย</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="grid grid-cols-3 px-4">
          <button className="py-4 text-center border-b-2 border-blue-600 text-blue-600 font-medium">
            ดูค่าใช้จ่าย
          </button>
          <button className="py-4 text-center text-gray-500">
            เพิ่มค่าใช้จ่าย
          </button>
          <button className="py-4 text-center text-gray-500">
            แจ้งปัญหา
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Location Name */}
        <div>
          <h2 className="text-base font-semibold mb-2">จุดรับตู้เปล่า</h2>
          <p className="text-base">{mockContainerData.checkpoint}</p>
        </div>

        {/* Map Placeholder */}
        <Card className="h-48 bg-blue-100 flex items-center justify-center relative overflow-hidden">
          <MapPin className="w-12 h-12 text-red-600 absolute" style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200/30 to-blue-400/30"></div>
        </Card>

        {/* Container Details */}
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">จุดรับตู้เปล่า (CY EMPTY / CFS CONTAINER AT)</p>
              <p className="font-medium">{mockContainerData.checkpointCode}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">วันรับรับตู้เปล่า (FIRST DATE PICK UP CTNR)</p>
              <p className="font-medium">{formatDate(mockContainerData.emptyDate)}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">เลขตู้คอนเทนเนอร์ (Container No.)</p>
              <p className="font-medium">{mockContainerData.containerNumber}</p>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">เลขซีล (Seal No.)</p>
              <p className="font-medium">{mockContainerData.sealNumber}</p>
            </div>
          </div>
        </Card>

        {/* Navigation Button */}
        <Button 
          variant="outline" 
          className="w-full h-12"
        >
          <Navigation className="w-5 h-5 mr-2" />
          เส้นทาง
        </Button>
      </div>

      {/* Bottom Check-in Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base text-white"
          style={{
            background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
          }}
          onClick={() => setShowConfirmDialog(true)}
        >
          <MapPin className="w-5 h-5 mr-2" />
          เช็คอิน
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              แจ้งเตือนการยืนยันสถานะ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              คุณต้องการเช็คอินที่<br />
              "จุดรับตู้เปล่า ท่าเรือแหลมฉบัง, ประเทศไทย"<br />
              ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:space-x-4">
            <AlertDialogCancel className="sm:mt-0">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCheckIn}
              className="bg-blue-600 hover:bg-blue-700"
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
