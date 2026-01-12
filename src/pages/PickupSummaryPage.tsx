import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import JobActionButtons from "@/components/job/JobActionButtons";
import { formatDateTime } from "@/lib/dateUtils";
import { usePresignedImageUrl } from "@/hooks/usePresignedImageUrl";

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
}

interface SOPData {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  sop_photo_url: string | null;
}

export default function PickupSummaryPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [sopData, setSopData] = useState<SOPData | null>(null);
  const [loading, setLoading] = useState(true);
  const { url: sopPhotoUrl } = usePresignedImageUrl(sopData?.sop_photo_url || null);

  useEffect(() => {
    if (user && jobId) {
      loadData();
    }
  }, [jobId, user]);

  const loadData = async () => {
    if (!user || !jobId) return;

    setLoading(true);

    try {
      const freelanceDriverId = user.id;

      // Fetch job detail from external API
      const jobResponse = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${freelanceDriverId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (jobResponse.ok) {
        const jobResult = await jobResponse.json();
        if (jobResult.success && jobResult.data) {
          const foundJob = jobResult.data.find((j: any) => j.order_number === jobId);
          if (foundJob) {
            setJob({
              id: foundJob.order_number,
              order_code: foundJob.order_number,
              employer_name: foundJob.sender_name || '',
              origin_location: foundJob.sender_address || '',
              start_date: foundJob.sender_pickup_date || '',
              start_time: foundJob.sender_pickup_time || '',
            });
          }
        }
      }

      // Fetch check-in data from proxy API
      const checkinResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?freelance_driver_id=${freelanceDriverId}&order_number=${jobId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      let checkedInAt: string | null = null;
      if (checkinResponse.ok) {
        const checkinResult = await checkinResponse.json();
        if (checkinResult.success && checkinResult.data) {
          // Find pickup check-in
          const pickupCheckin = Array.isArray(checkinResult.data)
            ? checkinResult.data.find((c: any) => c.checkin_type === 'pickup')
            : checkinResult.data.checkin_type === 'pickup' ? checkinResult.data : null;

          if (pickupCheckin) {
            checkedInAt = pickupCheckin.checkin_time || pickupCheckin.created_at || null;
          }
        }
      }

      // Fetch SOP data from API
      const sopResponse = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-driver-sop?freelance_driver_id=${freelanceDriverId}&order_number=${jobId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (sopResponse.ok) {
        const sopResult = await sopResponse.json();
        if (sopResult.success && sopResult.data) {
          // Find pickup SOP
          const pickupSOP = Array.isArray(sopResult.data)
            ? sopResult.data.find((s: any) => s.sop_type === 'pickup' || s.status === 'pickup')
            : (sopResult.data.sop_type === 'pickup' || sopResult.data.status === 'pickup') ? sopResult.data : null;

          if (pickupSOP) {
            // Get the first product image as SOP photo
            const productImages = pickupSOP.product_images || [];
            const photoUrl = productImages.length > 0 ? productImages[0] : null;

            setSopData({
              checked_in_at: checkedInAt || pickupSOP.checked_in_at || null,
              sop_completed_at: pickupSOP.recorded_at || pickupSOP.created_at || null,
              sop_photo_url: photoUrl,
            });
          } else {
            // No SOP yet, but might have check-in
            setSopData({
              checked_in_at: checkedInAt,
              sop_completed_at: null,
              sop_photo_url: null,
            });
          }
        } else {
          // No SOP data, set check-in only
          setSopData({
            checked_in_at: checkedInAt,
            sop_completed_at: null,
            sop_photo_url: null,
          });
        }
      } else {
        // SOP API failed, set check-in only
        setSopData({
          checked_in_at: checkedInAt,
          sop_completed_at: null,
          sop_photo_url: null,
        });
      }

    } catch (error) {
      console.error('Error loading pickup summary:', error);
      toast({
        title: t('pickupSummary.error'),
        description: t('pickupSummary.loadError'),
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('pickupSummary.notFound') || 'ไม่พบข้อมูลงาน'}</p>
          <button 
            onClick={() => navigate('/current-jobs')}
            className="text-primary underline"
          >
            {t('common.back') || 'กลับ'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${job.order_code}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{job.employer_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Action Buttons */}
        <div className="bg-white rounded-xl p-4">
          <JobActionButtons jobId={jobId} />
        </div>

        {/* Check-in Status */}
        {sopData?.checked_in_at && (
          <Card className="p-4 bg-[#E6F7E6] border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 flex justify-between items-center">
                <div className="font-semibold text-green-900">{t('pickupSummary.checkInSuccess')}</div>
                <div className="text-sm text-green-700">{formatDateTime(sopData.checked_in_at, language)}</div>
              </div>
            </div>
          </Card>
        )}

        {/* SOP Status */}
        {sopData?.sop_completed_at && (
          <Card className="p-4 bg-[#E6F7E6] border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 flex justify-between items-center">
                <div className="font-semibold text-green-900">{t('pickupSummary.sopSuccess')}</div>
                <div className="text-sm text-green-700">{formatDateTime(sopData.sop_completed_at, language)}</div>
              </div>
            </div>

            {/* SOP Photo */}
            {sopPhotoUrl && (
              <div className="mt-4">
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <img src={sopPhotoUrl} alt="SOP Photo" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* No data state */}
        {!sopData?.checked_in_at && !sopData?.sop_completed_at && (
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="text-center text-muted-foreground py-4">
              {t('pickupSummary.noData') || 'ยังไม่มีข้อมูลการเช็คอินหรือ SOP'}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
