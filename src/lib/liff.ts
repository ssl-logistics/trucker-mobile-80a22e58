import liff from '@line/liff';

// LIFF ID for the Trucker Mobile app
// Public configuration — safe to ship in client bundle
export const LIFF_ID = (import.meta.env.VITE_LIFF_ID as string) || '2008888039-QDarSMmW';

let initPromise: Promise<void> | null = null;

const getLiffRedirectUri = () => {
  const { origin, pathname, hash } = window.location;
  const route = hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '/';
  return `${origin}${pathname}${route === '/' ? '' : hash.split('?')[0]}`;
};

export const getStableLiffRedirectUri = getLiffRedirectUri;

/**
 * True when the app is rendered inside an iframe (e.g. Lovable preview).
 * LINE OAuth sets X-Frame-Options: deny, so login must break out of the frame.
 */
export const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * Initialize LIFF SDK once. Subsequent calls return the same promise.
 */
export const initLiff = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    console.log('[LIFF] Initializing with id:', LIFF_ID);
    await liff.init({
      liffId: LIFF_ID,
      withLoginOnExternalBrowser: false,
    });
    console.log('[LIFF] ✅ Init complete', {
      isLoggedIn: liff.isLoggedIn(),
      isInClient: liff.isInClient(),
      os: liff.getOS?.(),
      redirectUri: getLiffRedirectUri(),
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
    // ⚠️ Do NOT pass a redirectUri unless it EXACTLY matches the LIFF Endpoint URL
    // configured in LINE Developers Console. Mismatched values cause 400 Bad Request
    // on the LINE OAuth callback. Letting LIFF default to the Endpoint URL is safest.
    if (redirectUri) {
      liff.login({ redirectUri });
    } else {
      liff.login();
    }
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
