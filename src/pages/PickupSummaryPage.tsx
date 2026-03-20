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
import { usePresignedImageUrl, usePresignedImageUrls } from "@/hooks/usePresignedImageUrl";
import { getDriverCheckins, getDriverAssignedJobs, getFreelanceAcceptedJobs, getDriverSop } from '@/lib/externalApi';
import { Scale } from "lucide-react";

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
}

interface WeightSlipItem {
  weight_in?: number | null;
  weight_out?: number | null;
  net_weight?: number | null;
  image_url?: string | null;
}

interface SOPData {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  sop_photo_url: string | null;
  doc_photo_url: string | null;
  weight_slips: WeightSlipItem[];
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
  const weightSlipImageUrls = (sopData?.weight_slips || []).map(ws => ws.image_url || null);
  const { urls: weightSlipPresignedUrls } = usePresignedImageUrls(weightSlipImageUrls);

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

      // Try to get job from navigation state first (passed from history or detail page)
      const stateJob = (location.state as any)?.job || (location.state as any)?.jobData;
      let foundJob: any = null;

      // Fetch job detail from external API directly - try multiple statuses
      if (isInternalDriver || isExternalDriver) {
        const [acceptedRes, arrivedAtPickupRes, inProgressRes, inTransitRes, deliveredRes] = await Promise.all([
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'accepted'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'arrived_at_pickup'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'in_progress'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'in_transit'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'delivered'),
        ]);
        const allJobs = [
          ...((acceptedRes.data as any)?.data || []),
          ...((arrivedAtPickupRes.data as any)?.data || []),
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
        ];
        foundJob = allJobs.find((j: any) => j.order_number === jobId);
      } else {
        const { data: jobResult, error: jobError } = await getFreelanceAcceptedJobs(driverId);
        if (!jobError && jobResult) {
          const jobData = (jobResult as any)?.data || jobResult || [];
          foundJob = Array.isArray(jobData) 
            ? jobData.find((j: any) => j.order_number === jobId)
            : null;
        }
      }

      // Fallback to navigation state
      if (!foundJob && stateJob) {
        foundJob = stateJob;
      }

      if (foundJob) {
        setJob({
          id: foundJob.order_number || foundJob.order_code || foundJob.id,
          order_code: foundJob.order_number || foundJob.order_code || jobId!,
          employer_name: foundJob.sender_name || foundJob.factory_name || foundJob.employer_name || '',
          origin_location: foundJob.sender_address || foundJob.origin_location || foundJob.origin_address || '',
          start_date: foundJob.sender_pickup_date || foundJob.start_date || '',
          start_time: foundJob.sender_pickup_time || foundJob.start_time || '',
        });
      }

      const { data: checkinResult, error: checkinError } = await getDriverCheckins(driverId, driverType, jobId);

      let checkedInAt: string | null = null;
      if (!checkinError) {
        const allCheckinsRaw = (checkinResult as any)?.data || checkinResult || [];
        const checkins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];

        // Find pickup check-in
        const pickupCheckin = checkins.find((c: any) => c.checkin_type === 'pickup');
        if (pickupCheckin) {
          checkedInAt = pickupCheckin.checkin_time || pickupCheckin.checked_in_at || pickupCheckin.created_at || null;
        }
      }

      // Fetch SOP data from external API directly
      const { data: sopResult, error: sopError } = await getDriverSop(driverId, driverType, jobId);

      if (!sopError && sopResult) {
        const sopData = (sopResult as any)?.data || sopResult || [];
        // Find pickup SOP
        const pickupSOP = Array.isArray(sopData)
          ? sopData.find((s: any) => s.sop_type === 'pickup' || s.status === 'pickup')
          : (sopData.sop_type === 'pickup' || sopData.status === 'pickup') ? sopData : null;

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
              weight_slips: pickupSOP.weight_slips || [],
            });
        } else {
          // No SOP yet, but might have check-in
          setSopData({
            checked_in_at: checkedInAt,
            sop_completed_at: null,
            sop_photo_url: null,
            doc_photo_url: null,
            weight_slips: [],
          });
        }
      } else {
        // No SOP data or error, set check-in only
        setSopData({
          checked_in_at: checkedInAt,
          sop_completed_at: null,
          sop_photo_url: null,
          doc_photo_url: null,
          weight_slips: [],
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
          <button onClick={() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
            navigate(`${backRoute}${fromHistory ? '?from=history' : ''}`, { state: { jobData: (location.state as any)?.jobData || job } });
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">ข้อมูล SOP</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Action Buttons - Hidden when viewing from history or SOP completed */}
        <div className="bg-white rounded-xl p-4">
          <JobActionButtons jobId={jobId} orderNumber={jobId} isPodCompleted={fromHistory ? false : !!sopData?.sop_completed_at} completedAt={sopData?.sop_completed_at} />
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
            
            {/* Weight Slips */}
            {sopData.weight_slips && sopData.weight_slips.length > 0 && (
              <div className="mt-4 space-y-4">
                <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1.5">
                  <Scale className="w-4 h-4" />
                  ใบชั่งน้ำหนัก ({sopData.weight_slips.length} ใบ)
                </p>
                {sopData.weight_slips.map((ws, idx) => (
                  <div key={idx} className="bg-white/60 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-green-700">ใบชั่งที่ {idx + 1}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-md p-2">
                        <p className="text-[10px] text-muted-foreground">น้ำหนักเข้า</p>
                        <p className="text-sm font-bold">{ws.weight_in != null ? `${ws.weight_in} กก.` : '-'}</p>
                      </div>
                      <div className="bg-white rounded-md p-2">
                        <p className="text-[10px] text-muted-foreground">น้ำหนักออก</p>
                        <p className="text-sm font-bold">{ws.weight_out != null ? `${ws.weight_out} กก.` : '-'}</p>
                      </div>
                      <div className="bg-white rounded-md p-2">
                        <p className="text-[10px] text-muted-foreground">น้ำหนักสุทธิ</p>
                        <p className="text-sm font-bold text-primary">{ws.net_weight != null ? `${ws.net_weight} กก.` : '-'}</p>
                      </div>
                    </div>
                    {weightSlipPresignedUrls[idx] && (
                      <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                        <img src={weightSlipPresignedUrls[idx]!} alt={`Weight Slip ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
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
