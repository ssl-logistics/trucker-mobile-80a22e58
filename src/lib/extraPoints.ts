// Extra container points (per-container) sent by get-driver-assigned-jobs:
// extra_cargo_points and extra_drop_points. Check-in goes through driver-checkin
// with checkin_type extra_cargo | extra_drop | extra_drop_pickup + extra_point_sequence.
// Jobs without extra points are never gated (every gate returns true).

export interface ExtraPoint {
  sequence: number;
  location_id?: string | null;
  location_name?: string | null;
  address?: string | null;
  province?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  status?: string | null;
}

export type ExtraPointKind = 'cargo' | 'drop';
export type ExtraCheckinType = 'extra_cargo' | 'extra_drop' | 'extra_drop_pickup';
export type DropState = 'pending' | 'dropped' | 'picked_up';

const norm = (list: unknown): ExtraPoint[] =>
  (Array.isArray(list) ? list : [])
    .filter((p) => p && typeof p === 'object')
    .map((p: any, i) => ({ ...p, sequence: Number(p.sequence ?? i + 1) }))
    .sort((a, b) => a.sequence - b.sequence);

export const getExtraCargoPoints = (job: any): ExtraPoint[] => norm(job?.extra_cargo_points);
export const getExtraDropPoints = (job: any): ExtraPoint[] => norm(job?.extra_drop_points);

export const EXTRA_POINT_EVENT = 'extra-point-progress';

// ---- Local record of check-ins just sent successfully (bridges API lag) ----
const LKEY = 'extra_point_checkins_v2';
const TTL = 24 * 60 * 60 * 1000;
type LocalRec = { order: string; type: ExtraCheckinType; seq: number; at: number };

function readLocal(): LocalRec[] {
  try {
    const a = JSON.parse(localStorage.getItem(LKEY) || '[]');
    return Array.isArray(a) ? a.filter((r) => Date.now() - r.at < TTL) : [];
  } catch {
    return [];
  }
}

export function recordExtraCheckin(order: string, type: ExtraCheckinType, seq: number) {
  const list = readLocal().filter((r) => !(r.order === order && r.type === type && r.seq === seq));
  list.push({ order, type, seq, at: Date.now() });
  try { localStorage.setItem(LKEY, JSON.stringify(list)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EXTRA_POINT_EVENT));
}

/** Checkin-like rows ({checkin_type, destination_sequence_number}) for one order from local records. */
export const localExtraCheckins = (order: string) =>
  readLocal().filter((r) => r.order === order).map((r) => ({ checkin_type: r.type, destination_sequence_number: r.seq }));

const seqOf = (c: any) => Number(c?.extra_point_sequence ?? c?.destination_sequence_number);
const has = (checkins: any[], type: ExtraCheckinType, seq: number) =>
  checkins.some((c) => c?.checkin_type === type && seqOf(c) === seq);

export function dropState(p: ExtraPoint, checkins: any[]): DropState {
  const s = String(p.status || '').toLowerCase();
  if (s === 'picked_up' || has(checkins, 'extra_drop_pickup', p.sequence)) return 'picked_up';
  if (s === 'dropped' || has(checkins, 'extra_drop', p.sequence)) return 'dropped';
  return 'pending';
}

export function cargoDone(p: ExtraPoint, checkins: any[]): boolean {
  return String(p.status || '').toLowerCase() === 'completed' || has(checkins, 'extra_cargo', p.sequence);
}

/** True when every drop point has been picked up again (true when there are none). */
export const allDropsPickedUp = (points: ExtraPoint[], checkins: any[]) =>
  points.every((p) => dropState(p, checkins) === 'picked_up');

/** True when every extra cargo point is completed (true when there are none). */
export const allExtraCargoDone = (points: ExtraPoint[], checkins: any[]) =>
  points.every((p) => cargoDone(p, checkins));

export const extraPointAddress = (p: ExtraPoint) =>
  [p.address, p.district, p.province].filter((v) => v && String(v).trim()).join(' ');

export function openExtraPointRoute(p: ExtraPoint): boolean {
  if (p.latitude != null && p.longitude != null) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`, '_blank');
    return true;
  }
  const q = extraPointAddress(p) || p.location_name;
  if (q) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
    return true;
  }
  return false;
}
