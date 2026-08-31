import { supabase } from "@/integrations/supabase/client";

export interface TaladJob {
  job_id: string;
  talad_code?: string | null;
  source?: string;
  title?: string | null;
  job_type?: string | null;
  service_type?: string | null;
  status?: string | null;
  origin?: string | null;
  destination?: string | null;
  truck_type?: string | null;
  weight?: string | number | null;
  price?: number | null;
  final_price?: number | null;
  payment_term?: string | null;
  required_vehicles?: number | null;
  bid_count?: number | null;
  lowest_bid?: number | null;
  auction_deadline?: string | null;
  auction_status?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  container?: {
    is_container?: boolean;
    container_type?: string | null;
    container_count?: number | null;
    booking_no?: string | null;
    shipping_line?: string | null;
    port_of_loading?: string | null;
    direction?: string | null;
  } | null;
  locations?: {
    pickup?: string | null;
    dropoff?: string | null;
    pickup_date?: string | null;
    delivery_date?: string | null;
  } | null;
  poster?: {
    user_id?: string;
    account_type?: string | null;
    company_name?: string | null;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    identity_status?: string | null;
    verified?: boolean;
  } | null;
}

/**
 * Fetch marketplace jobs from the external "talad" marketplace via a secure
 * edge-function proxy (the x-api-key never reaches the client).
 */
export async function getTaladJobs(): Promise<{ jobs: TaladJob[]; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('get-talad-jobs', { body: {} });
    if (error) {
      console.error('[TaladAPI] invoke error:', error.message);
      return { jobs: [], error: error.message };
    }
    const jobs = Array.isArray((data as any)?.jobs) ? ((data as any).jobs as TaladJob[]) : [];
    return { jobs, error: (data as any)?.error ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[TaladAPI] error:', message);
    return { jobs: [], error: message };
  }
}
