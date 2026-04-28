import liff from '@line/liff';

// LIFF ID for the Trucker Mobile app
// Public configuration — safe to ship in client bundle
export const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '2008888039-QDarSMmW';

let initPromise: Promise<void> | null = null;

/**
 * Initialize LIFF SDK once. Subsequent calls return the same promise.
 */
export const initLiff = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    console.log('[LIFF] Initializing with id:', LIFF_ID);
    await liff.init({ liffId: LIFF_ID });
    console.log('[LIFF] ✅ Init complete', {
      isLoggedIn: liff.isLoggedIn(),
      isInClient: liff.isInClient(),
      os: liff.getOS?.(),
    });
  })();
  try {
    await initPromise;
  } catch (e) {
    initPromise = null; // allow retry on failure
    throw e;
  }
  return initPromise;
};

/**
 * Trigger LIFF login (no-op if already logged in).
 * In LINE in-app browser → silent. In external browser → redirects to LINE OAuth.
 */
export const liffLogin = async (redirectUri?: string): Promise<void> => {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login(redirectUri ? { redirectUri } : undefined);
  }
};

/**
 * Get the current LIFF access token (after login).
 */
export const getLiffAccessToken = async (): Promise<string | null> => {
  await initLiff();
  return liff.getAccessToken();
};

/**
 * Get the current LIFF profile (after login).
 */
export const getLiffProfile = async () => {
  await initLiff();
  return liff.getProfile();
};

export const liffLogout = async () => {
  try {
    await initLiff();
    if (liff.isLoggedIn()) liff.logout();
  } catch (e) {
    console.warn('[LIFF] logout error:', e);
  }
};

export { liff };
