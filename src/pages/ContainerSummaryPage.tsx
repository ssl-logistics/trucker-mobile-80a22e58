import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Container, Hash } from 'lucide-react';
import { EditablePhoto } from '@/components/photo/EditablePhoto';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import { formatDateTime } from '@/lib/dateUtils';
import { usePresignedImageUrls } from '@/hooks/usePresignedImageUrl';
import { getDriverCheckins, getDriverAssignedJobs, getFreelanceAcceptedJobs, getDriverSop, getOcrContainerScans } from '@/lib/externalApi';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  container_checkpoint: string;
  start_date: string;
  start_time: string;
  bl_no?: string | null;
  booking_no?: string | null;
}

/** Extract driver ID from a checkin/SOP record regardless of driver type */
const getRecordDriverId = (record: any): string | null =>
  record?.internal_driver_id || record?.external_driver_id || record?.freelance_driver_id || record?.driver_id || null;

interface SOPData {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  sop_photo_url: string | null;
  // Container pickup confirmed (BL jobs)
  pickup_confirmed_at: string | null;
  pickup_photo_urls: string[];
  pickup_driver_id: string | null;
  // Container return specific
  return_checked_in_at: string | null;
  return_confirmed_at: string | null;
  return_photo_url: string | null;
  return_photo_urls: string[];
  return_driver_id: string | null;
}

interface OcrScanData {
  container_no: string | null;
  seal_no: string | null;
  container_image_url: string | null;
  seal_image_url: string | null;
  container_photos: string[];
  eir_photos: string[];
  driver_id: string | null;
  max_gross?: number | string | null;
  tare_weight?: number | string | null;
  net_weight?: number | string | null;
  bl_no?: string | null;
  booking_no?: string | null;
}

const parseUrlArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((url): url is string => typeof url === 'string' && url.length > 0);
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((url): url is string => typeof url === 'string' && url.length > 0)
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getUrlFilename = (url: string) => url.split('?')[0].split('/').pop()?.toLowerCase() || '';

const hasMeaningfulOcrValue = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.trim().toUpperCase() !== 'N/A';

const dedupeUrls = (urls: string[]) => Array.from(new Set(urls.filter(Boolean)));

const isEirDocumentUrl = (url: string) => {
  const filename = getUrlFilename(url);

  return (
    filename.startsWith('eir_') ||
    filename.startsWith('bl_eir_') ||
    filename.includes('-eir-') ||
    filename.includes('_eir_') ||
    filename.includes('eir-edit')
  );
};

const getPickupOcrData = (records: any[]): OcrScanData | null => {
  // Exclude return-yard records (container return step) — they carry N/A placeholders
  const pickupRecords = records.filter((record) => {
    if (record?.return_yard) return false;

    const containerPhotos = parseUrlArray(record?.container_photos);

    return (
      hasMeaningfulOcrValue(record?.container_no) ||
      hasMeaningfulOcrValue(record?.seal_no) ||
      hasMeaningfulOcrValue(record?.bl_no) ||
      hasMeaningfulOcrValue(record?.booking_no) ||
      hasMeaningfulOcrValue(record?.container_image_url) ||
      hasMeaningfulOcrValue(record?.seal_image_url) ||
      containerPhotos.length > 0
    );
  });

  if (pickupRecords.length === 0) {
    return null;
  }

  const firstMeaningfulValue = (values: unknown[]): string | null => {
    for (const value of values) {
      if (hasMeaningfulOcrValue(value)) {
        return value;
      }
    }
    return null;
  };

  return {
    container_no: firstMeaningfulValue(pickupRecords.map((record) => record?.container_no)),
    seal_no: firstMeaningfulValue(pickupRecords.map((record) => record?.seal_no)),
    container_image_url: firstMeaningfulValue(pickupRecords.map((record) => record?.container_image_url)),
    seal_image_url: firstMeaningfulValue(pickupRecords.map((record) => record?.seal_image_url)),
    container_photos: dedupeUrls(pickupRecords.flatMap((record) => parseUrlArray(record?.container_photos))),
    eir_photos: dedupeUrls(pickupRecords.flatMap((record) => parseUrlArray(record?.eir_photos))),
    driver_id: pickupRecords[0]?.internal_driver_id || pickupRecords[0]?.external_driver_id || pickupRecords[0]?.freelance_driver_id || pickupRecords[0]?.driver_id || null,
    max_gross: pickupRecords.find((r) => r?.max_gross != null)?.max_gross ?? null,
    tare_weight: pickupRecords.find((r) => r?.tare_weight != null)?.tare_weight ?? null,
    net_weight: pickupRecords.find((r) => r?.net_weight != null)?.net_weight ?? null,
    bl_no: firstMeaningfulValue(pickupRecords.map((record) => record?.bl_no)),
    booking_no: firstMeaningfulValue(pickupRecords.map((record) => record?.booking_no)),
  };
};

export default function ContainerSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [sopData, setSopData] = useState<SOPData | null>(null);
  const [ocrScanData, setOcrScanData] = useState<OcrScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const rawPickupPhotoUrls = sopData?.pickup_photo_urls || [];
  const rawPickupEirPhotoUrls = rawPickupPhotoUrls.filter(isEirDocumentUrl);
  const rawReturnPhotoUrls = sopData?.return_photo_urls || (sopData?.return_photo_url ? [sopData.return_photo_url] : []);
  const rawContainerPhotos = ocrScanData?.container_photos || [];
  const rawEirPhotos = ocrScanData?.eir_photos || [];
  const rawContainerImageUrl = ocrScanData?.container_image_url ? [ocrScanData.container_image_url] : [];
  const rawSealImageUrl = ocrScanData?.seal_image_url ? [ocrScanData.seal_image_url] : [];
  const { urls: presignedPickupEirPhotoUrls } = usePresignedImageUrls(rawPickupEirPhotoUrls);
  const { urls: presignedReturnPhotoUrls } = usePresignedImageUrls(rawReturnPhotoUrls);
  const { urls: presignedContainerPhotos } = usePresignedImageUrls(rawContainerPhotos);
  const { urls: presignedEirPhotos } = usePresignedImageUrls(rawEirPhotos);
  const { urls: presignedContainerImageUrl } = usePresignedImageUrls(rawContainerImageUrl);
  const { urls: presignedSealImageUrl } = usePresignedImageUrls(rawSealImageUrl);
  const pickupEirPhotoUrls = presignedPickupEirPhotoUrls.filter((url): url is string => Boolean(url));
  const returnPhotoUrls = presignedReturnPhotoUrls.filter((url): url is string => Boolean(url));
  const containerPhotos = presignedContainerPhotos.filter((url): url is string => Boolean(url));
  const eirPhotos = presignedEirPhotos.filter((url): url is string => Boolean(url));
  const containerNumberPhoto = presignedContainerImageUrl.filter((url): url is string => Boolean(url))[0] || null;
  const sealNumberPhoto = presignedSealImageUrl.filter((url): url is string => Boolean(url))[0] || null;

  const fromParam = new URLSearchParams(location.search).get('from');
  const isFromHistory = fromParam === 'history';
  // Determine ownership: photos uploaded by the current user are editable
  const isOwnPickupData = !sopData?.pickup_driver_id || sopData.pickup_driver_id === user?.id;
  const isOwnReturnData = !sopData?.return_driver_id || sopData.return_driver_id === user?.id;
  const isOwnOcrData = !ocrScanData?.driver_id || ocrScanData.driver_id === user?.id;
  const checkinType = (location.state as any)?.checkinType || 'container_pickup';
  const photoEditCompletedAt = sopData?.return_confirmed_at || sopData?.pickup_confirmed_at || sopData?.sop_completed_at || null;

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

      // Try to get job from navigation state first
      const stateJob = (location.state as any)?.job || (location.state as any)?.jobData;
      let foundJob: any = null;

      // Fetch job from external API - try multiple statuses
      if (isInternalDriver || isExternalDriver) {
        const [inProgressRes, inTransitRes, deliveredRes, completedRes] = await Promise.all([
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'in_progress'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'in_transit'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'delivered'),
          getDriverAssignedJobs(driverId, driverType as 'internal' | 'external', 50, 'completed'),
        ]);
        const allJobs = [
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
          ...((completedRes.data as any)?.data || []),
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
          container_checkpoint: foundJob.container_pickup_location || foundJob.container_checkpoint || foundJob.container_return_location || '',
          start_date: foundJob.sender_pickup_date || foundJob.start_date || '',
          start_time: foundJob.sender_pickup_time || foundJob.start_time || '',
          bl_no: foundJob.bl_no || null,
          booking_no: foundJob.booking_no || null,
        });
      }

      // Get the job's UUID for filtering checkins
      const jobUuid = foundJob?.id || null;

      // Fetch check-in data from external API
      const { data: checkinResult, error: checkinError } = await getDriverCheckins(driverId, driverType, jobId);

      let checkedInAt: string | null = null;
      let pickupConfirmedAt: string | null = null;
      let pickupPhotoUrls: string[] = [];
      let pickupDriverId: string | null = null;
      let returnCheckedInAt: string | null = null;
      let returnConfirmedAt: string | null = null;
      let returnPhotoUrl: string | null = null;
      let returnPhotoUrls: string[] = [];
      let returnDriverId: string | null = null;

      if (!checkinError) {
        const allCheckinsRaw = (checkinResult as any)?.data || checkinResult || [];
        const allCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];
        
        // Filter checkins by transport_order_id (UUID) or order_number to ensure correct job
        const checkins = allCheckins.filter((c: any) => {
          // Match by transport_order_id (UUID) if available
          if (jobUuid && c.transport_order_id) {
            return c.transport_order_id === jobUuid;
          }
          // Fallback: match by order_number
          const orderNum = c.transport_orders?.order_number;
          return orderNum === jobId;
        });

        // Find container pickup check-in
        const containerCheckin = checkins.find((c: any) =>
          c.checkin_type === 'container_pickup'
        );
        if (containerCheckin) {
          checkedInAt = containerCheckin.checkin_time || containerCheckin.checked_in_at || containerCheckin.created_at || null;
        }

        // Find container pickup confirmed (BL jobs - EIR photos)
        const pickupConfirmed = checkins.find((c: any) =>
          c.checkin_type === 'container_pickup_confirmed'
        );
        if (pickupConfirmed) {
          pickupConfirmedAt = pickupConfirmed.checkin_time || pickupConfirmed.checked_in_at || pickupConfirmed.created_at || null;
          pickupDriverId = getRecordDriverId(pickupConfirmed);
          const pPhotoUrlsRaw = pickupConfirmed.photo_urls;
          if (Array.isArray(pPhotoUrlsRaw)) {
            pickupPhotoUrls = pPhotoUrlsRaw.filter(Boolean);
          } else if (typeof pPhotoUrlsRaw === 'string') {
            try {
              const parsed = JSON.parse(pPhotoUrlsRaw);
              pickupPhotoUrls = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch {
              pickupPhotoUrls = [];
            }
          }
          if (pickupPhotoUrls.length === 0 && pickupConfirmed.photo_url) {
            pickupPhotoUrls = [pickupConfirmed.photo_url];
          }
        }

        // Find container return check-in
        const returnCheckin = checkins.find((c: any) =>
          c.checkin_type === 'container_return'
        );
        if (returnCheckin) {
          returnCheckedInAt = returnCheckin.checkin_time || returnCheckin.checked_in_at || returnCheckin.created_at || null;
        }

        // Find container return confirmed
        const returnConfirmed = checkins.find((c: any) =>
          c.checkin_type === 'container_return_confirmed'
        );
        if (returnConfirmed) {
          returnConfirmedAt = returnConfirmed.checkin_time || returnConfirmed.checked_in_at || returnConfirmed.created_at || null;
          returnDriverId = getRecordDriverId(returnConfirmed);
          returnPhotoUrl = returnConfirmed.photo_url || null;
          const photoUrlsRaw = returnConfirmed.photo_urls;
          if (Array.isArray(photoUrlsRaw)) {
            returnPhotoUrls = photoUrlsRaw.filter(Boolean);
          } else if (typeof photoUrlsRaw === 'string') {
            try {
              const parsed = JSON.parse(photoUrlsRaw);
              returnPhotoUrls = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } catch {
              returnPhotoUrls = [];
            }
          }
          if (returnPhotoUrls.length === 0 && returnPhotoUrl) {
            returnPhotoUrls = [returnPhotoUrl];
          }
        }
      }

      // Fetch SOP data from external API
      const { data: sopResult, error: sopError } = await getDriverSop(driverId, driverType, jobId);

      let sopCompletedAt: string | null = null;
      let sopPhotoUrlVal: string | null = null;

      if (!sopError && sopResult) {
        const sopDataArr = (sopResult as any)?.data || sopResult || [];
        const containerSOP = Array.isArray(sopDataArr)
          ? sopDataArr.find((s: any) =>
              s.sop_type === 'container_pickup' || s.sop_type === 'container_return' ||
              s.status === 'container_pickup' || s.status === 'container_return'
            )
          : null;

        if (containerSOP) {
          const productImages = containerSOP.product_images || [];
          sopPhotoUrlVal = productImages.length > 0 ? productImages[0] : null;
          sopCompletedAt = containerSOP.recorded_at || containerSOP.created_at || null;
        }
      }

      setSopData({
        checked_in_at: checkedInAt,
        sop_completed_at: sopCompletedAt,
        sop_photo_url: sopPhotoUrlVal,
        pickup_confirmed_at: pickupConfirmedAt,
        pickup_photo_urls: pickupPhotoUrls,
        pickup_driver_id: pickupDriverId,
        return_checked_in_at: returnCheckedInAt,
        return_confirmed_at: returnConfirmedAt,
        return_photo_url: returnPhotoUrl,
        return_photo_urls: returnPhotoUrls,
        return_driver_id: returnDriverId,
      });

      // Fetch OCR scan data for container/seal photos
      try {
        const { data: ocrResult, error: ocrError } = await getOcrContainerScans(undefined, 10, jobId);
        if (!ocrError && ocrResult) {
          const ocrArr = (ocrResult as any)?.data || ocrResult || [];
          setOcrScanData(Array.isArray(ocrArr) ? getPickupOcrData(ocrArr) : null);
        }
      } catch (e) {
        console.warn('OCR scan data fetch failed:', e);
      }

    } catch (error) {
      console.error('Error loading container summary:', error);
      toast({
        title: t('containerSummary.error'),
        description: t('containerSummary.loadError'),
        variant: 'destructive'
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
          <p className="text-muted-foreground mb-4">{t('containerSummary.loadError') || 'ไม่พบข้อมูลงาน'}</p>
          <button 
            onClick={() => navigate(fromParam === 'history' ? '/history' : '/current-jobs')}
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
            navigate(`${backRoute}${fromParam ? `?from=${fromParam}` : ''}`, { state: { jobData: (location.state as any)?.jobData || job } });
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{job.container_checkpoint || t('containerSummary.checkInSuccess')}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Action Buttons */}
        <JobActionButtons jobId={jobId!} orderNumber={jobId!} checkinType={checkinType as any} completedAt={sopData?.return_confirmed_at || sopData?.sop_completed_at} jobData={(location.state as any)?.jobData || (location.state as any)?.job} />

        {/* Container Pickup Evidence - only show when viewing pickup context */}
        {checkinType !== 'container_return' && (
          <>
            {/* Container Pickup Confirmed Status (BL jobs) */}
            {sopData?.pickup_confirmed_at && (
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-green-900">แนบหลักฐานรับตู้สำเร็จ</div>
                    <div className="text-sm text-green-700">
                      {formatDateTime(sopData.pickup_confirmed_at, language)}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Selected Container & Seal from BL */}
            {ocrScanData && (ocrScanData.container_no || ocrScanData.seal_no || ocrScanData.bl_no || ocrScanData.booking_no) && (
              <Card className="p-4 border-border">
                <div className="text-sm font-semibold text-foreground mb-3">ข้อมูล OCR</div>
                <div className="space-y-2">
                  {ocrScanData.booking_no && (
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">เลขที่ OCR Booking:</span>
                      <span className="text-sm font-medium text-foreground">{ocrScanData.booking_no}</span>
                    </div>
                  )}
                  {ocrScanData.container_no && (
                    <div className="flex items-center gap-2">
                      <Container className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">เลขตู้:</span>
                      <span className="text-sm font-medium text-foreground">{ocrScanData.container_no}</span>
                    </div>
                  )}
                  {ocrScanData.seal_no && (
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">เลขซีล:</span>
                      <span className="text-sm font-medium text-foreground">{ocrScanData.seal_no}</span>
                    </div>
                  )}
                  {(ocrScanData.max_gross != null || ocrScanData.tare_weight != null || ocrScanData.net_weight != null) && (
                    <div className="pt-2 mt-2 border-t border-border grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">MAX GROSS</div>
                        <div className="text-sm font-medium text-foreground">
                          {ocrScanData.max_gross != null ? `${Number(ocrScanData.max_gross).toLocaleString()} kg` : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">TARE</div>
                        <div className="text-sm font-medium text-foreground">
                          {ocrScanData.tare_weight != null ? `${Number(ocrScanData.tare_weight).toLocaleString()} kg` : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">NET</div>
                        <div className="text-sm font-medium text-foreground">
                          {ocrScanData.net_weight != null ? `${Number(ocrScanData.net_weight).toLocaleString()} kg` : '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Container Number Photo (OCR) */}
            {containerNumberPhoto && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">รูปเลขตู้</div>
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <EditablePhoto src={containerNumberPhoto} alt="Container Number" originalUrl={ocrScanData?.container_image_url} folder="container-photos" filenamePrefix={`${user?.id}-${jobId}-container-edit`} completedAt={photoEditCompletedAt} fromHistory={isFromHistory} isOwnData={isOwnOcrData}  />
                </div>
              </div>
            )}

            {/* Seal Number Photo (OCR) */}
            {sealNumberPhoto && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">รูปเลขซีล</div>
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
                  <EditablePhoto src={sealNumberPhoto} alt="Seal Number" originalUrl={ocrScanData?.seal_image_url} folder="container-photos" filenamePrefix={`${user?.id}-${jobId}-seal-edit`} completedAt={photoEditCompletedAt} fromHistory={isFromHistory} isOwnData={isOwnOcrData}  />
                </div>
              </div>
            )}

            {/* Container Photos (from OCR scan) */}
            {containerPhotos.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">รูปตู้ ({containerPhotos.length} รูป)</div>
                <div className="grid grid-cols-2 gap-2">
                  {containerPhotos.map((url, idx) => (
                    <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden bg-muted">
                      <EditablePhoto src={url} alt={`Container Photo ${idx + 1}`} originalUrl={rawContainerPhotos[idx]} folder="container-photos" filenamePrefix={`${user?.id}-${jobId}-container-${idx}-edit`} completedAt={photoEditCompletedAt} fromHistory={isFromHistory} isOwnData={isOwnOcrData}  />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EIR Document Photos - merge OCR scan eir_photos + EIR-only checkin photo_urls, deduplicated */}
            {(eirPhotos.length > 0 || pickupEirPhotoUrls.length > 0) && (
              <div className="space-y-2">
                {(() => {
                  // Merge both sources and deduplicate by URL basename
                  const seen = new Set<string>();
                  const mergedUrls: string[] = [];
                  const mergedRawUrls: string[] = [];
                  const addUrl = (url: string, rawUrl?: string) => {
                    const key = getUrlFilename(url) || url;
                    if (!seen.has(key)) {
                      seen.add(key);
                      mergedUrls.push(url);
                      mergedRawUrls.push(rawUrl || url);
                    }
                  };
                  eirPhotos.forEach((u, i) => addUrl(u, rawEirPhotos[i]));
                  pickupEirPhotoUrls.forEach((u, i) => addUrl(u, rawPickupEirPhotoUrls[i]));
                  return (
                    <>
                      <div className="text-sm text-muted-foreground">เอกสาร EIR ({mergedUrls.length} รูป)</div>
                      <div className="grid grid-cols-2 gap-2">
                        {mergedUrls.map((url, idx) => (
                          <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden bg-muted">
                            <EditablePhoto src={url} alt={`EIR Document ${idx + 1}`} originalUrl={mergedRawUrls[idx]} folder="container-photos" filenamePrefix={`${user?.id}-${jobId}-eir-${idx}-edit`} completedAt={photoEditCompletedAt} fromHistory={isFromHistory} isOwnData={isOwnPickupData}  />
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {/* Container Return Check-in Status - only show in return context */}
        {checkinType === 'container_return' && sopData?.return_checked_in_at && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-green-900">เช็คอินจุดคืนตู้สำเร็จ</div>
                <div className="text-sm text-green-700">
                  {formatDateTime(sopData.return_checked_in_at, language)}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Container Return Document Photos - only show in return context */}
        {checkinType === 'container_return' && returnPhotoUrls.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">เอกสารคืนตู้ ({returnPhotoUrls.length} รูป)</div>
            <div className="grid grid-cols-2 gap-2">
              {returnPhotoUrls.map((url, idx) => (
                <div key={idx} className="w-full aspect-square rounded-lg overflow-hidden bg-muted">
                  <EditablePhoto src={url} alt={`Container Return Document ${idx + 1}`} originalUrl={rawReturnPhotoUrls[idx]} folder="container-photos" filenamePrefix={`${user?.id}-${jobId}-return-${idx}-edit`} completedAt={photoEditCompletedAt} fromHistory={isFromHistory} isOwnData={isOwnReturnData}  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
