export interface CodInfo {
  enabled: boolean;
  amount: number | null;
  method: 'cash' | 'qr' | null;
}

const NONE: CodInfo = { enabled: false, amount: null, method: null };

function read(c: any): CodInfo {
  if (!c || c.enabled !== true) return NONE;
  const amt = c.amount == null ? null : Number(c.amount);
  const m = c.payment_method === 'qr' || c.payment_method === 'cash' ? c.payment_method : null;
  return { enabled: true, amount: Number.isFinite(amt as number) ? amt : null, method: m };
}

/**
 * COD for one delivery point. Multi-destination jobs read destinations[].cod
 * for the given sequence; single-trip jobs read the job-level cod.
 */
export function getCodForPoint(job: any, sequence: number | null | undefined): CodInfo {
  if (!job) return NONE;
  const dests: any[] = Array.isArray(job.destinations) ? job.destinations : [];
  if (dests.length > 1 && sequence != null) {
    const d = dests.find((x) => Number(x?.sequence_number) === Number(sequence));
    return read(d?.cod);
  }
  if (dests.length === 1 && dests[0]?.cod?.enabled) return read(dests[0].cod);
  return read(job.cod);
}

/** True when the job or any of its delivery points collects cash on delivery. */
export function jobHasCod(job: any): boolean {
  if (!job) return false;
  if (job.has_cod === true || job.cod?.enabled === true) return true;
  return Array.isArray(job.destinations) && job.destinations.some((d: any) => d?.cod?.enabled === true);
}

/** Total COD amount across the job's delivery points; null total when no amount is known. */
export function codTotal(job: any): { total: number | null; points: number } {
  if (!job) return { total: null, points: 0 };
  const dests: any[] = Array.isArray(job.destinations) ? job.destinations : [];
  const infos = dests.length > 1
    ? dests.map((d) => read(d?.cod)).filter((c) => c.enabled)
    : [getCodForPoint(job, null)].filter((c) => c.enabled);
  const amts = infos.map((c) => c.amount).filter((a): a is number => a != null);
  return { total: amts.length ? amts.reduce((s, a) => s + a, 0) : null, points: infos.length };
}

/** Tab badge text: 0 when empty, capped at 99+. */
export function tabCount(n: number): string { return n > 99 ? '99+' : String(Math.max(0, n)); }
