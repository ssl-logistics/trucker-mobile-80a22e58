import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import DomesticJobDetail from '@/components/job-detail/DomesticJobDetail';

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
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  created_at: string;
  updated_at: string;
  vehicle_type: {
    id: string;
    name: string;
  } | null;
  route: {
    id: string;
    route_code: string;
    origin_latitude?: number | null;
    origin_longitude?: number | null;
    destination_latitude?: number | null;
    destination_longitude?: number | null;
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

// Interface matching what the detail components expect
interface JobDetail {
  id: string;
  order_code: string;
  job_type: string;
  employer_name: string;
  transport_type: string;
  origin_location: string;
  origin_address: string | null;
  origin_company_name: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  origin_contact_phone: string | null;
  destination_location: string;
  destination_address: string | null;
  destination_company_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  destination_contact_phone: string | null;
  price: number;
  start_date: string;
  start_time: string;
  equipment_list: string | null;
  safety_equipment: string | null;
  container_checkpoint: string | null;
  container_checkpoint_code: string | null;
  empty_container_date: string | null;
  container_number: string | null;
  container_number_2: string | null;
  seal_number: string | null;
  seal_number_2: string | null;
  origin_contact_person: string | null;
  origin_contact_role: string | null;
  origin_bill_of_lading: string | null;
  origin_goods_type: string | null;
  origin_goods_quantity: string | null;
  origin_remarks: string | null;
  destination_contact_person: string | null;
  destination_bill_of_lading: string | null;
  destination_goods_type: string | null;
  destination_goods_quantity: string | null;
  destination_time: string | null;
  destination_date: string | null;
  destination_remarks: string | null;
  tax_id: string | null;
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

export default function BidJobDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
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
        const foundTicket: BidTicket | undefined = tickets.find(
          (t: BidTicket) => t.ticket_number === ticketId || t.id === ticketId
        );

        if (foundTicket) {
          // Map BidTicket to JobDetail format
          const mappedJob = mapTicketToJobDetail(foundTicket, user.id);
          setJob(mappedJob);

          // Create job application based on ticket status
          const jobApplicationData: JobApplication = {
            checked_in_at: null,
            sop_completed_at: null,
            job_started_at: foundTicket.status === 'in_progress' || foundTicket.status === 'completed' ? new Date().toISOString() : null,
            delivery_checked_in_at: foundTicket.status === 'delivered' || foundTicket.status === 'completed' ? new Date().toISOString() : null,
            delivery_sop_completed_at: foundTicket.status === 'completed' ? new Date().toISOString() : null,
            container_checked_in_at: null,
            container_sop_completed_at: null,
            status: foundTicket.status,
          };
          setJobApplication(jobApplicationData);
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

  const mapTicketToJobDetail = (ticket: BidTicket, userId: string): JobDetail => {
    // Get accepted bid for current user
    const userBid = ticket.bids?.find(
      (b) => b.status === 'accepted' && b.contractor_id === userId
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

    return {
      id: ticket.id,
      order_code: ticket.ticket_number,
      job_type: 'domestic',
      employer_name: employer,
      transport_type: 'เที่ยวเดียว',
      origin_location: originLocation,
      origin_address: null,
      origin_company_name: ticket.customer?.company_name || null,
      origin_latitude: ticket.route?.origin_latitude || null,
      origin_longitude: ticket.route?.origin_longitude || null,
      origin_contact_phone: ticket.customer?.phone || null,
      destination_location: destLocation,
      destination_address: null,
      destination_company_name: null,
      destination_latitude: ticket.route?.destination_latitude || null,
      destination_longitude: ticket.route?.destination_longitude || null,
      destination_contact_phone: null,
      price: bidPrice,
      start_date: ticket.pickup_datetime ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'yyyy-MM-dd') : ticket.created_at.split('T')[0],
      start_time: ticket.pickup_datetime ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'HH:mm') : '00:00',
      equipment_list: ticket.vehicle_type?.name || null,
      safety_equipment: null,
      container_checkpoint: null,
      container_checkpoint_code: null,
      empty_container_date: null,
      container_number: null,
      container_number_2: null,
      seal_number: null,
      seal_number_2: null,
      origin_contact_person: ticket.customer?.full_name || null,
      origin_contact_role: null,
      origin_bill_of_lading: null,
      origin_goods_type: ticket.product,
      origin_goods_quantity: ticket.weight_tons ? `${ticket.weight_tons} ตัน` : null,
      origin_remarks: ticket.notes,
      destination_contact_person: null,
      destination_bill_of_lading: null,
      destination_goods_type: ticket.product,
      destination_goods_quantity: ticket.weight_tons ? `${ticket.weight_tons} ตัน` : null,
      destination_time: ticket.delivery_datetime ? formatInTimeZone(new Date(ticket.delivery_datetime), 'Asia/Bangkok', 'HH:mm') : null,
      destination_date: ticket.delivery_datetime ? formatInTimeZone(new Date(ticket.delivery_datetime), 'Asia/Bangkok', 'yyyy-MM-dd') : null,
      destination_remarks: ticket.notes,
      tax_id: null,
    };
  };

  if (loading) {
    return null; // Let Suspense boundary handle loading
  }

  if (!job || !user) {
    return (
      <div className="min-h-screen bg-background">
        <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl shadow-lg">
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

  // Use the same DomesticJobDetail component as Internal jobs
  return (
    <DomesticJobDetail
      job={job}
      jobApplication={jobApplication}
      userId={user.id}
      onUpdate={loadTicketDetail}
      isBidJob={true}
    />
  );
}
