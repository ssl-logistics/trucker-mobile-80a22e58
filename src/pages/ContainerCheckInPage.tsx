import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, MapPin, Phone, Loader2, ChevronDown } from 'lucide-react';
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendJobStatus } from '@/lib/jobStatusService';
import GoogleMap from '@/components/GoogleMap';
import { formatDate } from '@/lib/dateUtils';
import JobActionButtons from '@/components/job/JobActionButtons';
import { getDriverCheckins, driverCheckin, getDriverAssignedJobs, getFreelanceAcceptedJobs, getOcrContainerScans } from '@/lib/externalApi';

interface ContainerDetailItem {
  containerNo?: string;
  sealNo?: string;
}

interface JobDetail {
  id: string;
  order_code: string;
  transport_type: string | null;
  job_type: string | null;
  employer_name: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  container_checkpoint_latitude: number | null;
  container_checkpoint_longitude: number | null;
  container_checkpoint_time: string | null;
  empty_container_date: string | null;
  container_number: string | null;
  seal_number: string | null;
  container_number_2: string | null;
  seal_number_2: string | null;
  origin_location: string | null;
  origin_company_name: string | null;
  equipment_list: string | null;
  container_return_location: string | null;
  container_return_address: string | null;
  container_return_latitude: number | null;
  container_return_longitude: number | null;
  container_return_phone: string | null;
  container_details: ContainerDetailItem[];
  bl_no: string | null;
}

export default function ContainerCheckInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  
  // Determine if this is a container return flow
  const navState = location.state as { jobData?: any; checkinType?: string } | null;
  const isContainerReturn = navState?.checkinType === 'container_return';
  
  // Editable container fields for inbound
  const [container1Number, setContainer1Number] = useState('');
  const [container1Seal, setContainer1Seal] = useState('');
  const [container2Number, setContainer2Number] = useState('');
  const [container2Seal, setContainer2Seal] = useState('');
  const [isOcrVerified, setIsOcrVerified] = useState(false);
  const [selectedContainerIndex, setSelectedContainerIndex] = useState<string>('');
  
  const isInbound = job?.transport_type?.includes('ขาเข้า');
  
  useEffect(() => {
    loadJobDetail();
  }, [jobId, user, isInternalDriver, isExternalDriver]);

  useEffect(() => {
    if (job) {
      setContainer1Number(job.container_number || '');
      setContainer1Seal(job.seal_number || '');
      setContainer2Number(job.container_number_2 || '');
      setContainer2Seal(job.seal_number_2 || '');
    }
  }, [job]);

  // Fetch OCR container scan data with polling
  useEffect(() => {
    const containerNo = job?.container_number;
    const orderCode = job?.order_code;
    
    if (!containerNo && !orderCode) return;

    const fetchOcrScans = async () => {
      try {
        console.log('Fetching OCR scans for container:', containerNo, 'order:', orderCode);
        const { data, error } = await getOcrContainerScans(containerNo || undefined, 10, orderCode || undefined);
        
        if (error) {
          console.error('OCR scans fetch error:', error);
          return;
        }

        const scans = (data as any)?.data || [];
        if (scans.length > 0) {
          const latestScan = scans[0];
          setContainer1Number(latestScan.container_no || containerNo || '');
          setContainer1Seal(latestScan.seal_no || job?.seal_number || '');
          setIsOcrVerified(true);
          console.log('OCR data loaded:', { container: latestScan.container_no, seal: latestScan.seal_no });
        }
      } catch (err) {
        console.error('Error fetching OCR scans:', err);
      }
    };

    fetchOcrScans(); // Initial fetch

    if (!isOcrVerified) {
      const interval = setInterval(fetchOcrScans, 10000);
      return () => clearInterval(interval);
    }
  }, [job?.container_number, job?.seal_number, job?.order_code, isOcrVerified]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    
    try {
      // Use different API based on driver type - call external API directly
      let result: any;
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        const [inProgressRes, inTransitRes, deliveredRes, completedRes] = await Promise.all([
          getDriverAssignedJobs(user.id, driverType, 50, 'in_progress'),
          getDriverAssignedJobs(user.id, driverType, 50, 'in_transit'),
          getDriverAssignedJobs(user.id, driverType, 50, 'delivered'),
          getDriverAssignedJobs(user.id, driverType, 50, 'completed'),
        ]);
        const combinedData = [
          ...((inProgressRes.data as any)?.data || []),
          ...((inTransitRes.data as any)?.data || []),
          ...((deliveredRes.data as any)?.data || []),
          ...((completedRes.data as any)?.data || []),
        ];
        result = { success: true, data: combinedData };
      } else {
        const { data, error } = await getFreelanceAcceptedJobs(user.id);
        if (error) throw new Error(error);
        result = data;
      }

      console.log('Container check-in API result:', result);
      
      if (result?.success && result?.data) {
        // Find the specific job by order_number OR id (jobId could be either)
        const foundJob = result.data.find((j: any) => 
          j.order_number === jobId || 
          j.id === jobId || 
          String(j.id) === jobId
        );
        
        // Debug: inspect all coordinate and checkpoint fields from API
        console.log('[ContainerCheckInPage] Raw coordinate fields:', {
          container_checkpoint: foundJob.container_checkpoint,
          container_checkpoint_latitude: foundJob.container_checkpoint_latitude,
          container_checkpoint_longitude: foundJob.container_checkpoint_longitude,
          empty_pickup_address: foundJob.empty_pickup_address,
          empty_pickup_depot: foundJob.empty_pickup_depot,
          empty_pickup_latitude: foundJob.empty_pickup_latitude,
          empty_pickup_longitude: foundJob.empty_pickup_longitude,
          depot_latitude: foundJob.depot_latitude,
          depot_longitude: foundJob.depot_longitude,
          allCoordKeys: Object.keys(foundJob).filter((k: string) => 
            k.includes('lat') || k.includes('lng') || k.includes('lon') || k.includes('checkpoint') || k.includes('depot') || k.includes('empty_pickup')
          )
        });
        console.log('[ContainerCheckInPage] Looking for jobId:', jobId);
        console.log('[ContainerCheckInPage] Available jobs:', result.data.map((j: any) => ({ id: j.id, order_number: j.order_number })));
        console.log('[ContainerCheckInPage] Found job:', foundJob);
        
        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            transport_type: foundJob.transport_mode || null,
            job_type: foundJob.job_type || foundJob.transport_category || null,
            employer_name: foundJob.factory_name || foundJob.sender_name || null,
            container_checkpoint: foundJob.container_checkpoint || foundJob.empty_pickup_depot || null,
            container_checkpoint_code: foundJob.container_checkpoint_code || null,
            container_checkpoint_latitude: foundJob.container_checkpoint_latitude || foundJob.empty_pickup_latitude || null,
            container_checkpoint_longitude: foundJob.container_checkpoint_longitude || foundJob.empty_pickup_longitude || null,
            container_checkpoint_time: foundJob.container_checkpoint_time || foundJob.eta_date || foundJob.eta_time || foundJob.vessel_eta || foundJob.vessel_arrival_date || null,
            empty_container_date: foundJob.first_pickup_date || foundJob.empty_container_date || foundJob.empty_pickup_date || foundJob.sender_pickup_date || null,
            container_number: foundJob.container_number || null,
            seal_number: foundJob.seal_number || null,
            container_number_2: foundJob.container_number_2 || null,
            seal_number_2: foundJob.seal_number_2 || null,
            origin_location: foundJob.sender_address || `${foundJob.sender_district || ''}, ${foundJob.sender_province || ''}`.replace(/^, |, $/g, '') || null,
            origin_company_name: foundJob.factory_name || foundJob.sender_name || null,
            equipment_list: foundJob.vehicle_type || foundJob.equipment_list || null,
            container_return_location: foundJob.container_return_location || null,
            container_return_address: foundJob.container_return_address || null,
            container_return_latitude: foundJob.container_return_latitude || null,
            container_return_longitude: foundJob.container_return_longitude || null,
            container_return_phone: foundJob.container_return_phone || null,
            container_details: (() => {
              let raw = foundJob.container_details;
              if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = []; } }
              return Array.isArray(raw)
                ? raw
                    .filter((item: any) => item?.containerNo || item?.container_no || item?.sealNo || item?.seal_no)
                    .map((item: any) => ({ containerNo: item.containerNo || item.container_no || '', sealNo: item.sealNo || item.seal_no || '' }))
                : [];
            })(),
            bl_no: foundJob.bl_no || foundJob.bl_number || foundJob.bill_of_lading || null,
          };
          setJob(mappedJob);
          
          // Check if already checked in for empty_container
          await checkExistingCheckin(foundJob.id, foundJob.order_number);
        } else {
          console.error('[ContainerCheckInPage] Job not found for jobId:', jobId);
          throw new Error('Job not found');
        }
      } else {
        throw new Error('No data returned');
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('container.error'),
        description: t('container.loadError'),
        variant: 'destructive'
      });
      const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${jobId}` : `/job/${jobId}`;
      navigate(backRoute);
    } finally {
      setLoading(false);
    }
  };

  // Check if driver already checked in for empty_container
  const checkExistingCheckin = async (transportOrderId: string, orderNumber: string) => {
    try {
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      const { data: checkinResult, error: checkinError } = await getDriverCheckins(
        user!.id,
        driverType,
        orderNumber
      );

      if (checkinError) {
        console.error('[ContainerCheckInPage] getDriverCheckins error:', checkinError);
        return;
      }

      console.log('[ContainerCheckInPage] Check-in status result:', checkinResult);

      const allCheckinsRaw = (checkinResult as any)?.data || checkinResult || [];
      const allCheckins = Array.isArray(allCheckinsRaw) ? allCheckinsRaw : [];
      
      // Filter checkins for this specific order & current driver
      const checkins = Array.isArray(allCheckins)
        ? allCheckins.filter((c: any) => {
            const matchesUser = isInternalDriver
              ? c.internal_driver_id === user!.id
              : isExternalDriver
                ? c.external_driver_id === user!.id
                : c.freelance_driver_id === user!.id;

            const matchesOrder =
              c.transport_order_id === transportOrderId ||
              c.order_number === orderNumber ||
              c.transport_orders?.order_number === orderNumber;

            return matchesUser && matchesOrder;
          })
        : [];

      // Check based on flow type
      if (isContainerReturn) {
        // For container return flow, check for existing container_return checkin
        const hasContainerReturnCheckin = checkins.some((c: any) => 
          c.checkin_type === 'container_return'
        );
        console.log('[ContainerCheckInPage] Has container_return checkin:', hasContainerReturnCheckin);
        
        if (hasContainerReturnCheckin) {
          setAlreadyCheckedIn(true);
          toast({
            title: t('containerCheckin.alreadyCheckedIn'),
            description: t('containerCheckin.alreadyCheckedInDesc'),
          });
          // For container return, go back to job detail (no SOP needed, document attachment is on job detail)
          setTimeout(() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${orderNumber}` : `/job/${orderNumber}`;
            navigate(backRoute);
          }, 1500);
        }
      } else {
        // For empty container pickup flow, check for existing container_pickup checkin
        const hasContainerPickupCheckin = checkins.some((c: any) => 
          c.checkin_type === 'container_pickup' || c.checkin_type === 'empty_container' || c.checkin_type === 'container'
        );
        console.log('[ContainerCheckInPage] Has container_pickup checkin:', hasContainerPickupCheckin);
        
        if (hasContainerPickupCheckin) {
          setAlreadyCheckedIn(true);
          toast({
            title: t('containerCheckin.alreadyCheckedIn'),
            description: t('containerCheckin.alreadyCheckedInDesc'),
          });
          setTimeout(() => {
            navigate(`/job/${orderNumber}/container-sop`, { state: { jobData: job, checkinType: isInbound ? 'loaded_container' : 'empty_container', isBidJob: (location.state as any)?.isBidJob } });
          }, 1500);
        }
      }
    } catch (error) {
      console.error('[ContainerCheckInPage] Error checking existing checkin:', error);
    }
  };
  
  const handleCheckIn = async () => {
    if (!user || !jobId || !job || isCheckingIn) return;
    
    setIsCheckingIn(true);
    
    try {
      // Get current location
      let latitude = job.container_checkpoint_latitude || 0;
      let longitude = job.container_checkpoint_longitude || 0;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.log('Could not get current location, using job location');
        }
      }

      // Determine driver type
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // Call check-in API directly (no proxy)
      const { data: checkinResult, error: checkinError } = await driverCheckin({
        order_number: job.order_code,
        checkin_type: isContainerReturn ? 'container_return' : 'container_pickup',
        driver_id: user.id,
        driver_type: driverType,
        latitude: latitude,
        longitude: longitude,
        notes: isContainerReturn ? t('containerCheckin.returnArrivalNote') || 'ถึงจุดคืนตู้แล้ว' : t('containerCheckin.arrivalNote'),
        container_number: container1Number,
        seal_number: container1Seal,
        container_number_2: container2Number,
        seal_number_2: container2Seal
      });

      if (checkinError) {
        console.error('Check-in error:', checkinError);
        throw new Error('Check-in failed');
      }

      // Send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: isContainerReturn ? 'container_return_checked_in' : 'empty_container_checked_in',
        sequenceNumber: isContainerReturn ? 99 : 0,
        containerNumber: container1Number,
        sealNumber: container1Seal,
        containerNumber2: container2Number,
        sealNumber2: container2Seal
      });

      toast({
        title: t('container.checkInSuccess'),
        description: t('container.checkInSuccessMessage')
      });
      setShowConfirmDialog(false);
      const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
      navigate(backRoute);
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('container.error'),
        description: t('container.checkInError'),
        variant: 'destructive'
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-center relative">
          <button onClick={() => {
            const backRoute = (location.state as any)?.isBidJob ? `/bid-job/${job.order_code}` : `/job/${job.order_code}`;
            navigate(backRoute);
          }} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-semibold">
              {isContainerReturn ? (t('containerCheckin.returnTitle') || 'เช็คอินจุดคืนตู้') : job.bl_no ? (t('jobDetail.loadedContainerPickup') || 'จุดรับตู้หนัก') : t('containerCheckin.title')}
            </h1>
            <p className="text-xs opacity-80">
              {isContainerReturn 
                ? (job.container_return_location || '-') 
                : (job.container_checkpoint || job.origin_location || '-')}
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Action Buttons */}
        <JobActionButtons jobId={job.id} orderNumber={job.order_code} />

        {/* Main Card */}
        <Card className="overflow-hidden border-0 shadow-md rounded-2xl">
          {/* Card Header */}
          <div className="bg-[#E8F4F8] px-4 py-3">
            <p className="text-sm font-medium text-[#225795]">
              {isContainerReturn ? (t('jobDetail.containerReturn') || 'จุดคืนตู้') : t('jobDetail.emptyContainerPickup')}
            </p>
            <p className="text-base font-semibold text-[#225795]">
              {isContainerReturn 
                ? (job.container_return_location || '-') 
                : (job.container_checkpoint || job.origin_location || '-')}
            </p>
          </div>

          {/* Map Section */}
          <div className="relative overflow-hidden">
            {(() => {
              const lat = isContainerReturn ? job.container_return_latitude : job.container_checkpoint_latitude;
              const lng = isContainerReturn ? job.container_return_longitude : job.container_checkpoint_longitude;
              const label = isContainerReturn ? (job.container_return_location || '') : (job.container_checkpoint || '');
              
              return lat && lng ? (
                <div className="h-40">
                  <GoogleMap 
                    latitude={lat}
                    longitude={lng}
                    markerLabel={label || t('containerCheckin.title')}
                    showRoute={false}
                  />
                </div>
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">{t('jobDetail.noLocation')}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Info Section */}
          {isContainerReturn ? (
            /* Container Return Info */
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">สถานที่คืนตู้</p>
                <p className="text-sm font-semibold text-[#225795]">
                  {job.container_return_location || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ที่อยู่</p>
                <p className="text-sm font-semibold text-[#225795]">
                  {job.container_return_address || '-'}
                </p>
              </div>
              {job.container_return_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${job.container_return_phone}`} className="text-sm font-semibold text-[#225795] underline">
                    {job.container_return_phone}
                  </a>
                </div>
              )}
            </div>
          ) : (
            /* Empty Container Pickup Info */
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">CY / จุดรับตู้เปล่า</p>
                <p className="text-sm font-semibold text-[#225795]">
                  {job.container_checkpoint_code || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">วันเริ่มรับตู้เปล่า (FIRST DATE PICK UP CTNR)</p>
                <p className="text-sm font-semibold text-[#225795]">
                  {job.empty_container_date ? formatDate(job.empty_container_date, language) : '-'}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Container Selector from BL API */}
        {isInbound && job.container_details.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">เลือกตู้-ซีลจาก BL</Label>
            <Select
              value={selectedContainerIndex}
              onValueChange={(val) => {
                setSelectedContainerIndex(val);
                if (val === 'manual') {
                  setContainer1Number('');
                  setContainer1Seal('');
                } else {
                  const idx = parseInt(val, 10);
                  const detail = job.container_details[idx];
                  if (detail) {
                    setContainer1Number(detail.containerNo || '');
                    setContainer1Seal(detail.sealNo || '');
                  }
                }
              }}
            >
              <SelectTrigger className="h-11 bg-white">
                <SelectValue placeholder="เลือกตู้-ซีล..." />
              </SelectTrigger>
              <SelectContent>
                {job.container_details.map((detail, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {detail.containerNo || '-'} / {detail.sealNo || '-'}
                  </SelectItem>
                ))}
                <SelectItem value="manual">กรอกเอง...</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Container 1 - Hide for BL jobs (they use dropdown above) */}
        {!job.bl_no && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="bg-[#225795] text-white rounded-md px-2 py-0.5 text-xs font-bold">
              {t('container.pair')} 1
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('ocr.containerNumber')}</p>
              <p className="text-sm font-bold text-[#225795]">{container1Number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('ocr.sealNumber')}</p>
              <p className="text-sm font-bold text-[#225795]">{container1Seal || '-'}</p>
            </div>
          </div>
        </div>
        )}

        {/* Container 2 - Only show if data exists and not BL job */}
        {!job.bl_no && (job.container_number_2 || job.seal_number_2) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-[#225795] text-white rounded-md px-2 py-0.5 text-xs font-bold">
                {t('container.pair')} 2
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('ocr.containerNumber')}</p>
                <p className="text-sm font-bold text-[#225795]">{job.container_number_2 || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t('ocr.sealNumber')}</p>
                <p className="text-sm font-bold text-[#225795]">{job.seal_number_2 || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Route Button */}
        <Button 
          variant="outline" 
          className="w-full h-11 text-sm border-[#225795] text-[#225795] rounded-full" 
          onClick={() => {
            const lat = isContainerReturn ? job.container_return_latitude : job.container_checkpoint_latitude;
            const lng = isContainerReturn ? job.container_return_longitude : job.container_checkpoint_longitude;
            const label = isContainerReturn ? job.container_return_location : job.container_checkpoint;
            
            if (lat && lng) {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
              window.open(url, '_blank');
            } else if (label) {
              const query = encodeURIComponent(label);
              window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
            } else {
              toast({
                title: t('container.error'),
                description: t('containerCheckin.noLocationFound'),
                variant: 'destructive'
              });
            }
          }}
        >
          <img src={routeIcon} alt="Route" className="w-4 h-4 mr-2" />
          เส้นทาง
        </Button>

      </div>

      {/* Fixed Bottom Check-in Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t safe-area-bottom">
        <Button 
          className="w-full h-12 text-base bg-[#00B8D4] hover:bg-[#00A0BC] rounded-full" 
          onClick={() => setShowConfirmDialog(true)}
          disabled={isCheckingIn}
        >
          {isCheckingIn ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5 mr-2" />
          )}
          เช็คอิน
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">
              ยืนยันการเช็คอิน
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              คุณต้องการเช็คอินที่<br />
              {isContainerReturn 
                ? <>จุดคืนตู้ {job.container_return_location || '-'}</>
                : <>จุดรับตู้เปล่า {job.container_checkpoint || '-'}</>
              }<br />
              ใช่หรือไม่?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)} 
              className="flex-1 h-11"
              disabled={isCheckingIn}
            >
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCheckIn} 
              className="flex-1 h-11 bg-teal-600 hover:bg-teal-700"
              disabled={isCheckingIn}
            >
              {isCheckingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'ยืนยัน'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Problem Drawer */}
      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={job.id} />
    </div>
  );
}
