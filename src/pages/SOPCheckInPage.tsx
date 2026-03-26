import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Image as ImageIcon, CheckCircle, Scale, Loader2, Plus, Trash2 } from 'lucide-react';
import { useOCR } from '@/hooks/useOCR';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import JobActionButtons from '@/components/job/JobActionButtons';
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate, formatTime } from '@/lib/dateUtils';
import { getFreelanceAcceptedJobs, getDriverSop, driverSop, getDriverAssignedJobs, updateOrderStatus } from '@/lib/externalApi';
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
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { fetchAcceptedBidTickets, mapBidTicketToPickupLikeJobDetail } from '@/lib/bidTickets';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  origin_company_name?: string | null;
  start_date: string;
  start_time: string;
  bl_no?: string | null;
  booking_no?: string | null;
  transport_category?: string | null;
}

export default function SOPCheckInPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isBidJob, setIsBidJob] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [docPhotoFile, setDocPhotoFile] = useState<File | null>(null);
  const [docPhotoPreview, setDocPhotoPreview] = useState<string>('');
  const [weightSlips, setWeightSlips] = useState<Array<{
    file: File;
    preview: string;
    ocrData: { weight_in?: number | null; weight_out?: number | null; net_weight?: number | null } | null;
  }>>([]);
  const [activeWeightSlipIndex, setActiveWeightSlipIndex] = useState<number>(-1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkInTime] = useState(new Date());
  const [existingSOP, setExistingSOP] = useState<any>(null);
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);
  const { extractFromImage, extracting: ocrExtracting } = useOCR();

  // Request GPS permission on mount
  useEffect(() => {
    const requestGpsPermission = async () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        setGpsPermissionGranted(false);
        return;
      }

      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        setGpsPermissionGranted(true);
        console.log('✅ GPS permission granted');
      } catch (error) {
        console.warn('❌ GPS permission denied or error:', error);
        setGpsPermissionGranted(false);
        toast({
          title: 'ต้องการสิทธิ์ GPS',
          description: 'กรุณาอนุญาตให้เข้าถึงตำแหน่งเพื่อใช้งานฟีเจอร์นี้',
          variant: 'destructive',
        });
      }
    };

    requestGpsPermission();
  }, []);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user, isInternalDriver, isExternalDriver]);

  useEffect(() => {
    if (job && user) {
      checkExistingSOP();
    }
  }, [job, user]);

  const checkExistingSOP = async () => {
    if (!user || !job) return;

    try {
      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
      
      // Use direct external API call
      const { data: result, error } = await getDriverSop(user.id, driverType, job.order_code);

      if (!error && result) {
        const sopData = (result as any)?.data || result;
        if (sopData) {
          // Find pickup SOP
          const pickupSOP = Array.isArray(sopData) 
            ? sopData.find((s: any) => s.sop_type === 'pickup')
            : sopData.sop_type === 'pickup' ? sopData : null;
          
          if (pickupSOP) {
            setExistingSOP(pickupSOP);
            // If SOP already exists, show existing photos
            if (pickupSOP.product_images?.length > 0) {
              setPhotoPreview(pickupSOP.product_images[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing SOP:', error);
    }
  };

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    
    try {
      // Priority 1: Use job data from navigation state
      const stateJobData = (location.state as any)?.jobData;
      const stateIsBidJob = (location.state as any)?.isBidJob;
      if (stateJobData) {
        setIsBidJob(!!stateIsBidJob);
        setJob({
          id: stateJobData.id,
          order_code: stateJobData.order_code || jobId,
          employer_name: stateJobData.employer_name || '-',
          origin_location: stateJobData.origin_location || '-',
          origin_company_name: stateJobData.origin_company_name ?? null,
          start_date: stateJobData.start_date || '',
          start_time: stateJobData.start_time || '00:00',
        });
        setLoading(false);
        return;
      }

      let foundJob: any = null;

      // For Internal/External drivers, use get-driver-assigned-jobs
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        const [inProgressRes, inTransitRes, deliveredRes, returningContainerRes, atContainerReturnRes, containerReturnedRes] = await Promise.all([
          getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
          getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
          getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
          getDriverAssignedJobs(user.id, driverType, 50, 'returning_container'),
          getDriverAssignedJobs(user.id, driverType, 50, 'at_container_return'),
          getDriverAssignedJobs(user.id, driverType, 50, 'container_returned'),
        ]);
        foundJob = [
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
          ...((returningContainerRes.data as any)?.data || []),
          ...((atContainerReturnRes.data as any)?.data || []),
          ...((containerReturnedRes.data as any)?.data || []),
        ].find((j: any) => j.order_number === jobId);
      } else {
        // For Freelance drivers, use getFreelanceAcceptedJobs
        const { data: result, error } = await getFreelanceAcceptedJobs(user.id);

        if (error) {
          throw new Error('Failed to fetch job details');
        }

        if (result) {
          console.log('Freelance job API response:', result);
          
          if (result.data) {
            foundJob = result.data.find((j: any) => j.order_number === jobId);
          }
        }
      }
      
      if (foundJob) {
        // Check if this is a bid job by remarks pattern
        const isBidOrigin = foundJob.remarks?.includes('งานจากระบบประมูลภายนอก');
        if (isBidOrigin) {
          try {
            const tickets = await fetchAcceptedBidTickets(50, user?.id);
            const ticket = tickets.find((t) => t.ticket_number === jobId || t.id === jobId);
            if (ticket) {
              setIsBidJob(true);
              const mapped = mapBidTicketToPickupLikeJobDetail(ticket);
              setJob({
                id: mapped.id,
                order_code: mapped.order_code,
                employer_name: mapped.employer_name,
                origin_location: mapped.origin_location,
                origin_company_name: mapped.origin_company_name,
                start_date: mapped.start_date,
                start_time: mapped.start_time,
              });
              setLoading(false);
              return;
            }
          } catch {
            // Fall through to use freelance API data
          }
        }
        setIsBidJob(false);
        // Map API response to JobDetail interface
        const mappedJob: JobDetail = {
          id: foundJob.id,
          order_code: foundJob.order_number,
          employer_name: foundJob.sender_name || foundJob.factory_name,
          origin_location: `${foundJob.sender_district}, ${foundJob.sender_province}`,
          origin_company_name: foundJob.sender_name || foundJob.factory_name,
          start_date: foundJob.sender_pickup_date,
          start_time: foundJob.sender_pickup_time,
        };
        setJob(mappedJob);
      } else {
        // Fallback: try to load as Bid job (ticket_number)
        const tickets = await fetchAcceptedBidTickets(50, user?.id);
        const ticket = tickets.find((t) => t.ticket_number === jobId || t.id === jobId);
        if (!ticket) throw new Error('Job not found');

        setIsBidJob(true);
        const mapped = mapBidTicketToPickupLikeJobDetail(ticket);
        setJob({
          id: mapped.id,
          order_code: mapped.order_code,
          employer_name: mapped.employer_name,
          origin_location: mapped.origin_location,
          origin_company_name: mapped.origin_company_name,
          start_date: mapped.start_date,
          start_time: mapped.start_time,
        });
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('sop.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
  };

  const [activePhotoType, setActivePhotoType] = useState<'product' | 'document' | 'weightslip'>('product');

  const handlePhotoSelect = async (source: 'camera' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (activePhotoType === 'product') {
          setPhotoFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setPhotoPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else if (activePhotoType === 'document') {
          setDocPhotoFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setDocPhotoPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
        } else if (activePhotoType === 'weightslip') {
          const reader = new FileReader();
          reader.onloadend = () => {
            const preview = reader.result as string;
            const newIndex = activeWeightSlipIndex >= 0 ? activeWeightSlipIndex : weightSlips.length;
            setWeightSlips(prev => {
              const updated = [...prev];
              if (activeWeightSlipIndex >= 0) {
                updated[activeWeightSlipIndex] = { file, preview, ocrData: null };
              } else {
                updated.push({ file, preview, ocrData: null });
              }
              return updated;
            });
            // Run OCR
            (async () => {
              try {
                const result = await extractFromImage(file, 'weight_slip');
                if (result.success && result.data) {
                  setWeightSlips(prev => {
                    const updated = [...prev];
                    if (updated[newIndex]) {
                      updated[newIndex] = {
                        ...updated[newIndex],
                        ocrData: {
                          weight_in: result.data?.weight_in ?? null,
                          weight_out: result.data?.weight_out ?? null,
                          net_weight: result.data?.net_weight ?? null,
                        },
                      };
                    }
                    return updated;
                  });
                  toast({ title: 'สแกนสำเร็จ', description: 'อ่านข้อมูลใบชั่งน้ำหนักเรียบร้อย' });
                }
              } catch (err) {
                console.error('Weight slip OCR error:', err);
              }
            })();
          };
          reader.readAsDataURL(file);
        }
      }
    };
    
    input.click();
    setDrawerOpen(false);
  };

  const openPhotoDrawer = (type: 'product' | 'document' | 'weightslip', wsIndex?: number) => {
    setActivePhotoType(type);
    setActiveWeightSlipIndex(wsIndex !== undefined ? wsIndex : -1);
    setDrawerOpen(true);
  };

  const handleConfirmClick = () => {
    if (!photoFile || !docPhotoFile) {
      toast({
        title: t('sop.photoRequired'),
        description: 'กรุณาอัพโหลดรูปสินค้าและรูปเอกสารให้ครบ',
        variant: 'destructive'
      });
      return;
    }
    if (ocrExtracting) {
      toast({
        title: 'กำลังอ่านข้อมูล',
        description: 'กรุณารอให้ระบบอ่านข้อมูลใบชั่งน้ำหนักเสร็จก่อน',
        variant: 'destructive'
      });
      return;
    }
    if (weightSlips.length > 0 && weightSlips.some(ws => ws.ocrData === null)) {
      toast({
        title: 'รอข้อมูล OCR',
        description: 'กรุณารอให้ระบบอ่านข้อมูลใบชั่งน้ำหนักเสร็จก่อนยืนยัน',
        variant: 'destructive'
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSOP = async () => {
    if (!photoFile || !job || !user) return;

    setUploading(true);

    try {
      // Upload all images in PARALLEL for speed
      const timestamp = Date.now();
      
      // Prepare all upload promises
      const productFormData = new FormData();
      productFormData.append('file', photoFile);
      productFormData.append('folder', 'mobile/sop-photos');
      productFormData.append('filename', `${user.id}-${job.order_code}-product-${timestamp}`);
      const productUploadPromise = supabase.functions.invoke('upload-to-s3', { body: productFormData });

      const docUploadPromise = docPhotoFile ? (() => {
        const docFormData = new FormData();
        docFormData.append('file', docPhotoFile);
        docFormData.append('folder', 'mobile/sop-docs');
        docFormData.append('filename', `${user.id}-${job.order_code}-doc-${timestamp}`);
        return supabase.functions.invoke('upload-to-s3', { body: docFormData });
      })() : Promise.resolve({ data: null, error: null });

      const weightSlipUploadPromises = weightSlips.map((ws, i) => {
        const wsFormData = new FormData();
        wsFormData.append('file', ws.file);
        wsFormData.append('folder', 'mobile/sop-weightslip');
        wsFormData.append('filename', `${user.id}-${job.order_code}-weightslip-${i}-${timestamp}`);
        return supabase.functions.invoke('upload-to-s3', { body: wsFormData });
      });

      // Execute all uploads in parallel
      const [productResult, docResult, ...weightSlipResults] = await Promise.all([
        productUploadPromise,
        docUploadPromise,
        ...weightSlipUploadPromises,
      ]);

      if (productResult.error || !productResult.data?.url) {
        throw new Error('Failed to upload product image');
      }

      const productImageUrl = productResult.data.url;
      const documentImageUrl = docResult.data?.url || null;
      const weightSlipImageUrls = weightSlipResults
        .filter(r => !r.error && r.data?.url)
        .map(r => r.data.url);

      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Build document images array (without weight slip images)
      const docImages = [
        ...(documentImageUrl ? [documentImageUrl] : []),
      ];

      // Call driver-sop API directly
      const sopBody: Record<string, unknown> = {
        order_number: job.order_code,
        driver_id: user.id,
        driver_type: driverType,
        sop_type: 'pickup',
        product_images: [productImageUrl],
        document_images: docImages,
      };

      // Build weight_slips array with image_url per slip
      if (weightSlips.length > 0) {
        sopBody.weight_slips = weightSlips.map((ws, i) => ({
          weight_in: ws.ocrData?.weight_in ?? null,
          weight_out: ws.ocrData?.weight_out ?? null,
          net_weight: ws.ocrData?.net_weight ?? null,
          image_url: weightSlipImageUrls[i] || null,
        }));
      }

      const { data: sopResult, error: sopError } = await driverSop(sopBody as any);

      if (sopError) {
        throw new Error(sopError || 'Failed to submit SOP');
      }

      // Send returning_container status for international jobs (BL/Booking)
      const isInternationalJob = !!(job.bl_no || job.booking_no || job.transport_category === 'international');
      if (isInternationalJob) {
        const driverTypeStatus = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';
        updateOrderStatus({
          order_number: job.order_code,
          status: 'returning_container',
          driver_id: user.id,
          driver_type: driverTypeStatus as 'internal' | 'external' | 'freelance',
          notes: 'SOP รับสินค้าเสร็จ - เตรียมคืนตู้',
        }).catch(err => console.warn('[SOPCheckIn] updateOrderStatus error (non-blocking):', err));
      }

      toast({
        title: t('sop.sopSuccess'),
        description: t('sop.sopSuccessMessage'),
      });

      navigate(isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`);
    } catch (error) {
      console.error('Error confirming SOP:', error);
      toast({
        title: t('sop.error'),
        description: t('sop.errorMessage'),
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setShowConfirmDialog(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => {
            const fromParam = new URLSearchParams(location.search).get('from');
            const backRoute = (isBidJob || (location.state as any)?.isBidJob) ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
            navigate(`${backRoute}${fromParam ? `?from=${fromParam}` : ''}`);
          }} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('sop.title')} {job.origin_company_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} orderNumber={jobId} />

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-green-900">{t('sop.checkInSuccess')}</div>
              <div className="text-sm text-green-700">
                {formatDate(job.start_date, language)} | {formatTime(checkInTime)}
              </div>
            </div>
          </div>
        </Card>

        {/* Product Photo Upload */}
        <div className="space-y-2">
          <Label className="text-base">
            {t('sop.uploadPhoto')} <span className="text-destructive">*</span>
          </Label>
          
          <button
            onClick={() => openPhotoDrawer('product')}
            className="w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors bg-card"
          >
            {photoPreview ? (
              <img 
                src={photoPreview} 
                alt="Product Preview" 
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Camera className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center px-4" dangerouslySetInnerHTML={{ __html: `${t('sop.clickToTake')}<br />${t('sop.productPhoto')}` }} />
              </>
            )}
          </button>
        </div>

        {/* Document Photo Upload */}
        <div className="space-y-2">
          <Label className="text-base">
            อัพโหลดรูปเอกสาร <span className="text-destructive">*</span>
          </Label>
          
          <button
            onClick={() => openPhotoDrawer('document')}
            className="w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors bg-card"
          >
            {docPhotoPreview ? (
              <img 
                src={docPhotoPreview} 
                alt="Document Preview" 
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <ImageIcon className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center px-4">
                  กดเพื่อถ่ายหรือเลือก<br />รูปเอกสาร
                </p>
              </>
            )}
          </button>
        </div>

        {/* Weight Slip Photos + OCR (Optional, Multiple) */}
        <div className="space-y-2">
          <Label className="text-base">
            สแกนใบชั่งน้ำหนัก <span className="text-muted-foreground text-sm">(ไม่บังคับ)</span>
          </Label>
          
          {weightSlips.map((ws, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">ใบที่ {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setWeightSlips(prev => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <button
                onClick={() => openPhotoDrawer('weightslip', index)}
                className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-card relative"
              >
                {ocrExtracting && activeWeightSlipIndex === index && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">กำลังสแกน OCR...</span>
                    </div>
                  </div>
                )}
                <img 
                  src={ws.preview} 
                  alt={`Weight Slip ${index + 1}`} 
                  className="w-full h-full object-cover rounded-lg"
                />
              </button>

              {ws.ocrData && (ws.ocrData.weight_in != null || ws.ocrData.weight_out != null || ws.ocrData.net_weight != null) && (
                <Card className="p-3 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-amber-900">ข้อมูลที่อ่านได้ <span className="text-xs font-normal text-amber-600">(แก้ไขได้)</span></p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center p-2 bg-white rounded-lg border border-amber-200">
                          <p className="text-[10px] text-amber-700 mb-1">น้ำหนักรถเข้า</p>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-full text-center text-sm font-bold text-amber-900 bg-transparent border-b border-amber-300 focus:border-amber-500 focus:outline-none pb-0.5"
                            value={ws.ocrData.weight_in ?? ''}
                            onChange={(e) => setWeightSlips(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], ocrData: { ...updated[index].ocrData!, weight_in: e.target.value ? Number(e.target.value) : null } };
                              return updated;
                            })}
                            placeholder="-"
                          />
                          <p className="text-[9px] text-amber-500 mt-0.5">kg</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg border border-amber-200">
                          <p className="text-[10px] text-amber-700 mb-1">น้ำหนักรถออก</p>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-full text-center text-sm font-bold text-amber-900 bg-transparent border-b border-amber-300 focus:border-amber-500 focus:outline-none pb-0.5"
                            value={ws.ocrData.weight_out ?? ''}
                            onChange={(e) => setWeightSlips(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], ocrData: { ...updated[index].ocrData!, weight_out: e.target.value ? Number(e.target.value) : null } };
                              return updated;
                            })}
                            placeholder="-"
                          />
                          <p className="text-[9px] text-amber-500 mt-0.5">kg</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-lg border border-amber-200">
                          <p className="text-[10px] text-amber-700 mb-1">น้ำหนักสุทธิ</p>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-full text-center text-sm font-bold text-green-700 bg-transparent border-b border-green-300 focus:border-green-500 focus:outline-none pb-0.5"
                            value={ws.ocrData.net_weight ?? ''}
                            onChange={(e) => setWeightSlips(prev => {
                              const updated = [...prev];
                              updated[index] = { ...updated[index], ocrData: { ...updated[index].ocrData!, net_weight: e.target.value ? Number(e.target.value) : null } };
                              return updated;
                            })}
                            placeholder="-"
                          />
                          <p className="text-[9px] text-green-500 mt-0.5">kg</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ))}

          {/* Add new weight slip button */}
          <button
            onClick={() => openPhotoDrawer('weightslip')}
            className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors bg-card"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              {weightSlips.length === 0 ? (
                <Scale className="w-6 h-6 text-amber-600" />
              ) : (
                <Plus className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center px-4">
              {weightSlips.length === 0 ? 'กดเพื่อถ่ายหรือเลือกใบชั่งน้ำหนัก' : 'เพิ่มใบชั่งน้ำหนักอีก'}
            </p>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={handleConfirmClick}
          disabled={uploading || !photoFile || !docPhotoFile || ocrExtracting || (weightSlips.length > 0 && weightSlips.some(ws => ws.ocrData === null))}
        >
          {t('sop.confirmSOP')}
        </Button>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            <DialogTitle className="text-xl text-center">
              {t('sop.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('sop.confirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 h-11"
              disabled={uploading}
            >
              {t('sop.cancel')}
            </Button>
            <Button
              onClick={handleConfirmSOP}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
            >
              {uploading ? t('sop.saving') : t('sop.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">{t('sop.selectSource')}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('camera')}
            >
              <Camera className="w-6 h-6" />
              {t('sop.takePhoto')}
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base justify-start gap-3"
              onClick={() => handlePhotoSelect('gallery')}
            >
              <ImageIcon className="w-6 h-6" />
              {t('sop.selectFromGallery')}
            </Button>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12">
                {t('sop.cancel')}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
