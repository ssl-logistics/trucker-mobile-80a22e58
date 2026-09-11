import { callExternalApi } from "./externalApi";

export interface ExpenseCategoryType {
  /** machine code, e.g. "fuel" */
  value: string;
  /** English name used when submitting to transport-expenses */
  nameEn: string;
  names: {
    th?: string;
    en?: string;
    zh?: string;
    ko?: string;
  };
  sortOrder: number;
}

let cache: ExpenseCategoryType[] | null = null;
let inflight: Promise<ExpenseCategoryType[] | null> | null = null;

/**
 * Fetch expense category types from the external finance-category-types API.
 * Returns null when the API fails or has no usable data, so callers can
 * fall back to the hardcoded list. Result is cached in memory per session.
 */
export async function fetchExpenseCategoryTypes(): Promise<ExpenseCategoryType[] | null> {
  if (cache && cache.length > 0) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await callExternalApi<any>('finance-category-types', { method: 'GET' });
      if (error || !data) return null;

      const list: any[] = Array.isArray(data?.data) ? data.data : [];
      const mapped: ExpenseCategoryType[] = list
        .filter((item) => item && item.kind === 'expense' && item.is_active === true && typeof item.code === 'string' && item.code)
        .map((item) => ({
          value: item.code,
          nameEn: item.name_en || item.code,
          names: {
            th: item.name_th || undefined,
            en: item.name_en || undefined,
            zh: item.name_zh || undefined,
            ko: item.name_ko || undefined,
          },
          sortOrder: typeof item.sort_order === 'number' ? item.sort_order : 9999,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (mapped.length === 0) return null;
      cache = mapped;
      return cache;
    } catch (e) {
      console.warn('[expenseCategoryTypes] fetch failed, using hardcoded fallback:', e);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Pick the display label for the current app language. */
export function getExpenseCategoryLabel(
  type: ExpenseCategoryType,
  language: string,
): string {
  const localized =
    language === 'th' ? type.names.th :
    language === 'zh' ? type.names.zh :
    language === 'ko' ? type.names.ko :
    type.names.en;
  return localized || type.nameEn || type.value;
}
