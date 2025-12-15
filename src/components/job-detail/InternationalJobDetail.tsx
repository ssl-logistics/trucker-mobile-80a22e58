import { useState, useRef, useEffect } from 'react';
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
interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  origin_address: string | null;
  origin_company_name: string | null;
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_bill_of_lading: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  destination_contact_person: string | null;
  destination_bill_of_lading: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_remarks: string | null;
  destination_date: string | null;
  destination_time: string | null;
  price: number;
  start_date: string;
  start_time: string;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  container_number: string | null;
  seal_number: string | null;
  container_number_2: string | null;
  seal_number_2: string | null;
  empty_container_date: string | null;
}
interface JobApplication {
  checked_in_at: string | null;
  sop_completed_at: string | null;
  job_started_at: string | null;
  delivery_checked_in_at: string | null;
  delivery_sop_completed_at: string | null;
  container_checked_in_at: string | null;
  container_sop_completed_at: string | null;
  status: string;
}
interface InternationalJobDetailProps {
  job: JobDetail;
  jobApplication: JobApplication | null;
  userId: string;
  onUpdate: () => void;
}
export default function InternationalJobDetail({
  job,
  jobApplication,
  userId,
  onUpdate
}: InternationalJobDetailProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const [cardHeights, setCardHeights] = useState({
    card1: 0,
    card2: 0,
    card3: 0
  });
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');
  useEffect(() => {
    // Calculate card heights for step positioning
    if (card1Ref.current && card2Ref.current && card3Ref.current) {
      setCardHeights({
        card1: card1Ref.current.offsetHeight,
        card2: card2Ref.current.offsetHeight,
        card3: card3Ref.current.offsetHeight
      });
    }
  }, [jobApplication]);
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
        description: t('jobDetail.startJobDesc')
      });
      onUpdate();
    }
  };
  const containerData = {
    checkpoint: job.container_checkpoint || '-',
    checkpointCode: job.container_checkpoint_code || '-',
    emptyDate: job.empty_container_date,
    containerNumber: job.container_number || '-',
    sealNumber: job.seal_number || '-'
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
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-white text-xs bg-blue-600">
                {t('jobDetail.international')}
              </Badge>
              {isInbound && <Badge variant="secondary" className="bg-blue-500/80 text-white hover:bg-blue-600/80 text-xs">
                  {t('jobDetail.inbound')}
                </Badge>}
              {isOutbound && <Badge variant="secondary" className="bg-orange-500/80 text-white hover:bg-orange-600/80 text-xs">
                  {t('jobDetail.outbound')}
                </Badge>}
            </div>
          </div>
          <div className="w-6" />
        </div>
      </header>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-[#E8F5F4] border-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 text-[#0A8778]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-[#0A8778]">฿ {job.price.toLocaleString()}</div>
          </Card>
          <Card className="p-4 bg-[#E8E8E8] border-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 text-gray-600">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
            </div>
            <div className="text-base text-gray-700">{t('jobDetail.pickupDeliveryPoints')} : <span className="font-semibold">4</span></div>
          </Card>
        </div>

        {/* Report Problem Button */}
        <Button 
          variant="outline" 
          className="w-full h-12 border-2 border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => setIsReportDrawerOpen(true)}
        >
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M0 3.5C0 1.568 1.568 0 3.5 0H28.5C30.432 0 32 1.568 32 3.5V22.5C32 23.4283 31.6313 24.3185 30.9749 24.9749C30.3185 25.6313 29.4283 26 28.5 26H16.12L10.974 31.146C10.5661 31.5524 10.047 31.8289 9.48224 31.9407C8.91743 32.0525 8.33217 31.9946 7.80023 31.7743C7.26828 31.5539 6.81346 31.1811 6.49309 30.7027C6.17272 30.2243 6.00115 29.6618 6 29.086V26H3.5C2.57174 26 1.6815 25.6313 1.02513 24.9749C0.368749 24.3185 0 23.4283 0 22.5L0 3.5ZM3.5 3C3.36739 3 3.24021 3.05268 3.14645 3.14645C3.05268 3.24021 3 3.36739 3 3.5V22.5C3 22.776 3.224 23 3.5 23H7.5C7.89782 23 8.27936 23.158 8.56066 23.4393C8.84196 23.7206 9 24.1022 9 24.5V28.88L14.44 23.44C14.721 23.1586 15.1023 23.0004 15.5 23H28.5C28.6326 23 28.7598 22.9473 28.8536 22.8536C28.9473 22.7598 29 22.6326 29 22.5V3.5C29 3.36739 28.9473 3.24021 28.8536 3.14645C28.7598 3.05268 28.6326 3 28.5 3H3.5ZM17.5 7.5V12.5C17.5 12.8978 17.342 13.2794 17.0607 13.5607C16.7794 13.842 16.3978 14 16 14C15.6022 14 15.2206 13.842 14.9393 13.5607C14.658 13.2794 14.5 12.8978 14.5 12.5V7.5C14.5 7.10218 14.658 6.72064 14.9393 6.43934C15.2206 6.15804 15.6022 6 16 6C16.3978 6 16.7794 6.15804 17.0607 6.43934C17.342 6.72064 17.5 7.10218 17.5 7.5ZM18 18C18 18.5304 17.7893 19.0391 17.4142 19.4142C17.0391 19.7893 16.5304 20 16 20C15.4696 20 14.9609 19.7893 14.5858 19.4142C14.2107 19.0391 14 18.5304 14 18C14 17.4696 14.2107 16.9609 14.5858 16.5858C14.9609 16.2107 15.4696 16 16 16C16.5304 16 17.0391 16.2107 17.4142 16.5858C17.7893 16.9609 18 17.4696 18 18Z" fill="#0A8778"/>
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
            <p className="text-base font-medium text-foreground">
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
              <div className="absolute left-1/2 -translate-x-1/2 w-0.5" style={{
              top: '8px',
              height: `calc(100% - 16px)`,
              background: jobApplication?.delivery_sop_completed_at ? '#ef4444' : jobApplication?.sop_completed_at ? `linear-gradient(to bottom, #ef4444 0%, #ef4444 ${cardHeights.card1 + cardHeights.card2 > 0 ? (cardHeights.card1 + 12 + cardHeights.card2 / 2) / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 66}%, #d1d5db ${cardHeights.card1 + cardHeights.card2 > 0 ? (cardHeights.card1 + 12 + cardHeights.card2 / 2) / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 66}%, #d1d5db 100%)` : jobApplication?.container_sop_completed_at ? `linear-gradient(to bottom, #ef4444 0%, #ef4444 ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 33}%, #d1d5db ${cardHeights.card1 > 0 ? cardHeights.card1 / 2 / (cardHeights.card1 + 12 + cardHeights.card2 + 12 + cardHeights.card3) * 100 : 33}%, #d1d5db 100%)` : '#d1d5db'
            }} />
              
              {/* Step 1 Circle - Container Checkpoint */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card1 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.container_sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.job_started_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>

              {/* Step 2 Circle - Pickup/Loading Point */}
              <div className="relative flex justify-center mb-3" style={{
              height: `${cardHeights.card2 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.container_sop_completed_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>

              {/* Step 3 Circle - Delivery/Return Point */}
              <div className="relative flex justify-center" style={{
              height: `${cardHeights.card3 || 200}px`
            }}>
                <div className="absolute top-0">
                  {jobApplication?.delivery_sop_completed_at ? <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div> : jobApplication?.sop_completed_at ? <div className="w-7 h-7 rounded-full border-[3px] border-teal-500 bg-white shadow-sm" /> : <div className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white" />}
                </div>
              </div>
            </div>

            {/* Right Content Column */}
            <div className="flex-1 space-y-3">
              {/* Container Checkpoint Card */}
              <Card ref={card1Ref} className={`p-4 border-2 ${jobApplication?.container_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.job_started_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.job_started_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">{t('jobDetail.containerCheckpoint')}</h3>
                    {jobApplication?.job_started_at && <span className={`text-xs font-medium ${jobApplication?.container_sop_completed_at ? 'text-green-600' : jobApplication?.container_checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.container_sop_completed_at ? t('jobDetail.containerSuccess') : jobApplication?.container_checked_in_at ? t('jobDetail.waitingContainer') : t('jobDetail.waitingCheckIn')}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base text-[#0369a1] mb-2">
                    {job.origin_location || '-'}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    {isInbound ? (
                      <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[160px]">{t('jobDetail.shipArrivalDateTime')}</span>
                          <span>: {formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[160px]">{t('jobDetail.emptyContainerPickupDate')}</span>
                          <span>: {containerData.emptyDate ? formatDate(containerData.emptyDate, language) : '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[160px]">{t('jobDetail.receiver')}</span>
                          <span>: {job.destination_company_name || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[160px]">{t('jobDetail.containerTypeQty')}</span>
                          <span>: {job.origin_goods_quantity || '-'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.emptyContainerPickup')}</span>
                          <span>: {job.origin_location || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.emptyContainerDate')}</span>
                          <span>: {formatDate(job.start_date, language)}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.containerNumber')}</span>
                          <span>: {containerData.containerNumber}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.sealNumber')}</span>
                          <span>: {containerData.sealNumber}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Container boxes for inbound - show 2 containers */}
                  {isInbound && (
                    <div className="space-y-2 mb-3">
                      <div className="bg-[#E8F5F4] rounded-lg p-3 border border-[#0A8778]/20">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 rounded-full bg-[#0A8778] text-white text-xs flex items-center justify-center font-semibold">1</span>
                          <span className="text-sm font-medium">{t('jobDetail.containerNumber')}: <span className="font-semibold">{containerData.containerNumber}</span></span>
                        </div>
                        <div className="text-sm pl-7">
                          <span className="text-muted-foreground">{t('jobDetail.sealNumber')}</span>: <span className="font-medium">{containerData.sealNumber}</span>
                        </div>
                      </div>
                      {job.container_number_2 && (
                        <div className="bg-[#E8F5F4] rounded-lg p-3 border border-[#0A8778]/20">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-full bg-[#0A8778] text-white text-xs flex items-center justify-center font-semibold">2</span>
                            <span className="text-sm font-medium">{t('jobDetail.containerNumber')}: <span className="font-semibold">{job.container_number_2}</span></span>
                          </div>
                          <div className="text-sm pl-7">
                            <span className="text-muted-foreground">{t('jobDetail.sealNumber')}</span>: <span className="font-medium">{job.seal_number_2 || '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.job_started_at || jobApplication?.container_sop_completed_at !== null}>
                      <Navigation className="w-4 h-4 mr-1" />
                      {t('jobDetail.route')}
                    </Button>
                    <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" disabled={!jobApplication?.job_started_at} onClick={() => {
                    if (jobApplication?.container_sop_completed_at) {
                      navigate(`/job/${job.id}/container-summary`);
                    } else if (jobApplication?.container_checked_in_at) {
                      navigate(`/job/${job.id}/container-sop`);
                    } else {
                      navigate(`/job/${job.id}/container-checkin`);
                    }
                  }}>
                      {jobApplication?.container_sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Pickup/Loading Point Card */}
              <Card ref={card2Ref} className={`p-4 border-2 ${jobApplication?.sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.container_sop_completed_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.container_sop_completed_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      {isInbound ? t('jobDetail.unloadingPoint') : t('jobDetail.loadingPoint')}
                    </h3>
                    {jobApplication?.container_sop_completed_at && <span className={`text-xs font-medium ${jobApplication?.sop_completed_at ? 'text-green-600' : jobApplication?.checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.sop_completed_at ? t('jobDetail.sopSuccess') : jobApplication?.checked_in_at ? t('jobDetail.waitingSop') : t('jobDetail.waitingCheckIn')}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {isInbound ? (job.destination_location || '-') : job.destination_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? t('jobDetail.billOfLading') : t('jobDetail.contactPerson')}</span>
                      <span>: {isInbound ? (job.destination_bill_of_lading || '-') : (job.destination_contact_person || '-')}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? t('jobDetail.contactPoint') : t('jobDetail.deliveryRoute')}</span>
                      <span>: {isInbound ? (job.destination_contact_person || '-') : (job.destination_location || '-')}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? t('jobDetail.deliveryRoute') : t('jobDetail.goodsType')}</span>
                      <span>: {isInbound ? (job.destination_location || '-') : `${job.destination_goods_type || '-'} ${job.destination_goods_quantity ? `(${job.destination_goods_quantity})` : ''}`}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{isInbound ? t('jobDetail.deliveryTime') : t('jobDetail.pickupTime')}</span>
                      <span>: {formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}</span>
                    </div>
                    <div className="flex">
                      <span className="text-muted-foreground min-w-[100px]">{t('jobDetail.remarks')}</span>
                      <span>: {isInbound ? (job.destination_remarks || '-') : (job.destination_remarks || '-')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.container_sop_completed_at}>
                      <Phone className="w-4 h-4" />
                      {t('jobDetail.call')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.container_sop_completed_at}>
                      <Navigation className="w-4 h-4" />
                      {t('jobDetail.route')}
                    </Button>
                    <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => {
                    if (jobApplication?.sop_completed_at) {
                      navigate(`/job/${job.id}/pickup-summary`);
                    } else if (jobApplication?.checked_in_at) {
                      navigate(`/job/${job.id}/sop`);
                    } else {
                      navigate(`/job/${job.id}/pickup`);
                    }
                  }} disabled={!jobApplication?.container_sop_completed_at}>
                      {jobApplication?.sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Delivery/Return Point Card */}
              <Card ref={card3Ref} className={`p-4 border-2 ${jobApplication?.delivery_sop_completed_at ? 'border-green-500 bg-green-50' : jobApplication?.delivery_checked_in_at ? 'border-blue-500 bg-blue-50' : jobApplication?.sop_completed_at ? 'border-teal-500 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                <div className={`${!jobApplication?.sop_completed_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm">
                      {isInbound ? t('jobDetail.emptyReturn') : t('jobDetail.fullReturn')}
                    </h3>
                    {jobApplication?.sop_completed_at && <span className={`text-xs font-medium ${jobApplication?.delivery_sop_completed_at ? 'text-green-600' : jobApplication?.delivery_checked_in_at ? 'text-blue-600' : 'text-orange-500'}`}>
                        • {jobApplication?.delivery_sop_completed_at ? t('jobDetail.podSuccess') : jobApplication?.delivery_checked_in_at ? t('jobDetail.waitingPod') : t('jobDetail.waitingCheckIn')}
                      </span>}
                  </div>

                  <h4 className="font-semibold text-base mb-2">
                    {isInbound ? (job.origin_location || '-') : job.origin_location}
                  </h4>

                  <div className="space-y-1 text-sm mb-3">
                    {isInbound ? <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.returnDeadline')}</span>
                          <span>: {job.destination_date ? formatDate(job.destination_date, language) : '-'} | {job.destination_time || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.containerPacker')}</span>
                          <span>: {job.origin_company_name || job.origin_contact_person || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.remarks')}</span>
                          <span>: {job.origin_remarks || '-'}</span>
                        </div>
                      </> : <>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.fullReturnDate')}</span>
                          <span>: {job.destination_date ? formatDate(job.destination_date, language) : formatDate(job.start_date, language)} | {job.destination_time || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.containerPacker')}</span>
                          <span>: {(job as any).shipper_load || job.origin_company_name || job.origin_contact_person || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="text-muted-foreground min-w-[140px]">{t('jobDetail.remarks')}</span>
                          <span>: {job.origin_remarks || '-'}</span>
                        </div>
                      </>}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {isInbound ? <>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Phone className="w-4 h-4" />
                          {t('jobDetail.call')}
                        </Button>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Navigation className="w-4 h-4" />
                          {t('jobDetail.route')}
                        </Button>
                        <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/job/${job.id}/delivery`)} disabled={!jobApplication?.sop_completed_at}>
                          {jobApplication?.delivery_sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}
                        </Button>
                      </> : <>
                        <Button variant="outline" size="sm" className="h-10" disabled={!jobApplication?.sop_completed_at}>
                          <Navigation className="w-4 h-4 mr-1" />
                          {t('jobDetail.route')}
                        </Button>
                        <Button size="sm" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/job/${job.id}/delivery`)} disabled={!jobApplication?.sop_completed_at}>
                          {jobApplication?.delivery_sop_completed_at ? t('jobDetail.viewInfo') : t('jobDetail.updateStatus')}
                        </Button>
                      </>}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      {!jobApplication?.job_started_at && <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button className="w-full h-12 text-base text-white" style={{
        background: 'linear-gradient(90deg, #245D9E 0%, #1A4271 100%)'
      }} onClick={handleStartJob}>
            {t('jobDetail.startJobNow')}
          </Button>
        </div>}

      <ReportProblemDrawer
        open={isReportDrawerOpen}
        onOpenChange={setIsReportDrawerOpen}
        jobId={job.id}
      />
    </div>;
}