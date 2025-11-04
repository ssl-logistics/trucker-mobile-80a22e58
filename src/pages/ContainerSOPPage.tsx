import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  container_checkpoint: string;
  container_number: string;
  seal_number: string;
  start_date: string;
  start_time: string;
}

const ContainerSOPPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (jobId && user) {
      loadJobDetail();
    }
  }, [jobId, user]);

  const loadJobDetail = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, order_code, employer_name, container_checkpoint, container_number, seal_number, start_date, start_time')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJobDetail(data);
    } catch (error) {
      console.error('Error loading job details:', error);
      toast({
        title: "Error",
        description: "ไม่สามารถโหลดข้อมูลงานได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (source: 'camera' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
    setShowPhotoDrawer(false);
  };

  const handleConfirmClick = () => {
    if (!photoFile) {
      toast({
        title: "แจ้งเตือน",
        description: "กรุณาอัพโหลดรูปภาพตู้เปล่า",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    if (!photoFile || !jobId || !user) return;

    setUploading(true);
    try {
      // Upload photo to storage
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${jobId}_${Date.now()}.${fileExt}`;
      const filePath = `container-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pickup_sop_photos')
        .upload(filePath, photoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pickup_sop_photos')
        .getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase
        .from('pickup_sop_photos')
        .insert({
          job_id: jobId,
          driver_id: user.id,
          photo_url: publicUrl,
          photo_type: 'container'
        });

      if (dbError) throw dbError;

      // Update job application status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ 
          container_sop_completed_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "สำเร็จ",
        description: "บันทึกข้อมูลสำเร็จ",
      });

      navigate(`/job/${jobId}`);
    } catch (error) {
      console.error('Error saving SOP:', error);
      toast({
        title: "Error",
        description: "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setShowConfirmDialog(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (time: string) => {
    return time || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!jobDetail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">ไม่พบข้อมูลงาน</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#245D9E] text-white p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">
          {jobDetail.container_checkpoint}
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Success Banner */}
        <div className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#4CAF50]" />
          <div className="flex-1">
            <div className="font-medium text-[#2E7D32]">เช็คอินสำเร็จ</div>
            <div className="text-sm text-[#2E7D32]">
              {formatDate(jobDetail.start_date)} | {formatTime(jobDetail.start_time)}
            </div>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            อัพโหลดรูปตู้เปล่า <span className="text-red-500">*</span>
          </label>
          
          {photoPreview ? (
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4">
              <img 
                src={photoPreview} 
                alt="Preview" 
                className="w-full h-auto rounded"
              />
              <button
                onClick={() => setShowPhotoDrawer(true)}
                className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg"
              >
                <Camera className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPhotoDrawer(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:border-gray-400 transition-colors"
            >
              <Camera className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500">
                คลิกเพื่อถ่ายหรือเลือกรูปตู้เปล่า
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button
          onClick={handleConfirmClick}
          disabled={!photoFile || uploading}
          className="w-full h-12 text-base bg-[#0FA968] hover:bg-[#0C8B53] text-white"
        >
          {uploading ? "กำลังบันทึก..." : "ยืนยันรับตู้เปล่า"}
        </Button>
      </div>

      {/* Photo Source Drawer */}
      <Drawer open={showPhotoDrawer} onOpenChange={setShowPhotoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">เลือกแหล่งที่มาของรูปภาพ</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={() => handlePhotoSelect('camera')}
              className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
            >
              <Camera className="w-5 h-5" />
              <span>ถ่ายภาพ</span>
            </button>
            <button
              onClick={() => handlePhotoSelect('gallery')}
              className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50"
            >
              <Image className="w-5 h-5" />
              <span>เลือกรูปจากแกลลอรี่</span>
            </button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">ยกเลิก</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการรับตู้เปล่า</DialogTitle>
            <DialogDescription>
              คุณต้องการยืนยันการรับตู้เปล่าใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={uploading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmSOP}
              disabled={uploading}
              className="bg-[#0FA968] hover:bg-[#0C8B53] text-white"
            >
              {uploading ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContainerSOPPage;
