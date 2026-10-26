import { supabase } from '@/integrations/supabase/client';

export interface CodQr {
  paymentId: string;
  qrImage: string | null;
  qrRaw: string | null;
  expiresAt: string | null;
}

/** Real payment states that mean the customer has paid (the outer API "status" only means the call worked). */
const PAID = ['PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED', 'APPROVED', 'SETTLED'];

export function isQrPaid(paymentStatus: string | null | undefined): boolean {
  return !!paymentStatus && PAID.includes(String(paymentStatus).toUpperCase());
}

export function secondsLeft(expiresAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((t - now) / 1000));
}

export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function createCodQr(amount: number, reference: string): Promise<CodQr> {
  const { data, error } = await supabase.functions.invoke('cod-qr-payment', {
    body: { action: 'create', amount, reference: reference.slice(0, 100), qr_provider: 'bot_qr', shop: 'live' },
  });
  if (error || !data?.success || !data?.payment_id || (!data.qr_raw_data && !data.qr_image_url)) {
    throw new Error(data?.error ? String(data.error) : error?.message || 'qr create failed');
  }
  return { paymentId: data.payment_id, qrImage: data.qr_image_url ?? null, qrRaw: data.qr_raw_data ?? null, expiresAt: data.expires_at ?? null };
}

export async function checkCodQr(paymentId: string): Promise<{ paid: boolean; status: string | null }> {
  const { data, error } = await supabase.functions.invoke('cod-qr-payment', { body: { action: 'status', payment_id: paymentId } });
  if (error || !data?.success) throw new Error(error?.message || 'qr status failed');
  return { paid: isQrPaid(data.payment_status) , status: data.payment_status ?? null };
}
