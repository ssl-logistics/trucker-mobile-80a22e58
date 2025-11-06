import { Clock, MapPin, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface Job {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  destination_location: string;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  isAccepted?: boolean;
}

interface JobCardProps {
  job: Job;
  onAccept: (job: Job) => void;
}

export const JobCard = ({ job, onAccept }: JobCardProps) => {
  const { t, language } = useLanguage();
  
  const formatDate = (date: string) => {
    const d = new Date(date);
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });
  };

  // Determine if domestic or international based on transport_type
  const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');

  return (
    <Card className="p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="inline-block px-3 py-1 rounded bg-green-50 text-green-700 text-xs font-medium">
          {t('job.order_code')} {job.order_code}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(job.start_date)} | {job.start_time.substring(0, 5)}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">{t('job.employer')} : </span>
          <span className="font-medium">{job.employer_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isDomestic && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              {t('job.domestic')}
            </Badge>
          )}
          {isInternational && (
            <>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                {t('job.international')}
              </Badge>
              {isInbound && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                  {t('job.inbound')}
                </Badge>
              )}
              {isOutbound && (
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                  {t('job.outbound')}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {job.transport_type}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">{t('job.origin')}</div>
                <div className="font-medium">{job.origin_location}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <div className="text-muted-foreground">{t('job.destination')}</div>
                <div className="font-medium">{job.destination_location}</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50">
            <span className="text-lg font-bold text-teal-700">฿ {job.price.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
          <div>
            <span className="text-muted-foreground">{t('job.equipment')} : </span>
            <span>{job.equipment_list || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('job.safety')} : </span>
            <span>{job.safety_equipment || '-'}</span>
          </div>
        </div>
      </div>

      <Button 
        onClick={() => onAccept(job)} 
        className="w-full h-11 text-base font-medium"
        disabled={job.isAccepted}
      >
        {job.isAccepted ? t('job.accepted') : t('job.accept')}
      </Button>
    </Card>
  );
};
