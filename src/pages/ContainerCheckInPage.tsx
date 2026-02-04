import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Phone, Loader2 } from 'lucide-react';
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendJobStatus } from '@/lib/jobStatusService';
import GoogleMap from '@/components/GoogleMap';
import { formatDate } from '@/lib/dateUtils';
import JobActionButtons from '@/components/job/JobActionButtons';

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
}

export default function ContainerCheckInPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isInternalDriver, isExternalDriver } = useUserRole();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  
  // Editable container fields for inbound
  const [container1Number, setContainer1Number] = useState('');
  const [container1Seal, setContainer1Seal] = useState('');
  const [container2Number, setContainer2Number] = useState('');
  const [container2Seal, setContainer2Seal] = useState('');
  
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

  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    
    try {
      let apiUrl: string;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Use different API based on driver type
      if (isInternalDriver || isExternalDriver) {
        const driverType = isInternalDriver ? 'internal' : 'external';
        apiUrl = `${supabaseUrl}/functions/v1/get-driver-assigned-jobs?driver_id=${user.id}&driver_type=${driverType}&limit=50`;
      } else {
        apiUrl = `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      console.log('Container check-in API result:', result);
      
      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: any) => j.order_number === jobId);
        
        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            transport_type: foundJob.transport_mode || null,
            job_type: foundJob.job_type || foundJob.transport_category || null,
            employer_name: foundJob.factory_name || foundJob.sender_name || null,
            container_checkpoint: foundJob.container_checkpoint || null,
            container_checkpoint_code: foundJob.container_checkpoint_code || null,
            container_checkpoint_latitude: foundJob.container_checkpoint_latitude || null,
            container_checkpoint_longitude: foundJob.container_checkpoint_longitude || null,
            container_checkpoint_time: foundJob.container_checkpoint_time || foundJob.eta_date || null,
            empty_container_date: foundJob.empty_container_date || null,
            container_number: foundJob.container_number || null,
            seal_number: foundJob.seal_number || null,
            container_number_2: foundJob.container_number_2 || null,
            seal_number_2: foundJob.seal_number_2 || null,
            origin_location: foundJob.sender_address || `${foundJob.sender_district || ''}, ${foundJob.sender_province || ''}`.replace(/^, |, $/g, '') || null,
            origin_company_name: foundJob.factory_name || foundJob.sender_name || null,
            equipment_list: foundJob.vehicle_type || foundJob.equipment_list || null,
          };
          setJob(mappedJob);
        } else {
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
      navigate(`/job/${jobId}`);
    } finally {
      setLoading(false);
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

      // Call check-in API via proxy with new checkin_type 'empty_container'
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-checkin-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            order_number: job.order_code,
            checkin_type: 'empty_container', // New status for empty container pickup
            driver_id: user.id,
            driver_type: driverType,
            driver_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '',
            driver_phone: user.phone_number || user.phone || '',
            driver_avatar: user.avatar_url || user.profile_photo_url || '',
            latitude: latitude,
            longitude: longitude,
            notes: 'ถึงจุดรับตู้เปล่าแล้ว',
            container_number: container1Number,
            seal_number: container1Seal,
            container_number_2: container2Number,
            seal_number_2: container2Seal
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Check-in error:', errorText);
        throw new Error('Check-in failed');
      }

      // Send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: 'empty_container_checked_in',
        sequenceNumber: 0, // Empty container checkpoint is before pickup
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
      navigate(`/job/${job.order_code}`);
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-center relative">
          <button onClick={() => navigate(`/job/${job.order_code}`)} className="absolute left-0 p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-center">จุดรับตู้เปล่า</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={job.id} orderNumber={job.order_code} />

        {/* Location Info Card */}
        <Card className="p-4 border-2 rounded-2xl border-teal-500 bg-[#F6FFFE]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#225795]">จุดรับตู้เปล่า</h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-orange-500 bg-[#FFF7E6]">
                รอเช็คอิน
              </span>
            </div>
            
            <div className="text-sm font-medium text-[#225795]">
              {job.container_checkpoint || job.origin_location || '-'}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="text-[#454545] min-w-[130px]">วัน/เวลาเรือถึง</span>
                <span className="text-[#454545]">: {job.container_checkpoint_time ? formatDate(job.container_checkpoint_time, language) : '-'}</span>
              </div>
              <div className="flex">
                <span className="text-[#454545] min-w-[130px]">วันเริ่มเข้ารับตู้เปล่า</span>
                <span className="text-[#454545]">: {job.empty_container_date ? formatDate(job.empty_container_date, language) : '-'}</span>
              </div>
              <div className="flex">
                <span className="text-[#454545] min-w-[130px]">ผู้รับสินค้า</span>
                <span className="text-[#454545]">: {job.origin_company_name || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-[#454545] min-w-[130px]">จำนวนและชนิดตู้</span>
                <span className="text-[#454545]">: {job.equipment_list || '-'}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Interactive Map */}
        {job.container_checkpoint_latitude && job.container_checkpoint_longitude ? (
          <GoogleMap 
            latitude={job.container_checkpoint_latitude}
            longitude={job.container_checkpoint_longitude}
            markerLabel={job.container_checkpoint || 'จุดรับตู้เปล่า'}
            showRoute={true}
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('container.map')}</p>
            </div>
          </div>
        )}

        {/* Container 1 */}
        <Card className="p-4 bg-teal-50 border-2 border-teal-200 rounded-2xl">
          <div className="flex items-start gap-2 mb-3">
            <div className="bg-teal-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <h3 className="font-semibold text-base text-teal-700">ตู้คอนเทนเนอร์ 1</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-teal-700 mb-1">เลขตู้คอนเทนเนอร์</p>
              {isInbound ? (
                <Input 
                  value={container1Number} 
                  onChange={(e) => setContainer1Number(e.target.value)}
                  placeholder="กรอกเลขตู้คอนเทนเนอร์"
                  className="h-10"
                />
              ) : (
                <p className="font-bold">{job.container_number || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-teal-700 mb-1">เลขซีล</p>
              {isInbound ? (
                <Input 
                  value={container1Seal} 
                  onChange={(e) => setContainer1Seal(e.target.value)}
                  placeholder="กรอกเลขซีล"
                  className="h-10"
                />
              ) : (
                <p className="font-bold">{job.seal_number || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Container 2 */}
        <Card className="p-4 bg-teal-50 border-2 border-teal-200 rounded-2xl">
          <div className="flex items-start gap-2 mb-3">
            <div className="bg-teal-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <h3 className="font-semibold text-base text-teal-700">ตู้คอนเทนเนอร์ 2</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-teal-700 mb-1">เลขตู้คอนเทนเนอร์</p>
              {isInbound ? (
                <Input 
                  value={container2Number} 
                  onChange={(e) => setContainer2Number(e.target.value)}
                  placeholder="กรอกเลขตู้คอนเทนเนอร์"
                  className="h-10"
                />
              ) : (
                <p className="font-bold">{job.container_number_2 || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-teal-700 mb-1">เลขซีล</p>
              {isInbound ? (
                <Input 
                  value={container2Seal} 
                  onChange={(e) => setContainer2Seal(e.target.value)}
                  placeholder="กรอกเลขซีล"
                  className="h-10"
                />
              ) : (
                <p className="font-bold">{job.seal_number_2 || '-'}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Route Button */}
        <Button 
          variant="outline" 
          className="w-full h-12 text-base border-[#153860]" 
          onClick={() => {
            if (job.container_checkpoint_latitude && job.container_checkpoint_longitude) {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${job.container_checkpoint_latitude},${job.container_checkpoint_longitude}`;
              window.open(url, '_blank');
            } else if (job.container_checkpoint) {
              const query = encodeURIComponent(job.container_checkpoint);
              window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
            } else {
              toast({
                title: t('container.error'),
                description: 'ไม่พบข้อมูลสถานที่',
                variant: 'destructive'
              });
            }
          }}
        >
          <img src={routeIcon} alt="Route" className="w-5 h-5 mr-2" />
          {t('container.route')}
        </Button>
      </div>

      {/* Fixed Bottom Check-in Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700" 
          onClick={() => setShowConfirmDialog(true)}
          disabled={isCheckingIn}
        >
          {isCheckingIn ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5 mr-2" />
          )}
          เช็คอินจุดรับตู้เปล่า
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
              จุดรับตู้เปล่า {job.container_checkpoint || '-'}<br />
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
