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
