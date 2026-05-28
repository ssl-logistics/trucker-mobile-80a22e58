import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, CircleDot, Banknote, Truck, Calendar, Eye, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import coinsIcon from '@/assets/coins-icon-2.png';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserRole } from '@/hooks/useUserRole';
import { formatDate } from '@/lib/dateUtils';
import { 
  translateGoodsType, 
  translateVehicleType, 
  translateTransportType,
  translateJobType,
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
  goods_quantity_unit?: string | null;
  remarks?: string | null;
  invoice_number?: string | null;
  isAccepted?: boolean;
  status?: string;
  bl_no?: string | null;
  booking_no?: string | null;
  destinations?: Array<{ sequence: number; location?: string; address?: string; company_name?: string; province?: string; contact_name?: string; invoice_number?: string }>;
  origins?: Array<{ sequence: number; location?: string; address?: string; company_name?: string; province?: string }>;
}

interface JobCardProps {
  job: Job;
  onAccept: (job: Job) => void;
  autoOpenDetail?: boolean;
  onDetailClosed?: () => void;
  showCancelButton?: boolean;
  onCancel?: (job: Job) => void;
  isFactoryJob?: boolean;
  isProcessing?: boolean; // Loading state for accept/cancel actions
  useStartJobLabel?: boolean; // Use "Start Job" instead of "Accept Job" for Internal/External drivers
}

export const JobCard = ({ job, onAccept, autoOpenDetail = false, onDetailClosed, showCancelButton = false, onCancel, isFactoryJob = false, isProcessing = false, useStartJobLabel = false }: JobCardProps) => {
  const { t, language } = useLanguage();
  const { canViewPrice } = useUserRole();
  const navigate = useNavigate();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [goodsModalOpen, setGoodsModalOpen] = useState(false);

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

  // Hide bottom navigation when detail modal is open
  useEffect(() => {
    const bottomNav = document.getElementById('bottom-navigation');
    if (bottomNav) {
      bottomNav.style.display = detailModalOpen ? 'none' : '';
    }
    return () => {
      if (bottomNav) {
        bottomNav.style.display = '';
      }
    };
  }, [detailModalOpen]);

  const handleModalClose = (open: boolean) => {
    setDetailModalOpen(open);
    if (!open && onDetailClosed) {
      onDetailClosed();
    }
  };

  // Determine job type based on destinations array vs destination_location
  const isInternational = job.job_type === 'international';
  // Multiple locations: has destinations array with items
  const isMultipleLocations = Array.isArray(job.destinations) && job.destinations.length > 0;
  // Single trip: has destination_location string (no destinations array)
  const isSingleTrip = !isMultipleLocations && !!job.destination_location;
  const isDomestic = !isInternational;
  const isInbound = job.transport_type?.includes('ขาเข้า');
  const isOutbound = job.transport_type?.includes('ขาออก');

  const handleViewDetail = () => {
    setDetailModalOpen(true);
  };

  const handleGoToJobPage = () => {
    setDetailModalOpen(false);
    navigate(`/job/${encodeURIComponent(job.order_code)}`);
  };

  return (
    <Card className="p-4 pt-8 space-y-3 bg-card relative overflow-hidden sm:p-5 sm:pt-10 lg:p-6 lg:pt-12">
      <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-green-50 text-green-700 text-sm font-medium sm:text-base sm:px-4">
        {job.bl_no ? `BL ${job.bl_no}` : job.booking_no ? `Booking ${job.booking_no}` : `${t('job.order_code')} ${job.order_code}`}
      </div>
      <div className="absolute top-0 right-0 px-3 py-1 flex items-center gap-1.5 text-sm text-muted-foreground sm:text-base sm:px-4">
        <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
        {formatDate(job.start_date, language)} {job.pickup_time ? `| ${job.pickup_time.substring(0, 5)}` : ''}
      </div>

      <div className="space-y-2 sm:space-y-3">
        <div className="text-base sm:text-lg">
          <span className="text-muted-foreground">{isFactoryJob ? t('job.factory') : t('job.employer')} : </span>
          <span className="font-medium">{job.employer_name}</span>
        </div>
        <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-medium ${
          isDomestic
            ? 'bg-blue-100 text-blue-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {isDomestic 
            ? `${t('jobType.domestic')}${isSingleTrip ? ` (${t('job.one_way')})` : isMultipleLocations ? ` (${t('job.multiple_destinations')})` : ''}`
            : translateJobType(job.job_type, language)
          }
        </span>


        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div className="flex-1 space-y-2 sm:space-y-3">
            {/* Origins - show multiple if available */}
            {Array.isArray(job.origins) && job.origins.length > 0 ? (
              job.origins.map((origin, idx) => (
                <div key={`origin-${idx}`} className="flex items-start gap-2 sm:gap-3">
                  <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0 sm:w-5 sm:h-5" />
                  <div className="text-sm sm:text-base">
                    <div className="text-muted-foreground">{t('job.origin')} {job.origins.length > 1 ? `#${idx + 1}` : ''}</div>
                    <div className="font-medium">{(() => { const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver']; const name = origin.company_name && !generic.includes(origin.company_name.trim()) ? origin.company_name : null; return name || (job.employer_name && !generic.includes(job.employer_name.trim()) ? job.employer_name : null) || origin.province || origin.address || origin.location; })()}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 sm:gap-3">
                <CircleDot className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0 sm:w-5 sm:h-5" />
                <div className="text-sm sm:text-base">
                  <div className="text-muted-foreground">{t('job.origin')}</div>
                  {job.origin_location.includes('\n') ? (
                    <>
                      <div className="font-medium">{job.origin_location.split('\n')[0]}</div>
                      <div className="text-xs text-muted-foreground">{job.origin_location.split('\n')[1]}</div>
                    </>
                  ) : (
                    <div className="font-medium">{job.origin_location}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Destinations - show max 2, collapse rest */}
            {Array.isArray(job.destinations) && job.destinations.length > 0 ? (
              <>
                {job.destinations.slice(0, 2).map((dest, idx) => (
                  <div key={`dest-${idx}`} className="flex items-start gap-2 sm:gap-3">
                    <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0 sm:w-5 sm:h-5" />
                    <div className="text-sm sm:text-base">
                      <div className="text-muted-foreground">{t('job.destination')} #{idx + 1}</div>
                      <div className="font-medium">{(() => { const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver']; const name = dest.company_name && !generic.includes(dest.company_name.trim()) ? dest.company_name : (dest.contact_name && !generic.includes(dest.contact_name.trim()) ? dest.contact_name : null); return name || dest.province || dest.location; })()}</div>
                    </div>
                  </div>
                ))}
                {job.destinations.length > 2 && (
                  <div className="flex items-center gap-2 sm:gap-3 pl-6">
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                      +{job.destinations.length - 2} {t('job.more_destinations')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2 sm:gap-3">
                <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0 sm:w-5 sm:h-5" />
                <div className="text-sm sm:text-base">
                  <div className="text-muted-foreground">{t('job.destination')}</div>
                  <div className="font-medium">{job.destination_location}</div>
                </div>
              </div>
            )}
          </div>
          
          {canViewPrice && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 sm:px-4 sm:py-2">
              <img src={coinsIcon} alt="coins" className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xl font-bold text-teal-700 sm:text-2xl">฿ {job.price.toLocaleString()}</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setGoodsModalOpen(true)}
          className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors sm:text-base"
          title={t('job.goods')}
        >
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t('job.goods')}</span>
        </button>

        {job.remarks && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm sm:p-4 sm:text-base">
            <span className="text-muted-foreground font-medium">{t('job.remarks')} : </span>
            <span>{job.remarks}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 sm:gap-3">
        <Button 
          variant="outline"
          onClick={handleViewDetail} 
          className="flex-1 h-11 text-sm font-medium min-w-0 sm:h-12 sm:text-base"
          disabled={isProcessing}
        >
          <Eye className="w-4 h-4 mr-1 flex-shrink-0 sm:w-5 sm:h-5" />
          <span className="truncate">{t('job.viewDetails')}</span>
        </Button>
        {showCancelButton ? (
          <>
            <Button 
              onClick={() => onAccept(job)} 
              className="flex-1 h-11 text-sm font-medium min-w-0 sm:h-12 sm:text-base"
              disabled={job.isAccepted || isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="truncate">{t('job.processing')}</span>
                </span>
              ) : (
                <span className="truncate">{job.isAccepted ? t('job.accepted') : (useStartJobLabel ? t('job.startJob') : t('job.accept'))}</span>
              )}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => onCancel?.(job)} 
              className="h-11 text-sm font-medium px-3 flex-shrink-0 sm:h-12 sm:text-base sm:px-4"
              disabled={isProcessing}
            >
              {t('job.cancel')}
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => onAccept(job)} 
            className="flex-1 h-11 text-sm font-medium min-w-0 sm:h-12 sm:text-base"
            disabled={job.isAccepted || isProcessing}
          >
            {isProcessing ? (
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="truncate">{t('job.processing')}</span>
              </span>
            ) : (
              <span className="truncate">{job.isAccepted ? t('job.accepted') : (useStartJobLabel ? t('job.startJob') : t('job.accept'))}</span>
            )}
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
              <p className="text-xs text-muted-foreground">{job.bl_no ? 'BL' : job.booking_no ? 'Booking' : t('job.orderCode')}</p>
              <p className="font-bold text-primary text-lg">{job.bl_no || job.booking_no || job.order_code}</p>
            </div>

            {/* Route */}
            <div className="space-y-3">
              {/* Origins - show multiple if available */}
              {!isInternational && Array.isArray(job.origins) && job.origins.length > 0 ? (
                job.origins.map((origin, idx) => (
                  <div key={`modal-origin-${idx}`} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('job.origin')} {job.origins.length > 1 ? `#${idx + 1}` : ''}</p>
                      {origin.company_name && !['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver'].includes(origin.company_name.trim()) && <p className="font-medium">{origin.company_name}</p>}
                      <p className={origin.company_name ? "text-xs text-muted-foreground" : "font-medium"}>{origin.address || origin.location}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('job.origin')}</p>
                    {job.origin_location.includes('\n') ? (
                      <>
                        <p className="font-medium">{job.origin_location.split('\n')[0]}</p>
                        <p className="text-xs text-muted-foreground">{job.origin_location.split('\n')[1]}</p>
                      </>
                    ) : (
                      <p className="font-medium">{job.origin_location}</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Destinations - show multiple if available */}
              {!isInternational && Array.isArray(job.destinations) && job.destinations.length > 0 ? (
              job.destinations.map((dest, idx) => (
                  <div key={`modal-dest-${idx}`} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('job.destination')} #{idx + 1}</p>
                      <p className="font-medium">{(() => { const generic = ['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver']; const name = dest.company_name && !generic.includes(dest.company_name.trim()) ? dest.company_name : (dest.contact_name && !generic.includes(dest.contact_name.trim()) ? dest.contact_name : null); return name || dest.location || '-'; })()}</p>
                      <p className="text-xs text-muted-foreground">{dest.address || dest.location}</p>
                      <p className="text-xs text-muted-foreground">{dest.province ? (dest.province.startsWith('จ.') ? dest.province : `จ.${dest.province}`) : (t('common.noData') || 'ไม่มีข้อมูล')}</p>
                      {dest.invoice_number && <p className="text-xs text-muted-foreground">{t('job.invoice')}: {dest.invoice_number}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('job.destination')}</p>
                    {job.destination_company_name
                      && !['ผู้ส่ง','ลูกค้า','ผู้รับ','sender','customer','receiver'].includes(job.destination_company_name.trim())
                      && job.destination_company_name.trim() !== (job.destination_location || '').trim()
                      && <p className="font-medium">{job.destination_company_name}</p>}
                    <p className={job.destination_company_name && job.destination_company_name.trim() !== (job.destination_location || '').trim() ? "text-xs text-muted-foreground" : "font-medium"}>{job.destination_location}</p>
                    {job.invoice_number && <p className="text-xs text-muted-foreground">{t('job.invoice')}: {job.invoice_number}</p>}
                  </div>
                </div>

              )}
            </div>

            {/* Price */}
            {canViewPrice && (
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                <Banknote className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('job.price')}</p>
                  <p className="font-bold text-lg text-primary">฿{job.price.toLocaleString()}</p>
                </div>
              </div>
            )}

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
                <p className="font-medium">
                  {job.bl_no || job.booking_no
                    ? (language === 'th' ? 'งานนอกประเทศ' : language === 'en' ? 'Overseas' : language === 'ko' ? '해외 운송' : '海外运输')
                    : (job.job_type ? getJobTypeLabel(job.job_type) : '-')
                  }
                </p>
              </div>
            </div>

            {/* Transport Type - Single/Multiple trips */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Truck className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('job.transportMode')}</p>
                <p className="font-medium">
                  {isDomestic 
                    ? (isSingleTrip ? t('job.one_way') : isMultipleLocations ? t('job.multiple_destinations') : '-')
                    : (language === 'th' ? 'ส่งเที่ยวเดียว' : language === 'en' ? 'Single Trip' : language === 'ko' ? '편도' : '单程')
                  }
                </p>
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
                <span className="text-muted-foreground">{t('job.product_summary')} : </span>
                <span>{translateGoodsType(job.goods_type, language)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('job.weight')} : </span>
                <span>{job.goods_weight ? `${job.goods_weight.toLocaleString()}${job.goods_unit ? ` ${translateUnit(job.goods_unit, language)}` : ` ${translateUnit('kg', language)}`}` : '-'}</span>
              </div>
              <div>
              <span className="text-muted-foreground">{t('job.quantity')} : </span>
              <span>{job.goods_quantity ? `${job.goods_quantity}${job.goods_quantity_unit ? ` ${translateUnit(job.goods_quantity_unit, language)}` : ''}` : '-'}</span>
            </div>
          </div>

          {/* Remarks */}
          {job.remarks && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <p className="text-xs text-muted-foreground font-medium mb-1">{t('job.remarks')}</p>
              <p className="text-foreground">{job.remarks}</p>
            </div>
          )}

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

      {/* Goods Info Modal */}
      <Dialog open={goodsModalOpen} onOpenChange={setGoodsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              {t('job.goods')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('job.goods')}</p>
              <p className="font-medium">{translateGoodsType(job.goods_type, language) || '-'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('job.weight')}</p>
              <p className="font-medium">{job.goods_weight ? `${job.goods_weight.toLocaleString()}${job.goods_unit ? ` ${translateUnit(job.goods_unit, language)}` : ` ${translateUnit('kg', language)}`}` : '-'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t('job.quantity')}</p>
              <p className="font-medium">{job.goods_quantity ? `${job.goods_quantity}${job.goods_quantity_unit ? ` ${translateUnit(job.goods_quantity_unit, language)}` : ''}` : '-'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoodsModalOpen(false)} className="w-full">
              {t('job.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
