export interface AccidentEvidenceInfo {
  id?: string;
  order_number?: string;
}

type JobFallback = {
  id?: string | null;
  order_number?: string | null;
  order_code?: string | null;
};

const parseJsonLike = (value: unknown): unknown | null => {
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

export const getAccidentEvidenceInfo = (
  payload: unknown,
  fallback?: JobFallback,
): AccidentEvidenceInfo | null => {
  const queue: unknown[] = [payload];

  if (payload instanceof Error) queue.push(payload.message);

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    const parsed = parseJsonLike(item);
    if (parsed) queue.push(parsed);

    if (!item || typeof item !== 'object') continue;

    const obj = item as Record<string, any>;
    const data = obj.data && typeof obj.data === 'object' ? obj.data : null;
    const needsEvidence =
      obj.error_code === 'ACCIDENT_EVIDENCE_REQUIRED' ||
      obj.code === 'ACCIDENT_EVIDENCE_REQUIRED' ||
      obj.requires_accident_evidence === true ||
      data?.requires_accident_evidence === true;

    if (needsEvidence) {
      return {
        id: data?.order_id || obj.order_id || fallback?.id || undefined,
        order_number: data?.order_number || obj.order_number || fallback?.order_number || fallback?.order_code || undefined,
      };
    }

    if (obj.data) queue.push(obj.data);
    if (obj.details) queue.push(obj.details);
    if (obj.error) queue.push(obj.error);
    if (obj.message) queue.push(obj.message);
  }

  return null;
};