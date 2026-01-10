import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Phone, Navigation, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import JobActionButtons from '@/components/job/JobActionButtons';
import ReportProblemDrawer from '@/components/job/ReportProblemDrawer';
import { formatDate } from '@/lib/dateUtils';
import coinsIcon from '@/assets/coins-icon.png';
import routeIcon from '@/assets/route-icon.png';
import boxIcon from '@/assets/box-icon.png';
import statusIcon from '@/assets/status-icon.png';
interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  origin_address: string | null;
  origin_company_name: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  start_time: string;
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_contact_person: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_remarks: string | null;
  destination_time: string | null;
  destination_date: string | null;
}
interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  status: string;
}
interface JobDestination {
  id: string;
  sequence_number: number;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_date: string | null;
  delivery_time: string | null;
  notes: string | null;
  checked_in_at: string | null;
  sop_completed_at: string | null;
}
interface DomesticJobDetailProps {
  job: JobDetail;
  jobApplication: JobApplication | null;
  userId: string;
  onUpdate: () => void;
}
export default function DomesticJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate
}: DomesticJobDetailProps) {
  const navigate = useNavigate();
  const {
    t,
    language
  } = useLanguage();
  const card1Ref = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState({
    card1: 0,
    card2: 0
  });
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [destinations, setDestinations] = useState<JobDestination[]>([]);
  useEffect(() => {
    // Calculate card heights for step positioning
    if (card1Ref.current) {
      setCardHeights({
        card1: card1Ref.current.offsetHeight,
        card2: 200
      });
    }
  }, [jobApplication, destinations]);

  // Fetch destinations from job_destinations table
  useEffect(() => {
    const fetchDestinations = async () => {
      const {
        data,
        error
      } = await supabase.from('job_destinations').select('*').eq('job_id', job.id).order('sequence_number', {
        ascending: true
      });
      if (error) {
        console.error('Error fetching destinations:', error);
      } else if (data && data.length > 0) {
        setDestinations(data);
      }
    };
    fetchDestinations();

    // Set up real-time subscription for job_destinations
    const channel = supabase.channel(`job_destinations_${job.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'job_destinations',
      filter: `job_id=eq.${job.id}`
    }, payload => {
      console.log('Job destination updated:', payload);
      // Refetch destinations when any change occurs
      fetchDestinations();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [job.id]);
  const handleStartJob = async () => {
    const {
      error
    } = await supabase.from('job_applications').update({
      job_started_at: new Date().toISOString(),
      status: 'job_started'
    }).eq('job_id', job.id).eq('driver_id', userId);
    if (error) {
      toast({
        title: t('jobDetail.error'),
        description: t('jobDetail.errorStartJob'),
        variant: 'destructive'
      });
    } else {
      toast({
        title: t('jobDetail.startJobSuccess'),
        description: t('jobDetail.startJobSuccessDesc')
      });
      onUpdate();
    }
  };
  return <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/current-jobs')} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">{job.order_code}</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="secondary" className="text-white text-xs bg-blue-500">
                {t('jobDetail.domestic')}
              </Badge>
            </div>
          </div>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-2 bg-[#E8F5F4] border-0 flex flex-col items-center justify-center">
            <img src={coinsIcon} alt="price" className="w-6 h-6 mb-1" />
            <div className="text-base font-bold text-[#0A8778] whitespace-nowrap">฿ {job.price.toLocaleString()}</div>
          </Card>
          <Card className="p-2 bg-[#E8E8E8] border-0 flex flex-col items-center justify-center">
            <img src={routeIcon} alt="route" className="w-5 h-5 mb-1" />
            <div className="text-xs text-gray-700 text-center">{t('jobDetail.pickupDeliveryPoints')} : <span className="font-semibold">{destinations.length > 0 ? destinations.length + 1 : 2}</span></div>
          </Card>
          <Card className="p-2 bg-[#E8E8E8] border-0 flex flex-col items-center justify-center">
            <img src={boxIcon} alt="goods" className="w-5 h-5 mb-1" />
            <div className="text-xs text-gray-700 text-center">{t('jobDetail.totalGoods')} : <span className="font-semibold">{job.origin_goods_quantity || '-'}</span></div>
          </Card>
        </div>

        {/* Report Problem Button */}
        <Button variant="outline" className="w-full h-12 border-2 border-gray-300 bg-white hover:bg-gray-50" onClick={() => setIsReportDrawerOpen(true)}>
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M0 3.5C0 1.568 1.568 0 3.5 0H28.5C30.432 0 32 1.568 32 3.5V22.5C32 23.4283 31.6313 24.3185 30.9749 24.9749C30.3185 25.6313 29.4283 26 28.5 26H16.12L10.974 31.146C10.5661 31.5524 10.047 31.8289 9.48224 31.9407C8.91743 32.0525 8.33217 31.9946 7.80023 31.7743C7.26828 31.5539 6.81346 31.1811 6.49309 30.7027C6.17272 30.2243 6.00115 29.6618 6 29.086V26H3.5C2.57174 26 1.6815 25.6313 1.02513 24.9749C0.368749 24.3185 0 23.4283 0 22.5L0 3.5ZM3.5 3C3.36739 3 3.24021 3.05268 3.14645 3.14645C3.05268 3.24021 3 3.36739 3 3.5V22.5C3 22.776 3.224 23 3.5 23H7.5C7.89782 23 8.27936 23.158 8.56066 23.4393C8.84196 23.7206 9 24.1022 9 24.5V28.88L14.44 23.44C14.721 23.1586 15.1023 23.0004 15.5 23H28.5C28.6326 23 28.7598 22.9473 28.8536 22.8536C28.9473 22.7598 29 22.6326 29 22.5V3.5C29 3.36739 28.9473 3.24021 28.8536 3.14645C28.7598 3.05268 28.6326 3 28.5 3H3.5ZM17.5 7.5V12.5C17.5 12.8978 17.342 13.2794 17.0607 13.5607C16.7794 13.842 16.3978 14 16 14C15.6022 14 15.2206 13.842 14.9393 13.5607C14.658 13.2794 14.5 12.8978 14.5 12.5V7.5C14.5 7.10218 14.658 6.72064 14.9393 6.43934C15.2206 6.15804 15.6022 6 16 6C16.3978 6 16.7794 6.15804 17.0607 6.43934C17.342 6.72064 17.5 7.10218 17.5 7.5ZM18 18C18 18.5304 17.7893 19.0391 17.4142 19.4142C17.0391 19.7893 16.5304 20 16 20C15.4696 20 14.9609 19.7893 14.5858 19.4142C14.2107 19.0391 14 18.5304 14 18C14 17.4696 14.2107 16.9609 14.5858 16.5858C14.9609 16.2107 15.4696 16 16 16C16.5304 16 17.0391 16.2107 17.4142 16.5858C17.7893 16.9609 18 17.4696 18 18Z" fill="#0A8778" />
            </svg>
            <span className="font-medium">{t('jobDetail.reportProblem')}</span>
          </div>
        </Button>

        {/* Route Info */}
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold">
              {t('jobDetail.booking')} : {job.order_code}
            </h2>
            <p className="text-base font-medium text-[#005E53]">
              {t('jobDetail.employer')} : {job.employer_name}
            </p>
          </div>

          {/* Step Tracker + Content Wrapper */}
          <div className="relative flex gap-3">
            {/* Left Timeline Column with Continuous Line */}
            <div className="relative flex flex-col" style={{
            width: '28px',
            paddingTop: '8px'
          }}>
              {/* Continuous Vertical Line */}
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300" style={{
              top: '8px',
              height: `calc(100% - 16px)`
            }} />
              
              {/* Step 1 Circle - Pickup Point */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" />}
                </div>
              </div>

              {/* Delivery Point Circles */}
              {(destinations.length > 0 ? destinations : [{
              id: 'fallback',
              sequence_number: 1
            }]).map((dest, index) => {
              // For fallback, use jobApplication's delivery status
              const isSopCompleted = dest.id === 'fallback' 
                ? !!jobApplication?.delivery_sop_completed_at 
                : !!dest.sop_completed_at;
              const isCheckedIn = dest.id === 'fallback'
                ? !!jobApplication?.delivery_checked_in_at
                : !!dest.checked_in_at;
              
              return <div key={dest.id} className="relative flex justify-center" style={{
                height: '200px',
                marginBottom: index < (destinations.length > 0 ? destinations.length - 1 : 0) ? '12px' : '0'
              }}>
                  <div className="absolute top-0">
                    {isSopCompleted ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div> : isCheckedIn ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                  </div>
                </div>;
            })}
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Pickup Point Card */}
              <Card ref={card1Ref} className={`p-4 border-2 rounded-2xl ${jobApplication?.sop_completed_at ? 'border-green-500 bg-green-50' : 'border-teal-500 bg-[#F6FFFE]'}`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.pickupPoint')}</h3>
                      {job.origin_company_name && <span className="text-sm font-medium text-[#225795]">: {job.origin_company_name}</span>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${jobApplication?.sop_completed_at ? 'text-green-600 bg-green-50' : jobApplication?.checked_in_at ? 'text-orange-500 bg-[#FFF7E6]' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                      {jobApplication?.sop_completed_at ? t('jobDetail.sopSuccess') : jobApplication?.checked_in_at ? t('jobDetail.waitingSop') : t('jobDetail.waitingCheckIn')}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                      <span className="text-[#454545]">: {job.origin_contact_person || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                      <span className="text-[#454545]">: {job.origin_location || '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-[#454545] min-w-[100px]">{t('jobDetail.goodsType')}</span>
                      <span className="text-[#454545]">: {job.origin_goods_type ? `${job.origin_goods_type}${job.origin_goods_quantity ? ` (${job.origin_goods_quantity})` : ''}` : '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="text-[#454545] min-w-[100px]">{t('jobDetail.pickupTime')}</span>
                      <span className="text-[#454545]">: {formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                      <span className="text-[#454545]">: {job.origin_remarks || '-'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]">
                      <Phone className="w-4 h-4" />
                      <span className="text-xs">{t('jobDetail.call')}</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]">
                      <img src={routeIcon} alt="route" className="w-4 h-4" />
                      <span className="text-xs">{t('jobDetail.route')}</span>
                    </Button>
                    <Button size="sm" onClick={() => {
                    if (jobApplication?.sop_completed_at) {
                      navigate(`/job/${job.order_code}/pickup-summary`);
                    } else {
                      navigate(`/job/${job.order_code}/pickup`);
                    }
                  }} className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 bg-[#225896] border-transparent">
                      <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                      <span className="text-xs">{jobApplication?.sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Delivery Point Cards - Multiple destinations */}
              {destinations.length > 0 ? destinations.map((dest, index) => <Card key={dest.id} className={`p-4 border-2 rounded-2xl ${dest.sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.sop_completed_at ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                    <div className={`${!jobApplication?.sop_completed_at ? 'opacity-60' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')} {destinations.length > 1 ? `#${dest.sequence_number}` : ''}</h3>
                          {dest.company_name && <span className="text-sm font-medium text-[#225795]">: {dest.company_name}</span>}
                        </div>
                        {jobApplication?.sop_completed_at && <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${dest.sop_completed_at ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                            {dest.sop_completed_at ? t('jobDetail.podSuccess') : t('jobDetail.waitingCheckIn')}
                          </span>}
                      </div>

                      <div className="space-y-1 text-sm mb-3">
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                          <span className="text-[#454545]">: {dest.contact_name || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                          <span className="text-[#454545]">: {dest.district && dest.province ? `${dest.district}, ${dest.province}` : dest.province || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.deliveryTime')}</span>
                          <span className="text-[#454545]">: {dest.delivery_date ? formatDate(dest.delivery_date, language) : '-'} | {dest.delivery_time ? dest.delivery_time.substring(0, 5) : '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                          <span className="text-[#454545]">: {dest.notes || '-'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!jobApplication?.sop_completed_at}>
                          <Phone className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.call')}</span>
                        </Button>
                        <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!jobApplication?.sop_completed_at}>
                          <img src={routeIcon} alt="route" className="w-4 h-4" />
                          <span className="text-xs">{t('jobDetail.route')}</span>
                        </Button>
                        <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 bg-[#225896] border-transparent" onClick={() => navigate(`/job/${job.order_code}/delivery/${dest.id}`)} disabled={!jobApplication?.sop_completed_at}>
                          <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                          <span className="text-xs">{dest.sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                        </Button>
                      </div>
                    </div>
                  </Card>) :
            // Fallback to original single destination from jobs table
            <Card className={`p-4 border-2 rounded-2xl ${jobApplication?.delivery_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.sop_completed_at ? 'border-teal-500 bg-[#F6FFFE]' : 'border-gray-300 bg-gray-50'}`}>
                  <div className={`${!jobApplication?.sop_completed_at ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-[#225795]">{t('jobDetail.deliveryPoint')}</h3>
                        {job.destination_company_name && <span className="text-sm font-medium text-[#225795]">: {job.destination_company_name}</span>}
                      </div>
                      {jobApplication?.sop_completed_at && <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${jobApplication?.delivery_sop_completed_at ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-[#FFF7E6]'}`}>
                          {jobApplication?.delivery_sop_completed_at ? t('jobDetail.podSuccess') : t('jobDetail.waitingCheckIn')}
                        </span>}
                    </div>

                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.contactPerson')}</span>
                        <span className="text-[#454545]">: {job.destination_contact_person || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.position')}</span>
                        <span className="text-[#454545]">: {job.destination_location || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.goodsType')}</span>
                        <span className="text-[#454545]">: {job.destination_goods_type ? `${job.destination_goods_type}${job.destination_goods_quantity ? ` (${job.destination_goods_quantity})` : ''}` : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.deliveryTime')}</span>
                        <span className="text-[#454545]">: {job.destination_date ? formatDate(job.destination_date, language) : formatDate(job.start_date, language)} | {job.destination_time ? job.destination_time.substring(0, 5) : '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="text-[#454545] min-w-[100px]">{t('jobDetail.remarks')}</span>
                        <span className="text-[#454545]">: {job.destination_remarks || '-'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860] px-[4px] py-[4px]" disabled={!jobApplication?.sop_completed_at}>
                        <Phone className="w-4 h-4" />
                        <span className="text-xs">{t('jobDetail.call')}</span>
                      </Button>
                      <Button variant="outline" size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 border-[#153860]" disabled={!jobApplication?.sop_completed_at}>
                        <img src={routeIcon} alt="route" className="w-4 h-4" />
                        <span className="text-xs">{t('jobDetail.route')}</span>
                      </Button>
                      <Button size="sm" className="h-10 flex flex-col items-center justify-center gap-0.5 p-1 bg-[#225896] border-transparent" onClick={() => navigate(`/job/${job.order_code}/delivery`)} disabled={!jobApplication?.sop_completed_at}>
                        <img src={statusIcon} alt="status" className="w-4 h-4 brightness-0 invert" />
                        <span className="text-xs">{jobApplication?.delivery_sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}</span>
                      </Button>
                    </div>
                  </div>
                </Card>}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button className={`w-full h-12 text-base ${jobApplication?.sop_completed_at ? 'text-white' : 'text-gray-500 cursor-not-allowed'}`} style={jobApplication?.sop_completed_at ? {
        background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
      } : {
        background: '#E5E7EB'
      }} onClick={handleStartJob} disabled={!jobApplication?.sop_completed_at}>
            {t('jobDetail.startJob')}
          </Button>
        </div>}

      <ReportProblemDrawer open={isReportDrawerOpen} onOpenChange={setIsReportDrawerOpen} jobId={job.id} />
    </div>;
}