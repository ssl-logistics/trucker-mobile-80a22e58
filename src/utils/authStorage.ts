import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const AUTH_KEYS = [
  "auth_driver",
  "auth_user_type",
  "user_role",
  "auth_driver_id",
  "auth_login_type",
  "line_user",
] as const;

export type AuthKey = (typeof AUTH_KEYS)[number];

export async function getAuthItem(key: AuthKey): Promise<string | null> {
  // Prefer localStorage when available (web + native)
  const lsValue = localStorage.getItem(key);
  if (lsValue !== null && lsValue !== "") return lsValue;

  // Fallback to native persisted storage
  if (!Capacitor.isNativePlatform()) return lsValue;

  try {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch {
    return lsValue;
  }
}

export async function setAuthItem(key: AuthKey, value: string): Promise<void> {
  localStorage.setItem(key, value);

  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value });
  }
}

export async function removeAuthItem(key: AuthKey): Promise<void> {
  localStorage.removeItem(key);

  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key });
  }
}

/**
 * On native builds, ensure values already in localStorage are copied into
 * Preferences so they survive OS-kill / swipe-away more reliably (iOS).
 */
export async function syncAuthFromLocalStorageToNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.all(
    AUTH_KEYS.map(async (key) => {
      const lsValue = localStorage.getItem(key);
      if (lsValue === null || lsValue === "") return;

      const { value } = await Preferences.get({ key });
      if (!value) {
        await Preferences.set({ key, value: lsValue });
      }
    })
  );
}
