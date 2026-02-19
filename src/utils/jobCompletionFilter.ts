/**
 * Shared utility for filtering completed jobs consistently across
 * Dashboard pages (Finance, Customer, Product) and History page.
 * 
 * A job is considered "completed" when:
 * - Domestic: ALL destination PODs are confirmed
 * - International: ALL PODs confirmed AND container return confirmed
 */

export interface CheckinData {
  freelance_driver_id?: string;
  internal_driver_id?: string;
  external_driver_id?: string;
  checkin_type?: string;
  transport_order_id?: string;
  transport_orders?: { order_number?: string };
  order_number?: string;
}

/** Check if a job is international */
export function isInternationalJob(job: any): boolean {
  return !!(job.booking_no || job.bl_no || (job.transport_category && job.transport_category !== 'domestic'));
}

/** Build POD count and container return maps from checkins */
export function buildCheckinMaps(checkins: CheckinData[], driverId: string) {
  const podCountByTransportId: Record<string, number> = {};
  const podCountByOrderNumber: Record<string, number> = {};
  const containerReturnConfirmedByTransportId = new Set<string>();
  const containerReturnConfirmedByOrderNumber = new Set<string>();

  checkins
    .filter((c) => c.freelance_driver_id === driverId)
    .forEach((c) => {
      if (c.checkin_type === 'delivery_confirmed' || c.checkin_type?.startsWith('delivery_confirmed_')) {
        if (c.transport_order_id) {
          const tid = String(c.transport_order_id);
          podCountByTransportId[tid] = (podCountByTransportId[tid] || 0) + 1;
        }
        const orderNumber = c.transport_orders?.order_number || c.order_number || '';
        if (orderNumber) {
          podCountByOrderNumber[orderNumber] = (podCountByOrderNumber[orderNumber] || 0) + 1;
        }
      }
      if (c.checkin_type === 'container_return_confirmed') {
        if (c.transport_order_id) {
          containerReturnConfirmedByTransportId.add(String(c.transport_order_id));
        }
        const orderNumber = c.transport_orders?.order_number || c.order_number || '';
        if (orderNumber) {
          containerReturnConfirmedByOrderNumber.add(orderNumber);
        }
      }
    });

  return {
    podCountByTransportId,
    podCountByOrderNumber,
    containerReturnConfirmedByTransportId,
    containerReturnConfirmedByOrderNumber,
  };
}

/** Check if a single job is fully completed (all PODs + container return for international) */
export function isJobFullyCompleted(
  job: any,
  maps: ReturnType<typeof buildCheckinMaps>
): boolean {
  const { podCountByTransportId, podCountByOrderNumber, containerReturnConfirmedByTransportId, containerReturnConfirmedByOrderNumber } = maps;

  const destinationCount = Array.isArray(job.destinations) && job.destinations.length > 0
    ? job.destinations.length
    : 1;

  const podCount = Math.max(
    podCountByTransportId[String(job.id)] || 0,
    podCountByOrderNumber[job.order_number] || 0
  );

  const allPodsCompleted = podCount >= destinationCount;

  if (isInternationalJob(job)) {
    const hasContainerReturn =
      containerReturnConfirmedByTransportId.has(String(job.id)) ||
      containerReturnConfirmedByOrderNumber.has(job.order_number);
    return allPodsCompleted && hasContainerReturn;
  }

  return allPodsCompleted;
}

/** Filter an array of jobs to only fully completed ones */
export function filterCompletedJobs(jobs: any[], checkins: any[], driverId: string): any[] {
  const maps = buildCheckinMaps(checkins, driverId);
  return jobs.filter((job) => isJobFullyCompleted(job, maps));
}
