import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
}

interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
}

interface SOPPhoto {
  photo_url: string;
  created_at: string;
}

export default function PickupSummaryPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [sopPhoto, setSOPPhoto] = useState<SOPPhoto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [jobId, user]);

  const loadData = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    // Load job details
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, origin_location, start_date, start_time')
      .eq('id', jobId)
      .single();

    if (jobError) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลงานได้',
        variant: 'destructive'
      });
      navigate('/current-jobs');
      return;
    }
    
    setJob(jobData);

    // Load job application
    const { data: appData } = await supabase
      .from('job_applications')
      .select('checked_in_at, sop_completed_at')
      .eq('job_id', jobId)
      .eq('driver_id', user.id)
      .single();

    if (appData) {
      setApplication(appData);
    }

    // Load SOP photo
    const { data: photoData } = await supabase
      .from('pickup_sop_photos')
      .select('photo_url, created_at')
      .eq('job_id', jobId)
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (photoData) {
      setSOPPhoto(photoData);
    }

    setLoading(false);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dateStr} | ${timeStr}`;
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
      <div className="px-4 py-6 space-y-4">
        {/* Check-in Status */}
        {application?.checked_in_at && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-green-900">เช็คอินสำเร็จ</div>
                <div className="text-sm text-green-700">
                  {formatDateTime(application.checked_in_at)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* SOP Status */}
        {application?.sop_completed_at && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-green-900">SOP สำเร็จ</div>
                <div className="text-sm text-green-700">
                  {formatDateTime(application.sop_completed_at)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* SOP Photo */}
        {sopPhoto && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">รูปภาพสินค้า</div>
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <img 
                src={sopPhoto.photo_url} 
                alt="SOP Photo" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}