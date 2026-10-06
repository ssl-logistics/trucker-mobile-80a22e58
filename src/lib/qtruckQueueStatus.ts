import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget: update the QTruck queue status for an order.
 * - 'processing' when the driver checks in at the origin point
 * - 'completed' when the pickup SOP is confirmed
 * The edge function quietly no-ops when the order has no active queue,
 * so callers don't need to check has_qtruck_booking first.
 */
export function notifyQtruckQueueStatus(
  orderNumber: string | null | undefined,
  status: 'processing' | 'completed',
): void {
  if (!orderNumber) return;
  supabase.functions
    .invoke('update-qtruck-queue-status', {
      body: { order_number: orderNumber, status },
    })
    .then(({ error }) => {
      if (error) console.warn('[QTruck] queue status update error:', error);
    })
    .catch((e) => console.warn('[QTruck] queue status update failed:', e));
}

/**
 * Fire-and-forget: notify the QTruck queue system that the driver scanned
 * the loading-station QR (station_token comes from the scanned QR code).
 * The edge function quietly logs failures (404 = queue finished, 400 =
 * multiple active queues), so callers don't need to handle them.
 */
export function notifyQtruckQueueScan(
  orderNumber: string | null | undefined,
  stationToken: string,
): void {
  if (!orderNumber || !stationToken) return;
  supabase.functions
    .invoke('qtruck-queue-scan', {
      body: { order_number: orderNumber, station_token: stationToken },
    })
    .then(({ error }) => {
      if (error) console.warn('[QTruck] queue scan error:', error);
    })
    .catch((e) => console.warn('[QTruck] queue scan failed:', e));
}
