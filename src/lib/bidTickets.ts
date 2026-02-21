import { supabase } from '@/integrations/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';

export interface BidTicket {
  id: string;
  ticket_number: string;
  created_at: string;
  status?: string;
  product?: string | null;
  weight_tons?: number | null;
  pickup_datetime?: string | null;
  delivery_datetime?: string | null;
  notes?: string | null;
  route?: {
    origin_district?: {
      name: string;
      province?: { name: string };
    };
    destination_district?: {
      name: string;
      province?: { name: string };
    };
  } | null;
  customer?: {
    full_name: string;
    company_name: string | null;
    phone?: string | null;
  } | null;
  creator?: {
    full_name: string;
    company_name: string | null;
  } | null;
}

function extractTickets(payload: any): BidTicket[] {
  const data = payload?.data;
  if (Array.isArray(data)) return data as BidTicket[];
  if (Array.isArray(data?.data)) return data.data as BidTicket[];
  if (Array.isArray(payload?.tickets)) return payload.tickets as BidTicket[];
  return [];
}

export async function fetchAcceptedBidTickets(limit = 50): Promise<BidTicket[]> {
  const { data, error } = await supabase.functions.invoke('list-tickets', {
    body: {
      bids_status: 'accepted',
      limit: String(limit),
    },
  });

  if (error) throw error;
  if (!data?.success) return [];
  return extractTickets(data);
}

export function mapBidTicketToPickupLikeJobDetail(ticket: BidTicket) {
  const originDistrict = ticket.route?.origin_district;
  const originLocation = originDistrict
    ? `${originDistrict.name}, ${originDistrict.province?.name || ''}`.replace(/,\s*$/, '')
    : '-';

  const employer =
    ticket.customer?.company_name ||
    ticket.customer?.full_name ||
    ticket.creator?.company_name ||
    ticket.creator?.full_name ||
    '-';

  return {
    id: ticket.id,
    order_code: ticket.ticket_number,
    order_number: ticket.ticket_number,
    employer_name: employer,
    origin_location: originLocation,
    start_date: ticket.pickup_datetime
      ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'yyyy-MM-dd')
      : ticket.created_at?.split('T')?.[0] || '',
    start_time: ticket.pickup_datetime
      ? formatInTimeZone(new Date(ticket.pickup_datetime), 'Asia/Bangkok', 'HH:mm')
      : '00:00',
    origin_contact_person: ticket.customer?.full_name || null,
    origin_contact_role: ticket.customer?.phone || null,
    origin_goods_type: ticket.product ?? null,
    origin_goods_quantity:
      ticket.weight_tons !== null && ticket.weight_tons !== undefined ? `${ticket.weight_tons} ตัน` : null,
    origin_remarks: ticket.notes ?? null,
    origin_address: null,
    origin_company_name: ticket.customer?.company_name || null,
    origin_latitude: undefined,
    origin_longitude: undefined,
    destination_latitude: undefined,
    destination_longitude: undefined,
  };
}
