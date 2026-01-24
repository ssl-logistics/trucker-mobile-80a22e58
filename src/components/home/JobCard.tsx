import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, CircleDot, Banknote, Truck, Calendar, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import coinsIcon from '@/assets/coins-icon-2.png';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/dateUtils';
import { 
  translateGoodsType, 
  translateVehicleType, 
  translateTransportType,
  translateEquipmentList,
  translateUnit 
} from '@/utils/apiDataTranslations';

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
  pickup_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  goods_type: string | null;
  goods_quantity: string | null;
  goods_weight?: number | null;
  goods_unit?: string | null;
  isAccepted?: boolean;
}

interface JobCardProps {
  job: Job;
  onAccept: (job: Job) => void;
  autoOpenDetail?: boolean;
  onDetailClosed?: () => void;
  showCancelButton?: boolean;
  onCancel?: (job: Job) => void;
  isFactoryJob?: boolean;
}

export const JobCard = ({ job, onAccept, autoOpenDetail = false, onDetailClosed, showCancelButton = false, onCancel, isFactoryJob = false }: JobCardProps) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Helper function to get translated job type
  const getJobTypeLabel = (jobType: string): string => {
    const translationKey = `jobType.${jobType}`;
    const translated = t(translationKey);
    // If translation not found (returns key), show original value
    return translated === translationKey ? jobType : translated;
  };

  // Auto open modal when autoOpenDetail is true
  useEffect(() => {
    if (autoOpenDetail) {
      setDetailModalOpen(true);
    }
  }, [autoOpenDetail]);

  const handleModalClose = (open: boolean) => {
    setDetailModalOpen(open);
    if (!open && onDetailClosed) {
      onDetailClosed();
    }
  };

  // Determine if domestic or international based on transport_type
  const isDomestic = job.transport_type?.includes('เที่ยวเดียว') || job.transport_type?.includes('หลายที่');
  const isSingleTrip = job.transport_type?.includes('เที่ยวเดียว');
  const isMultipleLocations = job.transport_type?.includes('หลายที่');
  const isInternational = job.transport_type?.includes('ขาเข้า') || job.transport_type?.includes('ขาออก');
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');

  const handleViewDetail = () => {
    setDetailModalOpen(true);
  };

  const handleGoToJobPage = () => {
    setDetailModalOpen(false);
    navigate(`/job/${job.order_code}`);
  };

  return (
    <Card className="p-4 pt-8 space-y-3 bg-card relative overflow-hidden">
      <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-green-50 text-green-700 text-sm font-medium">
        {t('job.order_code')} {job.order_code}
      </div>
      <div className="absolute top-0 right-0 px-3 py-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        {formatDate(job.start_date, language)} {job.pickup_time ? `| ${job.pickup_time.substring(0, 5)}` : ''}
      </div>

      <div className="space-y-2">
        <div className="text-base">
          <span className="text-muted-foreground">{isFactoryJob ? t('job.factory') : t('job.employer')} : </span>
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
          {translateTransportType(job.transport_type_label || job.transport_type, language)}
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

        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">{t('job.goods')} : </span>
            <span>{translateGoodsType(job.goods_type, language)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('job.weight')} : </span>
            <span>{job.goods_weight ? `${job.goods_weight.toLocaleString()} ${translateUnit(job.goods_unit, language)}` : '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('job.quantity')} : </span>
            <span>{job.goods_quantity || '-'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline"
          size="sm"
          onClick={handleViewDetail} 
          className="h-9 text-sm font-medium"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          {t('job.viewDetails')}
        </Button>
        {showCancelButton ? (
          <>
            <Button 
              onClick={() => onAccept(job)} 
              className="flex-1 h-11 text-base font-medium"
              disabled={job.isAccepted}
            >
              {job.isAccepted ? t('job.accepted') : t('job.accept')}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => onCancel?.(job)} 
              className="flex-1 h-11 text-base font-medium"
            >
              {t('job.cancel')}
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => onAccept(job)} 
            className="flex-1 h-11 text-base font-medium"
            disabled={job.isAccepted}
          >
            {job.isAccepted ? t('job.accepted') : t('job.accept')}
          </Button>
        )}
      </div>

      {/* Job Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {t('job.jobDetails')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Order Code */}
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t('job.orderCode')}</p>
              <p className="font-bold text-primary text-lg">{job.order_code}</p>
            </div>

            {/* Route */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.origin')}</p>
                  <p className="font-medium">{job.origin_location}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.destination')}</p>
                  <p className="font-medium">{job.destination_location}</p>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Banknote className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('job.price')}</p>
                <p className="font-bold text-lg text-primary">฿{job.price.toLocaleString()}</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.date')}</p>
                  <p className="font-medium text-sm">
                    {job.start_date ? formatDate(job.start_date, language) : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.time')}</p>
                  <p className="font-medium text-sm">
                    {job.pickup_time ? job.pickup_time.substring(0, 5) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Job Type - Domestic/International */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('job.jobType')}</p>
                <p className="font-medium">{job.job_type ? getJobTypeLabel(job.job_type) : '-'}</p>
              </div>
            </div>

            {/* Transport Type - Single/Multiple trips */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('job.transportMode')}</p>
                <p className="font-medium">{translateTransportType(job.transport_type_label || job.transport_type, language)}</p>
              </div>
            </div>

            {/* Required Truck Type */}
            {job.equipment_list && (
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                <Truck className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.requiredTruckType')}</p>
                  <p className="font-medium">{translateEquipmentList(job.equipment_list, language)}</p>
                </div>
              </div>
            )}

            {/* Goods Info */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">{t('job.product')} : </span>
                <span>{translateGoodsType(job.goods_type, language)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('job.weight')} : </span>
                <span>{job.goods_weight ? `${job.goods_weight.toLocaleString()} ${translateUnit(job.goods_unit, language)}` : '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('job.quantity')} : </span>
                <span>{job.goods_quantity || '-'}</span>
              </div>
            </div>

            {/* Employer */}
            <div className="text-center text-sm text-muted-foreground">
              {t('job.employerLabel')}: <span className="font-medium text-foreground">{job.employer_name}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)} className="w-full">
              {t('job.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
