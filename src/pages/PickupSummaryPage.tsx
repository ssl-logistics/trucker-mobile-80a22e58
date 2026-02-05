import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
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
  doc_photo_url: string | null;
}

export default function PickupSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromHistory = new URLSearchParams(location.search).get('from') === 'history';
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [sopData, setSopData] = useState<SOPData | null>(null);
  const [loading, setLoading] = useState(true);
  const { url: sopPhotoUrl } = usePresignedImageUrl(sopData?.sop_photo_url || null);
  const { url: docPhotoUrl } = usePresignedImageUrl(sopData?.doc_photo_url || null);

  useEffect(() => {
    if (user && jobId) {
      loadData();
    }
  }, [jobId, user]);

  const loadData = async () => {
    if (!user || !jobId) return;

    setLoading(true);

    try {
      const driverId = user.id;
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Fetch job detail from API via proxy
      const jobResponse = (isInternalDriver || isExternalDriver)
        ? await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-assigned-jobs?driver_id=${driverId}&driver_type=${driverType}&limit=50`,
            {
              headers: {
                'Content-Type': 'application/json',
              }
            }
          )
        : await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-freelance-accepted-jobs-proxy?freelance_driver_id=${driverId}`,
            {
              headers: {
                'Content-Type': 'application/json',
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
              employer_name: foundJob.sender_name || foundJob.factory_name || '',
              origin_location: foundJob.sender_address || '',
              start_date: foundJob.sender_pickup_date || '',
              start_time: foundJob.sender_pickup_time || '',
            });
          }
        }
      }

      // Fetch check-in data from proxy API
      const checkinResponse = await fetch(
        (isInternalDriver || isExternalDriver)
          ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?driver_id=${encodeURIComponent(driverId)}&driver_type=${driverType}&order_number=${encodeURIComponent(jobId)}`
          : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-checkins-proxy?freelance_driver_id=${encodeURIComponent(driverId)}&order_number=${encodeURIComponent(jobId)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(isInternalDriver || isExternalDriver
              ? { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
              : {}),
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
      const driverIdParam = isInternalDriver
        ? `internal_driver_id=${encodeURIComponent(driverId)}`
        : isExternalDriver
          ? `external_driver_id=${encodeURIComponent(driverId)}`
          : `freelance_driver_id=${encodeURIComponent(driverId)}`;

      const sopResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-driver-sop-proxy?${driverIdParam}&order_number=${encodeURIComponent(jobId)}`,
        {
          headers: {
            'Content-Type': 'application/json',
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
            
            // Get the first document image
            const documentImages = pickupSOP.document_images || [];
            const docUrl = documentImages.length > 0 ? documentImages[0] : null;

            setSopData({
              checked_in_at: checkedInAt || pickupSOP.checked_in_at || null,
              sop_completed_at: pickupSOP.recorded_at || pickupSOP.created_at || null,
              sop_photo_url: photoUrl,
              doc_photo_url: docUrl,
            });
          } else {
            // No SOP yet, but might have check-in
            setSopData({
              checked_in_at: checkedInAt,
              sop_completed_at: null,
              sop_photo_url: null,
              doc_photo_url: null,
            });
          }
        } else {
          // No SOP data, set check-in only
          setSopData({
            checked_in_at: checkedInAt,
            sop_completed_at: null,
            sop_photo_url: null,
            doc_photo_url: null,
          });
        }
      } else {
        // SOP API failed, set check-in only
        setSopData({
          checked_in_at: checkedInAt,
          sop_completed_at: null,
          sop_photo_url: null,
          doc_photo_url: null,
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
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
          <button onClick={() => navigate(`/job/${job.order_code}${fromHistory ? '?from=history' : ''}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">ข้อมูล SOP</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Action Buttons - Hidden when viewing from history or SOP completed */}
        {!fromHistory && !sopData?.sop_completed_at && (
          <div className="bg-white rounded-xl p-4">
            <JobActionButtons jobId={jobId} orderNumber={jobId} />
          </div>
        )}

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

            {/* SOP Photos */}
            {(sopPhotoUrl || docPhotoUrl) && (
              <div className="mt-4 space-y-3">
                {sopPhotoUrl && (
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-2">รูปสินค้า</p>
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                      <img src={sopPhotoUrl} alt="Product Photo" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                {docPhotoUrl && (
                  <div>
                    <p className="text-sm font-medium text-green-800 mb-2">รูปเอกสาร</p>
                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                      <img src={docPhotoUrl} alt="Document Photo" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
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
