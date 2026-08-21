/**
 * Shared origin/destination resolution for job cards.
 *
 * Single source of truth so that "งานสำหรับคุณ" (Home) and "งานปัจจุบัน"
 * (CurrentJobsPage) always display the same location values.
 */

export type LocationObject = { name?: string | null; [key: string]: unknown } | null;

export const normalizeLocationObject = (value: unknown): LocationObject => {
  if (!value) return null;
  if (typeof value === 'object') return value as { name?: string | null; [key: string]: unknown };
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const getApiLocationName = (value: unknown): string =>
  (normalizeLocationObject(value)?.name as string) || '-';

export const isInternationalJobItem = (item: any): boolean =>
  !!(
    item?.bl_no ||
    item?.bl_number ||
    item?.bill_of_lading ||
    item?.booking_no ||
    item?.booking_number ||
    item?.job_type === 'international' ||
    item?.transport_category === 'international' ||
    (item?.transport_mode && ['sea', 'air'].includes(String(item.transport_mode).toLowerCase()))
  );

/**
 * Resolve origin/destination display names using the exact same rules as
 * CurrentJobsPage:
 * - domestic: origin.name / destination.name
 * - international: origin.name / return_terminal.location || return_terminal.name
 */
export const resolveJobLocations = (
  item: any,
  options?: { emptyValue?: string }
): { originLocation: string; destinationLocation: string } => {
  const empty = options?.emptyValue ?? '-';

  if (isInternationalJobItem(item)) {
    const intl = item?.international_details || {};
    const originObj = normalizeLocationObject(item?.origin) || normalizeLocationObject(intl.origin) || {};
    const returnObj =
      normalizeLocationObject(item?.return_terminal) || normalizeLocationObject(intl.return_terminal) || {};
    return {
      originLocation: (originObj.name as string) || empty,
      destinationLocation: ((returnObj.location as string) || (returnObj.name as string)) || empty,
    };
  }

  return {
    originLocation: (normalizeLocationObject(item?.origin)?.name as string) || empty,
    destinationLocation: (normalizeLocationObject(item?.destination)?.name as string) || empty,
  };
};
