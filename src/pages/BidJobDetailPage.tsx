import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, CircleDot, Phone, Clock, Package, Truck, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/dateUtils';
import { getTranslatedVehicleType } from '@/utils/vehicleTypeTranslation';
import coinsIcon from '@/assets/coins-icon.png';

interface BidTicket {
  id: string;
  ticket_number: string;
  status: string;
  product: string | null;
  weight_tons: number | null;
  trips_per_month: number | null;
  price: number | null;
  distance_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle_type: {
    id: string;
    name: string;
  } | null;
  route: {
    id: string;
    route_code: string;
    origin_district: {
      id: string;
      name: string;
      province: {
        id: string;
        name: string;
      };
    };
    destination_district: {
      id: string;
      name: string;
      province: {
        id: string;
        name: string;
      };
    };
  } | null;
  bids: Array<{
    id: string;
    status: string;
    bid_price: number;
    contractor_id: string;
    contractor: {
      id: string;
      full_name: string;
      company_name: string | null;
    };
  }>;
  customer: {
    id: string;
    full_name: string;
    company_name: string | null;
    phone: string | null;
  } | null;
  creator: {
    id: string;
    full_name: string;
    company_name: string | null;
  } | null;
}

export default function BidJobDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [ticket, setTicket] = useState<BidTicket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && ticketId) {
      loadTicketDetail();
    }
  }, [ticketId, user]);

  const loadTicketDetail = async () => {
    if (!user || !ticketId) return;
    setLoading(true);

    try {
      const response = await supabase.functions.invoke('list-tickets', {
        body: {
          freelance_driver_id: user.id,
          bids_status: 'accepted',
        },
      });

      if (response.data?.success && response.data?.data) {
        const tickets = response.data.data || [];
        // Find by ticket_number (ticketId from URL)
        const foundTicket = tickets.find(
          (t: BidTicket) => t.ticket_number === ticketId || t.id === ticketId
        );

        if (foundTicket) {
          setTicket(foundTicket);
        } else {
          console.error('Ticket not found:', ticketId);
        }
      }
    } catch (error) {
      console.error('Error loading ticket detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-header text-header-foreground rounded-b-xl shadow-lg page-header-safe">
          <div className="flex items-center justify-center px-4 py-3 relative">
            <button
              onClick={() => navigate(-1)}
              className="absolute left-0 p-2 hover:bg-white/10 rounded-full"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold">{t('bidJob.title')}</h1>
          </div>
        </header>
        <div className="p-4 text-center text-muted-foreground">
          {t('bidJob.notFound')}
        </div>
      </div>
    );
  }

  // Get accepted bid for current user
  const userBid = ticket.bids?.find(
    (b) => b.status === 'accepted' && b.contractor_id === user?.id
  );
  const bidPrice = userBid?.bid_price || ticket.price || 0;

  // Extract location info
  const originDistrict = ticket.route?.origin_district;
  const destDistrict = ticket.route?.destination_district;
  const originLocation = originDistrict
    ? `${originDistrict.name}, ${originDistrict.province?.name || ''}`
    : '-';
  const destLocation = destDistrict
    ? `${destDistrict.name}, ${destDistrict.province?.name || ''}`
    : '-';

  // Get employer info
  const employer =
    ticket.customer?.company_name ||
    ticket.customer?.full_name ||
    ticket.creator?.company_name ||
    ticket.creator?.full_name ||
    '-';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-header text-header-foreground rounded-b-xl shadow-lg page-header-safe">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 p-2 hover:bg-white/10 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{t('bidJob.title')}</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Order Info Card */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-green-50">
            <div className="bg-green-100 text-sm font-medium px-3 py-1 rounded-br-xl -ml-3 -mt-2 text-green-800">
              {t('job.order_code')} {ticket.ticket_number}
            </div>
            <Badge
              variant="secondary"
              className={
                ticket.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }
            >
              {ticket.status === 'completed'
                ? t('jobStatus.completed')
                : t('jobStatus.inProgress')}
            </Badge>
          </div>

          <div className="p-4 space-y-4">
            {/* Employer */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('job.employer')}:</span>
              <span className="font-medium">{employer}</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-teal-50">
              <img src={coinsIcon} alt="coins" className="w-6 h-6" />
              <span className="text-xl font-bold text-teal-600">
                ฿ {bidPrice.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground ml-2">
                ({t('bidJob.yourBid')})
              </span>
            </div>

            {/* Route */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <CircleDot className="w-4 h-4 text-green-600" />
                <div className="w-0.5 flex-1 border-l-2 border-dashed border-gray-300 my-1"></div>
                <MapPin className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">{t('job.origin')}</div>
                  <div className="font-medium">{originLocation}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t('job.destination')}</div>
                  <div className="font-medium">{destLocation}</div>
                </div>
              </div>
            </div>

            {/* Distance */}
            {ticket.distance_km && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('bidJob.distance')}:</span>
                <span className="font-medium">{ticket.distance_km} กม.</span>
              </div>
            )}
          </div>
        </Card>

        {/* Product Info Card */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            {t('job.goods')}
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">{t('job.goods')}</div>
              <div className="font-medium">{ticket.product || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('job.weight')}</div>
              <div className="font-medium">
                {ticket.weight_tons ? `${ticket.weight_tons} ตัน` : '-'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('bidJob.tripsPerMonth')}</div>
              <div className="font-medium">
                {ticket.trips_per_month ? `${ticket.trips_per_month} เที่ยว/เดือน` : '-'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('job.vehicleType')}</div>
              <div className="font-medium">
                {ticket.vehicle_type?.name
                  ? getTranslatedVehicleType(ticket.vehicle_type.name, t)
                  : '-'}
              </div>
            </div>
          </div>
        </Card>

        {/* Contact Info */}
        {ticket.customer?.phone && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {t('job.contact')}
            </h3>

            <div className="text-sm">
              <div className="text-muted-foreground">{t('job.customerPhone')}</div>
              <a
                href={`tel:${ticket.customer.phone}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {ticket.customer.phone}
              </a>
            </div>
          </Card>
        )}

        {/* Notes */}
        {ticket.notes && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">{t('job.remarks')}</h3>
            <p className="text-sm text-muted-foreground">{ticket.notes}</p>
          </Card>
        )}

        {/* Dates */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('bidJob.dates')}
          </h3>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">{t('bidJob.createdAt')}</div>
              <div className="font-medium">
                {formatDate(ticket.created_at.split('T')[0], language)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('bidJob.updatedAt')}</div>
              <div className="font-medium">
                {formatDate(ticket.updated_at.split('T')[0], language)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
