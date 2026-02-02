import { Preferences } from "@capacitor/preferences";

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
 * - Always read from Preferences first, then fallback to localStorage.
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

  const chosen =
    normalizedPref && normalizedPref !== "" ? normalizedPref :
    normalizedLs && normalizedLs !== "" ? normalizedLs :
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
