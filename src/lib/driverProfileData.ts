import { supabase } from "@/integrations/supabase/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/driver-profile-data`;
const HEADERS = {
  "Content-Type": "application/json",
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

const isLineUserId = (id?: string | null): id is string => !!id && /^U[a-z0-9]{20,}$/i.test(id);
const LINE_USER_ID_KEY = "line_user_id_map";

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

const readLineUserIdMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(LINE_USER_ID_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLineUserIdMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem(LINE_USER_ID_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
};

export const rememberLineUserDriverId = (lineUserId?: string | null, driverId?: string | null) => {
  if (!isLineUserId(lineUserId) || !isUuid(driverId)) return;
  const map = readLineUserIdMap();
  map[lineUserId] = driverId;
  writeLineUserIdMap(map);
};

export const getRememberedLineDriverId = (lineUserId?: string | null) => {
  if (!isLineUserId(lineUserId)) return null;
  const driverId = readLineUserIdMap()[lineUserId];
  return isUuid(driverId) ? driverId : null;
};

export const resolvePersistedDriverId = (driverId?: string | null, lineUserId?: string | null) => {
  if (isUuid(driverId)) return driverId;
  return getRememberedLineDriverId(lineUserId || driverId) || null;
};

const getStoredLineUser = (): Record<string, any> | null => {
  try {
    const raw = localStorage.getItem("line_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const ensurePersistedDriverId = async (driverId?: string | null, lineUserId?: string | null) => {
  const resolvedDriverId = resolvePersistedDriverId(driverId, lineUserId);
  if (resolvedDriverId) return resolvedDriverId;

  const candidateLineUserId = isLineUserId(lineUserId) ? lineUserId : isLineUserId(driverId) ? driverId : null;
  if (!candidateLineUserId) return null;

  const lineUser = getStoredLineUser();
  const displayName = typeof lineUser?.displayName === "string" ? lineUser.displayName : "LINE User";

  try {
    const { data, error } = await supabase.functions.invoke("create-account", {
      body: {
        authProvider: "line",
        lineUserId: candidateLineUserId,
        firstName: displayName.split(" ")[0] || "LINE",
        lastName: displayName.split(" ").slice(1).join(" ") || "User",
        phone: "0000000000",
        email: typeof lineUser?.email === "string" ? lineUser.email : "",
        avatarUrl: typeof lineUser?.pictureUrl === "string" ? lineUser.pictureUrl : "",
      },
    });

    if (!error && isUuid(data?.userId)) {
      rememberLineUserDriverId(candidateLineUserId, data.userId);
      return data.userId;
    }
  } catch (e) {
    console.warn("[driver-profile-data] LINE driver id resolve failed:", e);
  }

  return null;
};

export async function fetchDriverProfileData(driverId?: string | null): Promise<{
  bank: Record<string, any> | null;
  vehicle: Record<string, any> | null;
} | null> {
  const resolvedDriverId = await ensurePersistedDriverId(driverId);
  if (!resolvedDriverId) return null;
  try {
    const res = await fetch(`${FN_URL}?driver_id=${resolvedDriverId}`, { headers: HEADERS });
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
  const resolvedDriverId = await ensurePersistedDriverId(driverId);
  if (!resolvedDriverId) return false;
  try {
    const res = await fetch(FN_URL, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ driver_id: resolvedDriverId, bank }),
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
  const resolvedDriverId = await ensurePersistedDriverId(driverId);
  if (!resolvedDriverId) return false;
  try {
    const res = await fetch(FN_URL, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ driver_id: resolvedDriverId, vehicle }),
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
