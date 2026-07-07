import { supabase } from "@/integrations/supabase/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-profile-data`;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export interface DriverBankData {
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
}

export interface DriverVehicleData {
  plate_number?: string;
  plate_province?: string;
  vehicle_brand?: string;
  vehicle_color?: string;
  vin?: string;
  vehicle_type?: string;
  fuel_type?: string;
  load_capacity?: number | null;
  width?: number | null;
  length?: number | null;
  height?: number | null;
  container_types?: string[];
  has_trailer?: boolean;
  trailer_plate_number?: string;
  trailer_plate_province?: string;
}

const isUuid = (id?: string | null): id is string => !!id && UUID_RE.test(id);

export async function fetchDriverProfileData(driverId?: string | null): Promise<{
  bank: Record<string, any> | null;
  vehicle: Record<string, any> | null;
} | null> {
  if (!isUuid(driverId)) return null;
  try {
    const res = await fetch(`${FN_URL}?driver_id=${driverId}`, { headers: HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[driver-profile-data] fetch failed:", e);
    return null;
  }
}

export async function saveDriverBank(
  driverId: string | null | undefined,
  bank: DriverBankData,
): Promise<boolean> {
  if (!isUuid(driverId)) return false;
  try {
    const res = await fetch(FN_URL, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ driver_id: driverId, bank }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[driver-profile-data] save bank failed:", e);
    return false;
  }
}

export async function saveDriverVehicle(
  driverId: string | null | undefined,
  vehicle: DriverVehicleData,
): Promise<boolean> {
  if (!isUuid(driverId)) return false;
  try {
    const res = await fetch(FN_URL, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ driver_id: driverId, vehicle }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[driver-profile-data] save vehicle failed:", e);
    return false;
  }
}

/** Merge fetched extras into a driver object (extras take precedence). */
export function mergeDriverExtras<T extends Record<string, any>>(
  driver: T,
  extras: { bank: Record<string, any> | null; vehicle: Record<string, any> | null } | null,
): T {
  if (!extras) return driver;
  const merged: Record<string, any> = { ...driver };

  if (extras.bank) {
    if (extras.bank.bank_name) merged.bank_name = extras.bank.bank_name;
    if (extras.bank.account_number) {
      merged.bank_account_number = extras.bank.account_number;
      merged.account_number = extras.bank.account_number;
    }
    if (extras.bank.account_name) {
      merged.bank_account_name = extras.bank.account_name;
      merged.account_name = extras.bank.account_name;
    }
  }

  if (extras.vehicle) {
    for (const key of [
      "plate_number", "plate_province", "vehicle_brand", "vehicle_color",
      "vin", "vehicle_type", "fuel_type", "load_capacity",
      "width", "length", "height", "container_types",
      "has_trailer", "trailer_plate_number", "trailer_plate_province",
    ]) {
      const val = extras.vehicle[key];
      if (val !== null && val !== undefined && val !== "") {
        merged[key] = val;
      }
    }
  }

  return merged as T;
}
