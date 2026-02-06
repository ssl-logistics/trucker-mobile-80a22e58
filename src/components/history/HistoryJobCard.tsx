import { Clock, MapPin, CircleDot } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/dateUtils';
import { translateJobType } from '@/utils/apiDataTranslations';
import coinsIcon from '@/assets/coins-icon-2.png';

interface HistoryJob {
  id: string;
  order_number: string;
  ticket_number?: string;
  sender_name: string;
  sender_pickup_date: string;
  sender_pickup_time?: string;
  sender_province?: string;
  sender_district?: string;
  destination_province?: string;
  destination_district?: string;
  transport_price?: number;
  vehicle_type?: string;
  status?: string;
  product_name?: string;
  product_weight?: number;
  product_unit?: string;
  product_quantity?: string | number;
  job_type?: string;
  isBidJob?: boolean;
  // Support for multiple origins/destinations
  origins?: Array<{ sequence: number; location?: string; address?: string; province?: string; district?: string }>;
  destinations?: Array<{ sequence: number; location?: string; address?: string; province?: string; district?: string }>;
}

interface HistoryJobCardProps {
  job: HistoryJob;
  onClick: () => void;
  getTranslatedVehicleType: (vehicleType: string, t: (key: string) => string) => string;
}

export function HistoryJobCard({ job, onClick, getTranslatedVehicleType }: HistoryJobCardProps) {
  const { t, language } = useLanguage();

  const isDomestic = job.job_type === 'domestic' || !job.job_type;
  const isMultipleLocations = Array.isArray(job.destinations) && job.destinations.length > 1;
  const isSingleTrip = !isMultipleLocations;

  // Format origin location
  const getOriginLocation = () => {
    if (Array.isArray(job.origins) && job.origins.length > 0) {
      return job.origins[0].address || job.origins[0].location || `${job.origins[0].province || ''}, ${job.origins[0].district || ''}`;
    }
    return `${job.sender_province || ''}, ${job.sender_district || ''}`;
  };

  // Format destination location(s)
  const getDestinationLocations = () => {
    if (Array.isArray(job.destinations) && job.destinations.length > 0) {
      return job.destinations.map(dest => ({
        location: dest.address || dest.location || `${dest.province || ''}, ${dest.district || ''}`
      }));
    }
    return [{ location: `${job.destination_province || ''}, ${job.destination_district || ''}` }];
  };

  const destinations = getDestinationLocations();

  return (
    <Card 
      className="p-4 pt-8 space-y-3 bg-card relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
      onClick={onClick}
    >
      {/* Order Code Badge - Top Left */}
      <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-green-100 text-green-800 text-sm font-medium">
        {t('job.order_code')} {job.order_number}
      </div>

      {/* Date & Time - Top Right */}
      <div className="absolute top-0 right-0 px-3 py-1 flex items-center gap-1.5 text-sm text-foreground/70">
        <Clock className="w-4 h-4" />
        {formatDate(job.sender_pickup_date, language)} {job.sender_pickup_time ? `| ${job.sender_pickup_time.substring(0, 5)}` : ''}
      </div>

      <div className="space-y-2">
        {/* Employer */}
        <div className="text-base">
          <span className="text-foreground/70">{t('job.employer')} : </span>
          <span className="font-medium text-foreground">{job.sender_name}</span>
        </div>

        {/* Job Type Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {job.vehicle_type && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">
              {getTranslatedVehicleType(job.vehicle_type, t)}
            </Badge>
          )}
          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 border-0">
            {job.status === 'completed' ? t('jobStatus.completed') : t('jobStatus.delivered')}
          </Badge>
        </div>

        {/* Transport Type Badge */}
        <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-medium ${
          isDomestic
            ? 'bg-blue-100 text-blue-800'
            : 'bg-orange-100 text-orange-800'
        }`}>
          {isDomestic 
            ? `${t('jobType.domestic')}${isSingleTrip ? ` (${t('job.one_way')})` : ` (${t('job.multiple_destinations')})`}`
            : translateJobType(job.job_type || '', language)
          }
        </span>

        {/* Routes & Price */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Origin */}
            <div className="flex items-start gap-2">
              <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-foreground/70">{t('job.origin')}</div>
                <div className="font-medium text-foreground">{getOriginLocation()}</div>
              </div>
            </div>
            
            {/* Destinations */}
            {destinations.map((dest, idx) => (
              <div key={`dest-${idx}`} className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="text-foreground/70">
                    {t('job.destination')} {destinations.length > 1 ? `#${idx + 1}` : ''}
                  </div>
                  <div className="font-medium text-foreground">{dest.location}</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Price */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200">
            <img src={coinsIcon} alt="coins" className="w-5 h-5" />
            <span className="text-xl font-bold text-teal-600">฿ {(job.transport_price || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Goods Info */}
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 text-sm space-y-1">
          <div>
            <span className="text-sky-700">{t('job.goods')} : </span>
            <span className="text-foreground">{job.product_name || '-'}</span>
          </div>
          <div>
            <span className="text-sky-700">{t('job.weight')} : </span>
            <span className="text-foreground">{job.product_weight ? `${job.product_weight.toLocaleString()} ${job.product_unit || 'kg'}` : '-'}</span>
          </div>
          <div>
            <span className="text-sky-700">{t('job.quantity')} : </span>
            <span className="text-foreground">{job.product_quantity || '-'}</span>
          </div>
        </div>

        {/* Completed Status */}
        <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-100 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs font-medium text-green-700">{t('jobHistory.statusCompleted')}</span>
        </div>
      </div>
    </Card>
  );
}
