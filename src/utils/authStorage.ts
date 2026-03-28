import { Preferences } from "@capacitor/preferences";

const FIRST_RUN_MARKER = "auth_first_run";

export const AUTH_KEYS = [
  "auth_driver",
  "auth_user_type",
  "user_role",
  "auth_driver_id",
  "auth_login_type",
  "line_user",
  "auth_api_key",
  "auth_employer_type",
] as const;

export type AuthKey = (typeof AUTH_KEYS)[number];

async function prefGet(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

async function prefSet(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

async function prefRemove(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
}

/**
 * Storage strategy (especially for iOS/Android):
 * - Always read from localStorage first, then fallback to Preferences.
 * - Always write to BOTH stores (best-effort) to keep them in sync.
 * - When we find a value in one store, mirror it to the other store.
 */
export async function getAuthItem(key: AuthKey): Promise<string | null> {
  const [prefValue, lsValue] = await Promise.all([
    prefGet(key),
    Promise.resolve(localStorage.getItem(key)),
  ]);

  const normalizedPref = prefValue ?? null;
  const normalizedLs = lsValue ?? null;

  // localStorage is the source of truth for immediate same-session UI updates.
  // This avoids stale native Preference values overriding newly edited data.
  const chosen =
    normalizedLs && normalizedLs !== "" ? normalizedLs :
    normalizedPref && normalizedPref !== "" ? normalizedPref :
    null;

  if (!chosen) return null;

  // Mirror to keep consistent across restarts.
  if (normalizedLs !== chosen) {
    try {
      localStorage.setItem(key, chosen);
    } catch {
      // ignore
    }
  }

  if (normalizedPref !== chosen) {
    await prefSet(key, chosen);
  }

  return chosen;
}

export async function setAuthItem(key: AuthKey, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }

  await prefSet(key, value);
}

export async function removeAuthItem(key: AuthKey): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }

  await prefRemove(key);
}

/**
 * Keep a best-effort sync between both stores (useful after upgrades).
 */
export async function syncAuthFromLocalStorageToNative(): Promise<void> {
  await Promise.all(
    AUTH_KEYS.map(async (key) => {
      // getAuthItem already mirrors whichever store has the value.
      await getAuthItem(key);
    })
  );
}

/**
 * Check if this is the first run after install.
 * If no marker exists, clear all auth keys and write the marker.
 * This prevents stale credentials from persisting after app reinstall.
 */
export async function handleFirstRunAfterInstall(): Promise<void> {
  // Check both stores for the marker
  const [prefMarker, lsMarker] = await Promise.all([
    prefGet(FIRST_RUN_MARKER),
    Promise.resolve(localStorage.getItem(FIRST_RUN_MARKER)),
  ]);

  const hasMarker = (prefMarker && prefMarker !== "") || (lsMarker && lsMarker !== "");

  if (!hasMarker) {
    console.log("[Auth] First run detected - clearing stale auth data");
    
    // Clear all auth keys from both stores
    await Promise.all(
      AUTH_KEYS.map(async (key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
        await prefRemove(key);
      })
    );

    // Write the marker to both stores
    const markerValue = Date.now().toString();
    try {
      localStorage.setItem(FIRST_RUN_MARKER, markerValue);
    } catch {
      // ignore
    }
    await prefSet(FIRST_RUN_MARKER, markerValue);
    
    console.log("[Auth] First run marker set");
  }
}
