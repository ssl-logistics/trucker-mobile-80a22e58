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

export type TaladMarketType = 'urgent' | 'auction' | 'interest';

/**
 * Classify a talad marketplace job into one of the 3 market types.
 * container/urgent → urgent, auction_reference → interest, else auction.
 */
export function getTaladMarketType(job: TaladJob): TaladMarketType {
  const category = ((job as any).job_category || '').toLowerCase();
  const jobType = (job.job_type || '').toLowerCase();
  if (category === 'container' || jobType === 'urgent' || job.service_type === 'container') return 'urgent';
  if (category === 'auction_reference') return 'interest';
  return 'auction';
}

// --- Action stubs: Talad has no accept/bid/interest endpoints yet (UI รอ API) ---

export async function acceptTaladJob(_job: TaladJob): Promise<{ ok: boolean; error: string | null }> {
  // TODO: call talad accept endpoint once provided
  return { ok: false, error: 'accept endpoint not available yet' };
}

export async function submitTaladBid(_jobId: string, _price: number): Promise<{ ok: boolean; error: string | null }> {
  // TODO: call talad bid endpoint once provided
  return { ok: false, error: 'bid endpoint not available yet' };
}

export async function expressTaladInterest(_jobId: string): Promise<{ ok: boolean; error: string | null }> {
  // TODO: call talad interest endpoint once provided
  return { ok: false, error: 'interest endpoint not available yet' };
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
