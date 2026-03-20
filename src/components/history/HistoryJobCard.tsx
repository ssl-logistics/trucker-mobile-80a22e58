import { Clock, MapPin, CircleDot } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
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
  sender_address?: string;
  sender_province?: string;
  sender_district?: string;
  destination_address?: string;
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
  // International job identifiers
  booking_no?: string;
  bl_no?: string;
  transport_category?: string;
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
  const { canViewPrice } = useUserRole();

  const isDomestic = !job.booking_no && !job.bl_no && (!job.transport_category || job.transport_category === 'domestic');
  // Multiple locations: has destinations array with items (same logic as JobCard)
  const isMultipleLocations = Array.isArray(job.destinations) && job.destinations.length > 0;
  // Single trip: no destinations array OR has destination fields directly
  const isSingleTrip = !isMultipleLocations;

  // Format origin location - prioritize district, province format
  const getOriginLocation = () => {
    if (Array.isArray(job.origins) && job.origins.length > 0) {
      const origin = job.origins[0];
      // Prefer district, province format
      if (origin.district || origin.province) {
        return [origin.district, origin.province].filter(Boolean).join(', ');
      }
      return origin.address || origin.location || '-';
    }
    // Fallback to job-level fields
    if (job.sender_district || job.sender_province) {
      return [job.sender_district, job.sender_province].filter(Boolean).join(', ');
    }
    // Fallback to sender_address for international jobs
    if (job.sender_address) return job.sender_address;
    return '-';
  };

  // Format destination location(s) - prioritize district, province format
  const getDestinationLocations = () => {
    if (Array.isArray(job.destinations) && job.destinations.length > 0) {
      return job.destinations.map(dest => ({
        location: (dest.district || dest.province) 
          ? [dest.district, dest.province].filter(Boolean).join(', ')
          : (dest.address || dest.location || '-')
      }));
    }
    // Fallback to job-level fields
    const location = (job.destination_district || job.destination_province)
      ? [job.destination_district, job.destination_province].filter(Boolean).join(', ')
      : (job.destination_address || '-');
    return [{ location }];
  };

  const destinations = getDestinationLocations();

  return (
    <Card 
      className="p-4 pt-8 space-y-3 bg-card relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" 
      onClick={onClick}
    >
      {/* Order Code Badge - Top Left */}
      <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-green-100 text-green-800 text-sm font-medium">
        {!isDomestic && (job.bl_no || job.booking_no)
          ? `${job.bl_no ? 'BL' : 'Booking'} ${job.bl_no || job.booking_no}`
          : `${t('job.order_code')} ${job.order_number}`
        }
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
          <Badge variant="secondary" className={`border-0 ${
            job.status === 'awaiting_response' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
            job.status === 'in_transit' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :
            job.status === 'in_progress' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
            job.status === 'assigned' ? 'bg-teal-100 text-teal-700 hover:bg-teal-200' :
            'bg-green-100 text-green-800 hover:bg-green-200'
          }`}>
            {job.status === 'awaiting_response' ? t('jobStatus.awaitingResponse') :
             job.status === 'in_transit' ? t('jobStatus.inTransit') :
             job.status === 'in_progress' ? t('jobStatus.inProgress') :
             job.status === 'assigned' ? t('jobStatus.assigned') :
             job.status === 'completed' ? t('jobStatus.completed') : t('jobStatus.delivered')}
          </Badge>
        </div>

        {/* Transport Type Badge */}
         <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-medium ${
           isDomestic
             ? 'bg-blue-100 text-blue-700'
             : 'bg-orange-100 text-orange-700'
         }`}>
          {isDomestic 
            ? `${t('jobType.domestic')}${isSingleTrip ? ` (${t('job.one_way')})` : ` (${t('job.multiple_destinations')})`}`
            : `${translateJobType('ระหว่างประเทศ', language)} ${job.bl_no ? '(BL)' : job.booking_no ? '(Booking)' : ''}`
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
          {canViewPrice && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200">
              <img src={coinsIcon} alt="coins" className="w-5 h-5" />
              <span className="text-xl font-bold text-teal-600">฿ {(job.transport_price || 0).toLocaleString()}</span>
            </div>
          )}
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
