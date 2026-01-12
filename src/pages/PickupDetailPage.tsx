import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import Map from '@/components/Map';
import { sendJobStatus } from '@/lib/jobStatusService';
import { formatDate } from '@/lib/dateUtils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import routeIcon from '@/assets/route-icon-2.png';
import checkInIcon from '@/assets/check-in-icon.png';
interface JobDetail {
  id: string;
  order_code: string;
  order_number?: string;
  employer_name: string;
  origin_location: string;
  start_date: string;
  start_time: string;
  origin_latitude?: number;
  origin_longitude?: number;
  origin_contact_person?: string | null;
  origin_contact_role?: string | null;
  origin_goods_type?: string | null;
  origin_goods_quantity?: string | null;
  origin_remarks?: string | null;
  origin_address?: string | null;
  origin_company_name?: string | null;
  driver_name?: string;
  driver_phone?: string;
}
export default function PickupDetailPage() {
  const navigate = useNavigate();
  const {
    jobId
  } = useParams();
  const {
    user
  } = useAuth();
  const {
    t,
    language
  } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);
  const loadJobDetail = async () => {
    if (!user || !jobId) return;
    setLoading(true);
    
    try {
      // Fetch from external API using order_code
      const response = await fetch(
        `https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/get-freelance-accepted-jobs?freelance_driver_id=${user.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Find the specific job by order_number
        const foundJob = result.data.find((j: any) => j.order_number === jobId);
        
        if (foundJob) {
          // Map API response to JobDetail interface
          const mappedJob: JobDetail = {
            id: foundJob.id,
            order_code: foundJob.order_number,
            employer_name: foundJob.sender_name,
            origin_location: `${foundJob.sender_district}, ${foundJob.sender_province}`,
            start_date: foundJob.sender_pickup_date,
            start_time: foundJob.sender_pickup_time,
            origin_latitude: foundJob.sender_latitude,
            origin_longitude: foundJob.sender_longitude,
            origin_contact_person: foundJob.sender_contact_name,
            origin_contact_role: foundJob.sender_contact_phone,
            origin_goods_type: foundJob.product_name,
            origin_goods_quantity: foundJob.product_quantity ? String(foundJob.product_quantity) : null,
            origin_remarks: foundJob.remarks,
            origin_address: foundJob.sender_address,
            origin_company_name: foundJob.sender_name,
          };
          setJob(mappedJob);
        } else {
          throw new Error('Job not found');
        }
      }
    } catch (error) {
      console.error('Error loading job detail:', error);
      toast({
        title: t('pickup.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } finally {
      setLoading(false);
    }
  };
  const handleCheckIn = async () => {
    if (!job || !user) return;
    
    try {
      // Get current location
      let latitude = job.origin_latitude || 0;
      let longitude = job.origin_longitude || 0;
      
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

      // Call external check-in API
      const response = await fetch(
        'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1/driver-checkin',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live'
          },
          body: JSON.stringify({
            order_number: job.order_number || job.order_code,
            checkin_type: 'pickup',
            freelance_driver_id: user.id,
            driver_name: job.driver_name || user.full_name || user.username || '',
            driver_phone: job.driver_phone || user.phone_number || '',
            latitude: latitude,
            longitude: longitude,
            notes: 'ถึงจุดรับแล้ว'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      // Also send job status update
      await sendJobStatus({
        jobId: job.id,
        orderCode: job.order_code,
        userId: user.id,
        status: 'pickup_checked_in',
        sequenceNumber: 2
      });
      
      toast({
        title: t('pickup.checkInSuccess'),
        description: t('pickup.checkInSuccessMessage')
      });
      setShowConfirmDialog(false);
      navigate(`/job/${job.order_code}/sop`);
    } catch (error) {
      console.error('Check-in error:', error);
      toast({
        title: t('pickup.error'),
        description: 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive'
      });
    }
  };
  const openGoogleMaps = () => {
    if (!job?.origin_latitude || !job?.origin_longitude) {
      toast({
        title: t('pickup.error'),
        description: t('pickup.noCoordinates'),
        variant: 'destructive'
      });
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${job.origin_latitude},${job.origin_longitude}`;
    window.open(url, '_blank');
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  if (!job) return null;
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${job.order_code}`)} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('pickup.title')} {job.origin_company_name || ''}</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} />

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.contactName')}</div>
          <div className="text-base">
            {job.origin_contact_person || '-'}
            {job.origin_contact_role && ` (${job.origin_contact_role})`}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.routeNumber')}</div>
          <div className="text-base">{job.origin_location}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.address')}</div>
          <div className="text-base">{job.origin_address || job.origin_location || '-'}</div>
        </div>

        {job.origin_latitude && job.origin_longitude ? <Map latitude={job.origin_latitude} longitude={job.origin_longitude} markerLabel={job.origin_location} showRoute={true} /> : <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('pickup.map')}</p>
            </div>
          </div>}

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.productType')}</div>
          <div className="text-base">
            {job.origin_goods_type ? `${job.origin_goods_type}${job.origin_goods_quantity ? ` (${job.origin_goods_quantity})` : ''}` : '-'}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.pickupTime')}</div>
          <div className="text-base">{formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</div>
        </div>

        <div className="border-b border-gray-200 pb-4">
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.note')}</div>
          <div className="text-base">{job.origin_remarks || '-'}</div>
        </div>

        <div className="space-y-3 pt-4">
          <Button variant="outline" className="w-full h-12 text-base border-[#153860]">
            <Phone className="w-5 h-5 mr-2" />
            {t('pickup.call')}
          </Button>
          <Button variant="outline" onClick={openGoogleMaps} className="w-full h-12 text-base border-[#153860]">
            <img src={routeIcon} alt="Route" className="w-5 h-5 mr-2" />
            {t('pickup.route')}
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700" onClick={() => setShowConfirmDialog(true)}>
          <MapPin className="w-5 h-5 mr-2" />
          {t('pickup.checkIn')}
        </Button>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <img src={checkInIcon} alt="Check in" className="w-16 h-16" />
            <DialogTitle className="text-xl text-center">
              {t('pickup.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('pickup.confirmMessage').replace('{location}', job.origin_company_name || job.origin_location || '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 h-11">
              {t('pickup.cancel')}
            </Button>
            <Button onClick={handleCheckIn} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
              {t('pickup.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}