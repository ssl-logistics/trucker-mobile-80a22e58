type Rec = Record<string, unknown>;

const VEHICLE_SOURCE_KEYS = ['vehicle', 'truck', 'factory_truck', 'factory_trucks', 'logistics_truck', 'logistics_trucks', 'logistics_trailer', 'logistics_trailers'];

const asRecord = (v: unknown): Rec | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null;

export const getVehicleApiSources = (user: unknown): Rec[] => {
  const root = asRecord(user);
  if (!root) return [];
  const sources = [root];
  VEHICLE_SOURCE_KEYS.forEach((key) => {
    const value = root[key];
    (Array.isArray(value) ? value : [value]).forEach((item) => {
      const r = asRecord(item);
      if (r) sources.push(r);
    });
  });
  return sources;
};

const pick = (sources: Rec[], keys: string[]) => {
  for (const s of sources) for (const k of keys) {
    const v = s[k];
    if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim();
  }
  return '';
};

/** Resolve "plate province" from the user object, including nested vehicle records. */
export const resolvePlateFromUser = (user: unknown): string => {
  const sources = getVehicleApiSources(user);
  const plate = pick(sources, ['plate_number', 'license_plate', 'truck_plate']);
  if (!plate) return '';
  const province = pick(sources, ['plate_province', 'license_plate_province', 'province']);
  return [plate, province].filter(Boolean).join(' ');
};
