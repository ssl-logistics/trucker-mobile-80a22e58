import { Clock, MapPin, CircleDot } from 'lucide-react';
import coinsIcon from '@/assets/coins-icon-2.png';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/dateUtils';

interface Job {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  transport_type_label?: string;
  origin_location: string;
  destination_location: string;
  destination_company_name: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  isAccepted?: boolean;
}

interface JobCardProps {
  job: Job;
  onAccept: (job: Job) => void;
}

export const JobCard = ({ job, onAccept }: JobCardProps) => {
  const { t, language } = useLanguage();

  // Determine if domestic or international based on transport_type
  const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
  const isSingleTrip = job.transport_type?.includes('เที่ยวเดียว');
  const isMultipleLocations = job.transport_type?.includes('หลายที่');
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');

  return (
    <Card className="p-4 pt-8 space-y-3 bg-card relative overflow-hidden">
      <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-green-50 text-green-700 text-sm font-medium">
        {t('job.order_code')} {job.order_code}
      </div>
      <div className="absolute top-0 right-0 px-3 py-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        {formatDate(job.start_date, language)} | {job.start_time.substring(0, 5)}
      </div>

      <div className="space-y-2">
        <div className="text-base">
          <span className="text-muted-foreground">{t('job.employer')} : </span>
          <span className="font-medium">{job.employer_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isDomestic && (
            <>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                {t('job.domestic')}
              </Badge>
              {isSingleTrip && (
                <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-100">
                  {t('job.single_trip')}
                </Badge>
              )}
              {isMultipleLocations && (
                <Badge variant="secondary" className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100">
                  {t('job.multiple_locations')}
                </Badge>
              )}
            </>
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
        <div className="text-base text-muted-foreground">
          {job.transport_type_label || job.transport_type}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-muted-foreground">{t('job.origin')}</div>
                <div className="font-medium">{job.origin_location}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-muted-foreground">{t('job.destination')}</div>
                <div className="font-medium">{job.destination_location}</div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50">
            <img src={coinsIcon} alt="coins" className="w-5 h-5" />
            <span className="text-xl font-bold text-teal-700">฿ {job.price.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
          <div>
            <span className="text-muted-foreground">{t('job.goods_type')} : </span>
            <span>{job.goods_type || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('job.goods_quantity')} : </span>
            <span>{job.goods_quantity || '-'}</span>
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
