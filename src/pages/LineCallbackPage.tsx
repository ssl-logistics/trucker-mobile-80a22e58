import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setAuthItem } from '@/utils/authStorage';
import { Loader2 } from 'lucide-react';
import { initLiff, liff } from '@/lib/liff';

const LINE_CALLBACK_BASE_URL = 'https://mobile.the-trucker.com';
const LINE_CALLBACK_PATH = '/auth/line/callback';
const LINE_REDIRECT_URI = `${LINE_CALLBACK_BASE_URL}${LINE_CALLBACK_PATH}`;

// Check if running inside Capacitor native app
const isRunningInCapacitor = () => {
  return !!(window as any).Capacitor?.isNativePlatform?.() || 
         window.location.origin.includes('capacitor://') ||
         window.location.origin.includes('localhost');
};

// Check if this is Safari opened from LINE (not the native app)
const isExternalBrowser = () => {
  // If we're on the published URL in a browser, it's external
  return window.location.origin.includes('thetroob-mobile.lovable.app') && 
         !isRunningInCapacitor();
};

const toBase64Url = (value: string) =>
  btoa(unescape(encodeURIComponent(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const openNativeApp = (primaryUrl: string, fallbackUrl?: string) => {
  try {
    window.location.href = primaryUrl;
  } catch (e) {
    console.error('[LINE Callback] ❌ primary deep link failed:', e);
  }

  if (!fallbackUrl || fallbackUrl === primaryUrl) return;

  window.setTimeout(() => {
    if (document.visibilityState === 'visible') {
      try {
        window.location.href = fallbackUrl;
      } catch (e) {
        console.error('[LINE Callback] ❌ fallback deep link failed:', e);
      }
    }
  }, 650);
};

const LineCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[LINE Callback] 🔄 Starting callback handler');
      console.log('[LINE Callback] Full URL:', window.location.href);
      console.log('[LINE Callback] Search params:', Object.fromEntries(searchParams.entries()));

      // Persist last callback info for debugging (so we can inspect even if we redirect away)
      try {
        localStorage.setItem('line_last_callback_url', window.location.href);
        localStorage.setItem('line_last_callback_params', JSON.stringify(Object.fromEntries(searchParams.entries())));
      } catch (e) {
        console.warn('[LINE Callback] Could not persist debug info', e);
      }
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // ============= 🔍 DETAILED DETECTION LOGS =============
      const ua = navigator.userAgent || '';
      const isAndroid = /android/i.test(ua);
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      const hasAppPrefix = state?.startsWith('thetroob_');
      const savedStateLocal = localStorage.getItem('line_oauth_state');
      const savedStateSession = sessionStorage.getItem('line_oauth_state');
      const wasInitiatedByApp = savedStateLocal?.startsWith('thetroob_') || savedStateSession?.startsWith('thetroob_');

      console.log('[LINE Callback] 🔍 ============ DETECTION INFO ============');
      console.log('[LINE Callback] 🔍 User Agent:', ua);
      console.log('[LINE Callback] 🔍 isAndroid:', isAndroid, '| isIOS:', isIOS);
      console.log('[LINE Callback] 🔍 isNative (Capacitor):', isNative);
      console.log('[LINE Callback] 🔍 window.location.origin:', window.location.origin);
      console.log('[LINE Callback] 🔍 window.location.href:', window.location.href);
      console.log('[LINE Callback] 🔍 state from URL:', state);
      console.log('[LINE Callback] 🔍 hasAppPrefix (state starts with thetroob_):', hasAppPrefix);
      console.log('[LINE Callback] 🔍 savedStateLocal:', savedStateLocal);
      console.log('[LINE Callback] 🔍 savedStateSession:', savedStateSession);
      console.log('[LINE Callback] 🔍 wasInitiatedByApp (saved state has prefix):', wasInitiatedByApp);
      console.log('[LINE Callback] 🔍 ==========================================');

      // ⚡ CRITICAL: If we have a `thetroob_` state prefix OR the local storage shows that the
      // OAuth was initiated by the native app, hand control back to the native app via deep link.
      // Otherwise the user ends up logged into the web version.
      const shouldRedirectToApp = !isNative && (hasAppPrefix || wasInitiatedByApp) && (code || error);

      console.log('[LINE Callback] 🎯 shouldRedirectToApp:', shouldRedirectToApp);

      if (shouldRedirectToApp) {
        const search = window.location.search || '';
        const payload = toBase64Url(JSON.stringify({ code, state, error, error_description: errorDescription }));
        const payloadSchemeUrl = `thetroob://line-callback/payload/${payload}`;
        // Android intent URL — use a path payload instead of query params because some
        // Android in-app browsers/custom-tab handoffs collapse `thetroob://line-callback?code=...`
        // down to `thetroob://line-callback`, which makes the params disappear before the app sees them.
        const intentUrl = `intent://line-callback/payload/${payload}#Intent;scheme=thetroob;package=com.thetroob.mobile;S.browser_fallback_url=${encodeURIComponent(`${window.location.origin}/#/auth/line/callback${search}`)};end`;
        const deepLink = isAndroid ? intentUrl : payloadSchemeUrl;

        console.log('[LINE Callback] 🔗 ========== REDIRECTING TO APP ==========');
        console.log('[LINE Callback] 🔗 Platform:', isAndroid ? 'Android' : isIOS ? 'iOS' : 'Other');
        console.log('[LINE Callback] 🔗 Deep link URL:', deepLink);
        console.log('[LINE Callback] 🔗 ==========================================');

        // Try to return to the native app silently. If the browser stays visible,
        // continue the login in this web view instead of showing the stuck
        // "tap to return to app" interstitial page.
        openNativeApp(deepLink, payloadSchemeUrl);
        await new Promise((resolve) => window.setTimeout(resolve, 1200));

        if (document.visibilityState !== 'visible') {
          console.log('[LINE Callback] ✅ Native app appears to have opened; stopping web fallback');
          return;
        }

        console.log('[LINE Callback] ⚠️ Native app did not open; continuing login on web without interstitial');
      } else {
        console.log('[LINE Callback] ⚠️ NOT redirecting to app. Reason:');
        if (isNative) console.log('[LINE Callback] ⚠️   - Already running in native (Capacitor)');
        if (!hasAppPrefix && !wasInitiatedByApp) {
          console.log('[LINE Callback] ⚠️   - No app prefix in state AND no app prefix in saved state');
          console.log('[LINE Callback] ⚠️   - This means the OAuth was initiated from the web, not the app');
        }
        if (!code && !error) console.log('[LINE Callback] ⚠️   - No code or error in URL');
      }


      console.log('[LINE Callback] Parsed params:', { 
        code: code ? `${code.substring(0, 20)}...` : null, 
        state, 
        error, 
        errorDescription 
      });

      // Check for errors from LINE
      if (error) {
        console.error('[LINE Callback] ❌ Error from LINE:', { error, errorDescription });
        setStatus('error');
        setErrorMessage(errorDescription || 'LINE login was cancelled or failed');
        toast({
          variant: 'destructive',
          title: 'เกิดข้อผิดพลาด',
          description: errorDescription || 'การเข้าสู่ระบบ LINE ถูกยกเลิก',
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // ============= 🟢 LIFF FLOW =============
      // Detect LIFF callback. LIFF appends `liffClientId` / `liffRedirectUri` query params
      // when it redirects back from LINE OAuth. In that case, even though there is a `code`
      // in the URL, it belongs to LIFF's internal flow (not our app-initiated OIDC flow),
      // so we must NOT try to exchange it ourselves and must NOT validate `line_oauth_state`
      // (we never set it). Instead we let LIFF handle the token and call line-auth with the
      // resulting access token.
      const liffClientId = searchParams.get('liffClientId');
      const liffRedirectUri = searchParams.get('liffRedirectUri');
      const isLiffCallback = !!liffClientId || !!liffRedirectUri;
      // Also treat as LIFF callback when there is a code/state but we did NOT initiate the
      // OIDC flow ourselves (no saved state and no thetroob_ prefix). This covers cases where
      // LIFF strips its own params before we read them.
      const isUnattributedCallback = !!code && !savedStateLocal && !savedStateSession && !hasAppPrefix;

      if ((!code && !error) || isLiffCallback || isUnattributedCallback) {
        console.log('[LINE Callback] 🟢 LIFF callback detected', { isLiffCallback, isUnattributedCallback, hasCode: !!code });
        console.log('[LINE Callback] 🟢 No code/error in URL → trying LIFF flow');
        try {
          await initLiff();
          console.log('[LINE Callback] 🟢 LIFF init OK. isLoggedIn=', liff.isLoggedIn(), 'isInClient=', liff.isInClient());

          if (!liff.isLoggedIn()) {
            // LIFF will redirect back to this same Endpoint URL after login
            liff.login();
            return;
          }

          const accessToken = liff.getAccessToken();
          if (!accessToken) throw new Error('LIFF access token is empty');

          console.log('[LINE Callback] 🟢 Got LIFF access token, calling line-auth...');
          const { data: liffData, error: liffFnError } = await supabase.functions.invoke('line-auth', {
            body: { accessToken },
          });

          if (liffFnError) throw new Error(liffFnError.message);
          if (liffData?.error) throw new Error(liffData.error);

          console.log('[LINE Callback] 🟢 LIFF auth success:', liffData?.user?.displayName);

          // Persist auth + navigate (mirrors the OIDC success path below, simplified)
          await setAuthItem('line_user', JSON.stringify(liffData.user));
          await setAuthItem('auth_login_type', 'line');

          // Try to create/link account (non-blocking)
          let driverUserId = liffData.user.lineUserId;
          try {
            const { data: accountData } = await supabase.functions.invoke('create-account', {
              body: {
                authProvider: 'line',
                lineUserId: liffData.user.lineUserId,
                firstName: liffData.user.displayName?.split(' ')[0] || 'LINE',
                lastName: liffData.user.displayName?.split(' ').slice(1).join(' ') || 'User',
                phone: '0000000000',
                email: liffData.user.email || '',
                avatarUrl: liffData.user.pictureUrl || '',
              },
            });
            if (accountData?.userId) driverUserId = accountData.userId;
          } catch (e) {
            console.warn('[LINE Callback] LIFF create-account non-blocking error:', e);
          }

          const lineDriver = {
            id: driverUserId,
            full_name: liffData.user.displayName,
            avatar_url: liffData.user.pictureUrl || null,
            loginType: 'line',
            lineUser: liffData.user,
          };
          await setAuthItem('auth_driver', JSON.stringify(lineDriver));
          await setAuthItem('auth_driver_id', driverUserId);
          await setAuthItem('auth_user_type', 'freelance_driver');
          await setAuthItem('user_role', 'freelance');

          setStatus('success');
          toast({
            title: 'เข้าสู่ระบบสำเร็จ',
            description: `ยินดีต้อนรับ ${liffData.user.displayName}`,
          });
          window.dispatchEvent(new CustomEvent('auth_driver_updated', {
            detail: { driver: lineDriver, userType: 'freelance_driver', role: 'freelance' },
          }));
          navigate('/home', { replace: true });
          return;
        } catch (liffErr: any) {
          console.error('[LINE Callback] ❌ LIFF flow error:', liffErr);
          setStatus('error');
          setErrorMessage(liffErr.message || 'LIFF login failed');
          toast({
            variant: 'destructive',
            title: 'เกิดข้อผิดพลาด',
            description: liffErr.message || 'ไม่สามารถเข้าสู่ระบบได้',
          });
          setTimeout(() => navigate('/'), 3000);
          return;
        }
      }

      if (!code) {
        console.error('[LINE Callback] ❌ No authorization code received');
        setStatus('error');
        setErrorMessage('No authorization code received');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Verify state to prevent CSRF (savedStateSession/savedStateLocal already declared above)
      
      // Check if state matches stored value OR has our app prefix (for cross-browser iOS flow)
      // On iOS: native app stores state, but callback opens in Safari with different storage
      const stateMatch = (state && savedStateSession && state === savedStateSession) || 
                         (state && savedStateLocal && state === savedStateLocal) ||
                         hasAppPrefix; // Trust state if it has our app prefix (iOS cross-browser case)

      console.log('[LINE Callback] State verification:', {
        received: state,
        savedSession: savedStateSession,
        savedLocal: savedStateLocal,
        hasAppPrefix: hasAppPrefix,
        match: stateMatch,
      });

      if (!stateMatch) {
        console.error('[LINE Callback] ❌ State mismatch - CSRF protection triggered');
        setStatus('error');
        setErrorMessage('Invalid state parameter (state mismatch)');
        toast({
          variant: 'destructive',
          title: 'เกิดข้อผิดพลาด',
          description: 'State ไม่ตรงกัน (ลองกดเข้าสู่ระบบ LINE ใหม่อีกครั้ง)',
        });
        setTimeout(() => navigate('/'), 6000);
        return;
      }

      try {
        // Get the redirect URI that was used (must match exactly what was sent to LINE)
        // NOTE: Must NOT include a "#" fragment for LINE.
        // IMPORTANT: For iOS native app, window.location.origin is "capacitor://localhost"
        // which LINE does not accept. Use production URL to match what was sent.
        const isCapacitor = window.location.origin.includes('capacitor://') || 
                            window.location.origin.includes('localhost');
        const redirectUri = LINE_REDIRECT_URI;
        console.log('[LINE Callback] 📡 Calling line-auth edge function with redirectUri:', redirectUri);
        console.log('[LINE Callback] 📡 isCapacitor:', isCapacitor, 'originalOrigin:', window.location.origin);

        // Call edge function to exchange code for token
        const { data, error: fnError } = await supabase.functions.invoke('line-auth', {
          body: { code, redirectUri },
        });

        console.log('[LINE Callback] Edge function response:', { 
          data: data ? { 
            hasUser: !!data.user,
            user: data.user ? {
              lineUserId: data.user.lineUserId,
              displayName: data.user.displayName,
              hasPicture: !!data.user.pictureUrl,
            } : null,
            hasError: !!data.error,
            error: data.error,
          } : null, 
          fnError 
        });

        if (fnError) {
          console.error('[LINE Callback] ❌ Edge function error:', fnError);
          throw new Error(fnError.message);
        }

        if (data.error) {
          console.error('[LINE Callback] ❌ API error:', data.error);
          throw new Error(data.error);
        }

        console.log('[LINE Callback] ✅ LINE user data received (FULL):', JSON.stringify(data.user, null, 2));
        console.log('[LINE Callback] 📋 User Details:', {
          lineUserId: data.user.lineUserId,
          displayName: data.user.displayName,
          pictureUrl: data.user.pictureUrl || 'NO PICTURE',
          statusMessage: data.user.statusMessage || 'NO STATUS',
          email: data.user.email || 'NO EMAIL',
        });

        // Check if we're in external browser (Safari opened from iOS app)
        // If so, redirect back to native app with user data
        if (isExternalBrowser()) {
          console.log('[LINE Callback] 📱 Detected external browser - redirecting to native app');
          const userData = {
            lineUserId: data.user.lineUserId,
            displayName: data.user.displayName,
            pictureUrl: data.user.pictureUrl || '',
            statusMessage: data.user.statusMessage || '',
          };
          const encodedData = encodeURIComponent(btoa(JSON.stringify(userData)));
          const lineSuccessUrl = `thetroob://line-auth-success?data=${encodedData}`;
          console.log('[LINE Callback] 🔗 Deep link URL:', lineSuccessUrl);
          openNativeApp(lineSuccessUrl);
          await new Promise((resolve) => window.setTimeout(resolve, 800));
        }

        // Normal flow (running inside Capacitor or web)
        let lineDriverForAuth: Record<string, any> | null = null;

        // Auto-create account in database if not exists
        console.log('[LINE Callback] 📝 Creating/linking account via create-account...');
        try {
          const { data: accountData, error: accountError } = await supabase.functions.invoke('create-account', {
            body: {
              authProvider: 'line',
              lineUserId: data.user.lineUserId,
              firstName: data.user.displayName?.split(' ')[0] || data.user.displayName || 'LINE',
              lastName: data.user.displayName?.split(' ').slice(1).join(' ') || 'User',
              phone: '0000000000', // Placeholder - user can update later
              email: data.user.email || '',
              avatarUrl: data.user.pictureUrl || '',
            },
          });

          if (accountError) {
            console.warn('[LINE Callback] ⚠️ Account creation warning:', accountError.message);
          } else if (accountData?.status === 'error') {
            console.warn('[LINE Callback] ⚠️ Account creation API error:', accountData.message, accountData.details);
          } else {
            console.log('[LINE Callback] ✅ Account created/found, userId:', accountData?.userId);
          }

          // Use the Supabase userId if available, otherwise fall back to LINE userId
          const driverUserId = accountData?.userId || data.user.lineUserId;

          // Register driver in external TMS (minimal body for LINE OAuth)
          console.log('[LINE Callback] 📝 Registering driver in external TMS...');
          try {
            const registerBody: Record<string, string> = {
              authProvider: 'line',
              authUserId: driverUserId,
            };
            // Include LINE profile data if available
            if (data.user.displayName) {
              const nameParts = data.user.displayName.split(' ');
              registerBody.firstName = nameParts[0] || 'LINE';
              registerBody.lastName = nameParts.slice(1).join(' ') || 'User';
            }

            const { data: registerData, error: registerError } = await supabase.functions.invoke('register-driver', {
              body: registerBody,
            });

            if (registerError) {
              console.warn('[LINE Callback] ⚠️ External registration warning:', registerError.message);
            } else {
              console.log('[LINE Callback] ✅ External TMS registration result:', registerData);
            }

            // Extract real driver data from TMS registration response
            const regDriverData = registerData?.data || registerData;
            if (regDriverData && regDriverData.id) {
              console.log('[LINE Callback] ✅ Got real driver data from TMS:', regDriverData);
              // Store TMS data to use when building auth_driver below
              (window as any).__lineRegDriverData = regDriverData;
            }
          } catch (regErr) {
            console.warn('[LINE Callback] ⚠️ External registration failed (non-blocking):', regErr);
          }

          // Store LINE user data and login type
          console.log('[LINE Callback] 💾 Saving auth data to storage...');
          
          const lineUserJson = JSON.stringify(data.user);
          await setAuthItem('line_user', lineUserJson);
          await setAuthItem('auth_login_type', 'line');
          
          sessionStorage.removeItem('line_oauth_state');
          localStorage.removeItem('line_oauth_state');

          // Create a driver record - prefer real TMS data over LINE profile data
          const tmsData = (window as any).__lineRegDriverData;
          delete (window as any).__lineRegDriverData;

          const tmsFullName = tmsData
            ? `${tmsData.firstName || ''} ${tmsData.lastName || ''}`.trim()
            : '';

          const lineDriver: Record<string, any> = {
            // Spread all TMS data first (includes vehicle info, bank details, etc.)
            ...(tmsData && typeof tmsData === 'object' ? tmsData : {}),
            // Override with correct app-level fields
            id: tmsData?.id || driverUserId,
            full_name: tmsFullName || data.user.displayName,
            avatar_url: data.user.pictureUrl || tmsData?.avatar_url || null,
            phone_number: tmsData?.phone || '',
            email: tmsData?.email || '',
            username: tmsData?.driverCode || '',
            loginType: 'line',
            lineUser: data.user,
          };
          lineDriverForAuth = lineDriver;
          
          await setAuthItem('auth_driver', JSON.stringify(lineDriver));
          await setAuthItem('auth_driver_id', driverUserId);
          await setAuthItem('auth_user_type', 'freelance_driver');
          await setAuthItem('user_role', 'freelance');
          console.log('[LINE Callback] ✅ Auth data saved, driverId:', driverUserId);

        } catch (accountErr) {
          console.warn('[LINE Callback] ⚠️ Account creation failed (non-blocking):', accountErr);
          
          // Fall back to original flow - save with LINE userId
          const lineUserJson = JSON.stringify(data.user);
          await setAuthItem('line_user', lineUserJson);
          await setAuthItem('auth_login_type', 'line');
          sessionStorage.removeItem('line_oauth_state');
          localStorage.removeItem('line_oauth_state');
          
          const lineDriver = {
            id: data.user.lineUserId,
            full_name: data.user.displayName,
            avatar_url: data.user.pictureUrl || null,
            loginType: 'line',
            lineUser: data.user,
          };
          lineDriverForAuth = lineDriver;
          await setAuthItem('auth_driver', JSON.stringify(lineDriver));
          await setAuthItem('auth_driver_id', data.user.lineUserId);
          await setAuthItem('auth_user_type', 'freelance_driver');
          await setAuthItem('user_role', 'freelance');
        }

        // ✅ Login complete — navigate directly into the app (no confirmation modal)
        setStatus('success');

        toast({
          title: 'เข้าสู่ระบบสำเร็จ',
          description: `ยินดีต้อนรับ ${data.user.displayName}`,
        });

        console.log('[LINE Callback] 🎉 LOGIN COMPLETE — navigating into app');

        // Dispatch auth event so AuthContext picks up the new session
        if (lineDriverForAuth) {
          window.dispatchEvent(new CustomEvent('auth_driver_updated', {
            detail: { driver: lineDriverForAuth, userType: 'freelance_driver', role: 'freelance' },
          }));
        } else {
          window.dispatchEvent(new Event('auth_driver_updated'));
        }

        // Navigate to saved redirect path or home
        const redirectPath = sessionStorage.getItem('auth_redirect_after_login');
        sessionStorage.removeItem('auth_redirect_after_login');

        if (redirectPath && redirectPath !== '/' && redirectPath !== '/home') {
          console.log('[LINE Callback] 🚀 Navigating to saved redirect:', redirectPath);
          navigate(redirectPath, { replace: true });
        } else {
          console.log('[LINE Callback] 🚀 Navigating to /home...');
          navigate('/home', { replace: true });
        }

      } catch (err: any) {
        console.error('[LINE Callback] ❌ Exception:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to complete LINE login');
        toast({
          variant: 'destructive',
          title: 'เกิดข้อผิดพลาด',
          description: err.message || 'ไม่สามารถเข้าสู่ระบบได้',
        });
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  // Debug: Log render state
  console.log('[LINE Callback] 🔄 Render - status:', status);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">

      <div className="text-center space-y-4">
        {status === 'loading' ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#00B900]" />
            <p className="text-lg font-medium">กำลังเข้าสู่ระบบ LINE...</p>
            <p className="text-sm text-muted-foreground">กรุณารอสักครู่</p>
          </>
        ) : status === 'success' ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-[#00B900]/10 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-lg font-medium text-[#00B900]">เข้าสู่ระบบสำเร็จ</p>
            <p className="text-sm text-muted-foreground">กำลังแสดงข้อมูลผู้ใช้...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <p className="text-lg font-medium text-destructive">เกิดข้อผิดพลาด</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <p className="text-xs text-muted-foreground">กำลังกลับไปหน้าหลัก...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default LineCallbackPage;
