import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, MapPin, Camera, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  destination_location: string;
  start_date: string;
  start_time: string;
}

interface JobApplication {
  delivery_checked_in_at: string | null;
  payment_completed_at: string | null;
  payment_method: string | null;
  pod_photo_url: string | null;
  delivery_sop_completed_at: string | null;
}

export default function DeliveryDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [showPodConfirmDialog, setShowPodConfirmDialog] = useState(false);
  const [podPhoto, setPodPhoto] = useState<File | null>(null);
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, destination_location, start_date, start_time')
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
      .select('delivery_checked_in_at, payment_completed_at, payment_method, pod_photo_url, delivery_sop_completed_at')
      .eq('job_id', jobId)
      .eq('driver_id', user.id)
      .single();

    if (appData) {
      setJobApplication(appData);
      // Load existing POD photo preview if available
      if (appData.pod_photo_url) {
        setPodPhotoPreview(appData.pod_photo_url);
      }
    }

    setLoading(false);
  };

  const handlePaymentConfirm = async () => {
    if (!job || !user) return;

    const { error } = await supabase
      .from('job_applications')
      .update({ 
        payment_completed_at: new Date().toISOString(),
        payment_method: selectedPaymentMethod
      })
      .eq('job_id', job.id)
      .eq('driver_id', user.id);

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกการชำระเงินได้',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'ชำระเงินสำเร็จ',
      description: 'บันทึกข้อมูลการชำระเงินเรียบร้อยแล้ว',
    });
    setShowPaymentDrawer(false);
    loadJobDetail();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPodPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPodPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePodConfirm = async () => {
    if (!job || !user) return;

    let photoUrl = jobApplication?.pod_photo_url;

    // Upload photo if new one is selected
    if (podPhoto) {
      const fileExt = podPhoto.name.split('.').pop();
      const fileName = `${user.id}-${job.id}-${Date.now()}.${fileExt}`;
      const filePath = `pod-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(filePath, podPhoto);

      if (uploadError) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถอัปโหลดเอกสารได้',
          variant: 'destructive'
        });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(filePath);

      photoUrl = publicUrl;
    }

    // Update job application with POD completion
    const { error } = await supabase
      .from('job_applications')
      .update({ 
        delivery_sop_completed_at: new Date().toISOString(),
        pod_photo_url: photoUrl
      })
      .eq('job_id', job.id)
      .eq('driver_id', user.id);

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถยืนยัน POD ได้',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'ยืนยัน POD สำเร็จ',
      description: 'บันทึกข้อมูล POD เรียบร้อยแล้ว',
    });
    setShowPodConfirmDialog(false);
    navigate(`/job/${job.id}`);
  };

  const handleCheckIn = async () => {
    if (!job || !user) return;

    // Update job application with delivery check-in timestamp
    const { error } = await supabase
      .from('job_applications')
      .update({ 
        delivery_checked_in_at: new Date().toISOString(),
        status: 'delivery_checked_in'
      })
      .eq('job_id', job.id)
      .eq('driver_id', user.id);

    if (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกการเช็คอินได้',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'เช็คอินสำเร็จ',
      description: 'คุณได้เช็คอินที่จุดส่งสินค้าเรียบร้อยแล้ว',
    });
    setShowConfirmDialog(false);
    
    // Reload to show updated state
    loadJobDetail();
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateTime: string) => {
    const d = new Date(dateTime);
    const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} | ${time}`;
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
          <h1 className="text-lg font-semibold">จุดส่ง หวค.ชัยน้ำตาล</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Top Action Buttons */}
        <JobActionButtons jobId={jobId} />

        {/* Check-in Status - Show only after check-in */}
        {jobApplication?.delivery_checked_in_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-semibold text-lg">เช็คอินสำเร็จ</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.delivery_checked_in_at)}
              </span>
            </div>
          </div>
        )}

        {/* Payment Status - Show after payment */}
        {jobApplication?.payment_completed_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">ชำระเงินสำเร็จ</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.payment_completed_at)}
              </span>
            </div>

            <div className="border-t-2 border-gray-100 pt-4">
              <h3 className="font-semibold text-base mb-3 text-gray-800">ข้อมูลการชำระเงิน</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">วิธีการชำระเงิน</div>
                  <div className="font-medium text-gray-900">
                    {jobApplication.payment_method === 'cash' && 'เงินสด'}
                    {jobApplication.payment_method === 'mobile_banking' && 'ชำระเงินผ่าน Mobile Banking'}
                    {jobApplication.payment_method === 'qr_code' && 'ชำระเงินผ่าน QR Code'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-gray-500 text-xs">จำนวนเงิน (บาท)</div>
                  <div className="font-medium text-gray-900">1,000</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* POD Upload Section - Show after payment */}
        {jobApplication?.payment_completed_at && !jobApplication?.delivery_sop_completed_at && (
          <div>
            <label className="text-sm font-medium text-gray-900 mb-2 block">
              อัพโหลดเอกสาร (ใบขนส่ง) <span className="text-red-500">*</span>
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 bg-gray-50"
            >
              {podPhotoPreview ? (
                <img src={podPhotoPreview} alt="POD Document" className="w-full h-full object-contain rounded-lg" />
              ) : (
                <>
                  <Camera className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 text-center">
                    กดเพื่อถ่ายหรือเลือก<br />เอกสาร (ใบขนส่ง)
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        )}

        {/* POD Success - Show after POD completed */}
        {jobApplication?.delivery_sop_completed_at && (
          <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-lg">POD สำเร็จ</span>
              </div>
              <span className="text-sm text-gray-600 font-medium">
                {formatDateTime(jobApplication.delivery_sop_completed_at)}
              </span>
            </div>

            {jobApplication.pod_photo_url && (
              <div className="mt-4">
                <img 
                  src={jobApplication.pod_photo_url} 
                  alt="POD Document" 
                  className="w-full h-48 object-contain rounded-lg border bg-gray-50"
                />
              </div>
            )}
          </div>
        )}

        {/* Contact Name */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">ชื่อผู้ติดต่อ</div>
          <div className="text-base">คุณธงใบย</div>
        </div>

        {/* Route Number */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">เลขทาง</div>
          <div className="text-base">SAM001 เมือง/สมุทรปราการ</div>
        </div>

        {/* Address */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">ที่อยู่</div>
          <div className="text-base">ที่อยู่ 55/5 ช.ลาดพร้าว 101 แขวงคลองจั่น คณ.</div>
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
          <div className="text-base">น้ำตาล (10 กล่อง)</div>
        </div>

        {/* Delivery Time */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">เข้ารับสินค้า</div>
          <div className="text-base">{formatDate(job.start_date)} | 10.00</div>
        </div>

        {/* Note */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">หมายเหตุ</div>
          <div className="text-base">-</div>
        </div>

        {/* Action Buttons in Blue Frame */}
        <div className="border-2 border-blue-500 rounded-lg p-3 space-y-3">
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

      {/* Check-in Button - Hide after check-in */}
      {!jobApplication?.delivery_checked_in_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowConfirmDialog(true)}
          >
            <MapPin className="w-5 h-5 mr-2" />
            เช็คอิน
          </Button>
        </div>
      )}

      {/* Payment Button - Show after check-in, hide after payment */}
      {jobApplication?.delivery_checked_in_at && !jobApplication?.payment_completed_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowPaymentDrawer(true)}
          >
            ชำระเงิน
          </Button>
        </div>
      )}

      {/* POD Confirm Button - Show after payment, hide after POD completed */}
      {jobApplication?.payment_completed_at && !jobApplication?.delivery_sop_completed_at && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button 
            className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowPodConfirmDialog(true)}
            disabled={!podPhoto && !jobApplication?.pod_photo_url}
          >
            ยืนยัน POD
          </Button>
        </div>
      )}

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
              คุณต้องการเช็คอินที่ "จุดส่ง หวค.ชัยน้ำตาล" ใช่หรือไม่?
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

      {/* Payment Method Drawer */}
      <Drawer open={showPaymentDrawer} onOpenChange={setShowPaymentDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">ชำระเงิน</DrawerTitle>
            <DrawerDescription className="text-base mt-2">ช่องทางชำระเงิน</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => setSelectedPaymentMethod('cash')}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === 'cash'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedPaymentMethod === 'cash' ? 'border-teal-500' : 'border-gray-300'
              }`}>
                {selectedPaymentMethod === 'cash' && (
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                )}
              </div>
              <span className="text-base font-medium">เงินสด</span>
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('mobile_banking')}
              className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === 'mobile_banking'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPaymentMethod === 'mobile_banking' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {selectedPaymentMethod === 'mobile_banking' && (
                    <div className="w-3 h-3 rounded-full bg-teal-500" />
                  )}
                </div>
                <span className="text-base font-medium">ชำระเงินผ่าน Mobile Banking</span>
              </div>
              <Phone className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => setSelectedPaymentMethod('qr_code')}
              className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border-2 transition-all ${
                selectedPaymentMethod === 'qr_code'
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPaymentMethod === 'qr_code' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {selectedPaymentMethod === 'qr_code' && (
                    <div className="w-3 h-3 rounded-full bg-teal-500" />
                  )}
                </div>
                <span className="text-base font-medium">ชำระเงินผ่าน QR Code</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>
          <DrawerFooter>
            <Button 
              onClick={handlePaymentConfirm}
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
            >
              ยืนยันการชำระเงิน
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12 text-base">
                ยกเลิก
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* POD Confirmation Dialog */}
      <Dialog open={showPodConfirmDialog} onOpenChange={setShowPodConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <DialogTitle className="text-xl text-center">
              แจ้งเตือนการยืนยันสถานะ
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              คุณต้องการยืนยันการยืนยันอัพโหลดรูปสินค้า POD ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPodConfirmDialog(false)}
              className="flex-1 h-11"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handlePodConfirm}
              className="flex-1 h-11 bg-teal-600 hover:bg-teal-700"
            >
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}