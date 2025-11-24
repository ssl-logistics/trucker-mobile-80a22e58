import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Navigation, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import Map from '@/components/Map';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface JobDetail {
  id: string;
  order_code: string;
  employer_name: string;
  origin_location: string;
  destination_location: string;
  destination_latitude?: number;
  destination_longitude?: number;
  start_date: string;
  start_time: string;
  origin_latitude?: number;
  origin_longitude?: number;
  origin_contact_person?: string | null;
  origin_contact_role?: string | null;
  origin_goods_type?: string | null;
  origin_goods_quantity?: string | null;
  origin_remarks?: string | null;
}

export default function PickupDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadJobDetail();
  }, [jobId, user]);

  const loadJobDetail = async () => {
    if (!user || !jobId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('id, order_code, employer_name, origin_location, destination_location, destination_latitude, destination_longitude, start_date, start_time, origin_latitude, origin_longitude, origin_contact_person, origin_contact_role, origin_goods_type, origin_goods_quantity, origin_remarks')
      .eq('id', jobId)
      .single();

    if (error) {
      toast({
        title: t('pickup.error'),
        description: t('pickup.loadError'),
        variant: 'destructive'
      });
      navigate('/current-jobs');
    } else {
      setJob(data);
    }
    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!job || !user) return;

    const { error } = await supabase
      .from('job_applications')
      .update({ 
        checked_in_at: new Date().toISOString(),
        status: 'checked_in'
      })
      .eq('job_id', job.id)
      .eq('driver_id', user.id);

    if (error) {
      toast({
        title: t('pickup.error'),
        description: t('pickup.checkInError'),
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: t('pickup.checkInSuccess'),
      description: t('pickup.checkInSuccessMessage'),
    });
    setShowConfirmDialog(false);
    navigate(`/job/${job.id}`);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openGoogleMaps = () => {
    if (!job?.origin_latitude || !job?.origin_longitude) {
      toast({
        title: t('pickup.error'),
        description: 'ไม่พบข้อมูลพิกัดสถานที่',
        variant: 'destructive'
      });
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${job.origin_latitude},${job.origin_longitude}`;
    window.open(url, '_blank');
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
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(`/job/${job.id}`)} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{t('pickup.title')} Factory1</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        <JobActionButtons jobId={jobId} />

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.contactName')}</div>
          <div className="text-base">
            {job.origin_contact_person || '-'}
            {job.origin_contact_role && ` (${job.origin_contact_role})`}
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.routeNumber')}</div>
          <div className="text-base">BKK001 ลาดพร้าว/กรุงเทพมหานคร</div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.address')}</div>
          <div className="text-base">{job.destination_location || '-'}</div>
        </div>

        {job.origin_latitude && job.origin_longitude ? (
          <Map 
            latitude={job.origin_latitude} 
            longitude={job.origin_longitude}
            markerLabel={job.origin_location}
            showRoute={true}
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('pickup.map')}</p>
            </div>
          </div>
        )}

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.productType')}</div>
          <div className="text-base">
            {job.origin_goods_type ? `${job.origin_goods_type}${job.origin_goods_quantity ? ` (${job.origin_goods_quantity})` : ''}` : '-'}
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.pickupTime')}</div>
          <div className="text-base">{formatDate(job.start_date)} | {job.start_time.substring(0, 5)}</div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">{t('pickup.note')}</div>
          <div className="text-base">{job.origin_remarks || '-'}</div>
        </div>

        <div className="space-y-3 pt-4">
          <Button variant="outline" className="w-full h-12 text-base">
            <Phone className="w-5 h-5 mr-2" />
            {t('pickup.call')}
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-12 text-base"
            onClick={openGoogleMaps}
          >
            <Navigation className="w-5 h-5 mr-2" />
            {t('pickup.route')}
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <Button 
          className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
          onClick={() => setShowConfirmDialog(true)}
        >
          <MapPin className="w-5 h-5 mr-2" />
          {t('pickup.checkIn')}
        </Button>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-[340px] rounded-2xl">
          <DialogHeader className="items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl text-center">
              {t('pickup.confirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {t('pickup.confirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 h-11"
            >
              {t('pickup.cancel')}
            </Button>
            <Button
              onClick={handleCheckIn}
              className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
            >
              {t('pickup.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
