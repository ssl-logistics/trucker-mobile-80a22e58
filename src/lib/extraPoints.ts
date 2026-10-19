// Extra container points (per-container) sent by get-driver-assigned-jobs:
// extra_cargo_points (point_type=cargo) and extra_drop_points (point_type=drop).
// Progress is kept on the device until the backend defines a check-in payload.

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
}

export type ExtraPointKind = 'cargo' | 'drop';
/** cargo: checked_in -> done. drop: dropped -> picked_up (done). */
export type ExtraStep = 'checked_in' | 'done' | 'dropped' | 'picked_up';

export interface ExtraProgress {
  checked_in?: string;
  done?: string;
  dropped?: string;
  picked_up?: string;
}

const norm = (list: unknown): ExtraPoint[] =>
  (Array.isArray(list) ? list : [])
    .filter((p) => p && typeof p === 'object')
    .map((p: any, i) => ({ ...p, sequence: Number(p.sequence ?? i + 1) }))
    .sort((a, b) => a.sequence - b.sequence);

export const getExtraCargoPoints = (job: any): ExtraPoint[] => norm(job?.extra_cargo_points);
export const getExtraDropPoints = (job: any): ExtraPoint[] => norm(job?.extra_drop_points);

const key = (order: string, kind: ExtraPointKind, seq: number) =>
  `extra_point_progress:${order}:${kind}:${seq}`;

export const EXTRA_POINT_EVENT = 'extra-point-progress';

export function readExtraProgress(order: string, kind: ExtraPointKind, seq: number): ExtraProgress {
  try {
    return JSON.parse(localStorage.getItem(key(order, kind, seq)) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveExtraStep(order: string, kind: ExtraPointKind, seq: number, step: ExtraStep, at = new Date().toISOString()) {
  const next = { ...readExtraProgress(order, kind, seq), [step]: at };
  localStorage.setItem(key(order, kind, seq), JSON.stringify(next));
  window.dispatchEvent(new Event(EXTRA_POINT_EVENT));
  return next;
}

export const isExtraPointDone = (kind: ExtraPointKind, p: ExtraProgress) =>
  kind === 'cargo' ? !!p.done : !!p.picked_up;

/** True when every extra cargo point of the order is completed (true when there are none). */
export function allExtraCargoDone(order: string, points: ExtraPoint[]): boolean {
  return points.every((p) => isExtraPointDone('cargo', readExtraProgress(order, 'cargo', p.sequence)));
}

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
