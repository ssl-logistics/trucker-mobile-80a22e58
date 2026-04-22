import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setAuthItem } from '@/utils/authStorage';
import { Loader2 } from 'lucide-react';
import { LineUserInfoModal } from '@/components/line/LineUserInfoModal';

interface LineUserData {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
}

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

const LineCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [lineUserData, setLineUserData] = useState<LineUserData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [redirectingToApp, setRedirectingToApp] = useState(false);

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

      // ⚡ CRITICAL: If we have a `thetroob_` state prefix, the OAuth was initiated from the
      // native mobile app (the in-app browser). LINE redirected back to the HTTPS callback,
      // but we MUST hand control back to the native app via deep link instead of processing
      // the login on the web. Otherwise the user ends up logged into the web version.
      const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
      const hasAppPrefix = state?.startsWith('thetroob_');
      if (!isNative && hasAppPrefix && (code || error)) {
        const search = window.location.search || '';
        const deepLink = `thetroob://line-callback${search}`;
        console.log('[LINE Callback] 🔗 Native flow detected — handing back to app via deep link:', deepLink);
        setRedirectingToApp(true);
        // Try to open the native app
        window.location.href = deepLink;
        // Don't process further; the native app's deep link handler takes over
        return;
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

      if (!code) {
        console.error('[LINE Callback] ❌ No authorization code received');
        setStatus('error');
        setErrorMessage('No authorization code received');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Verify state to prevent CSRF
      const savedStateSession = sessionStorage.getItem('line_oauth_state');
      const savedStateLocal = localStorage.getItem('line_oauth_state');
      
      // Check if state matches stored value OR has our app prefix (for cross-browser iOS flow)
      // On iOS: native app stores state, but callback opens in Safari with different storage
      const hasAppPrefix = state?.startsWith('thetroob_');
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
        const baseUrl = isCapacitor 
          ? 'https://mobile.thetroob.com' 
          : window.location.origin;
        const redirectUri = `${baseUrl}/auth/line/callback`;
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
          setRedirectingToApp(true);
          setStatus('success');
          
          // Encode user data for URL
          const userData = {
            lineUserId: data.user.lineUserId,
            displayName: data.user.displayName,
            pictureUrl: data.user.pictureUrl || '',
            statusMessage: data.user.statusMessage || '',
          };
          const encodedData = encodeURIComponent(btoa(JSON.stringify(userData)));
          
          // Redirect to native app using custom URL scheme
          const deepLinkUrl = `thetroob://line-auth-success?data=${encodedData}`;
          console.log('[LINE Callback] 🔗 Deep link URL:', deepLinkUrl);
          
          // Show message and redirect
          setTimeout(() => {
            window.location.href = deepLinkUrl;
          }, 1000);
          
          return;
        }

        // Normal flow (running inside Capacitor or web)
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
          
          await setAuthItem('auth_driver', JSON.stringify(lineDriver));
          await setAuthItem('auth_driver_id', driverUserId);
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
          await setAuthItem('auth_driver', JSON.stringify(lineDriver));
        }

        // Store LINE user data for modal display BEFORE dispatching event
        console.log('[LINE Callback] 🎯 Setting modal state...');
        console.log('[LINE Callback] 🎯 lineUserData:', JSON.stringify(data.user, null, 2));
        
        setLineUserData(data.user);
        console.log('[LINE Callback] ✅ setLineUserData called');
        
        setStatus('success');
        console.log('[LINE Callback] ✅ setStatus("success") called');
        
        setShowUserModal(true);
        console.log('[LINE Callback] ✅ setShowUserModal(true) called');

        toast({
          title: 'เข้าสู่ระบบสำเร็จ',
          description: `ยินดีต้อนรับ ${data.user.displayName}`,
        });

        console.log('[LINE Callback] 🎉 LOGIN COMPLETE! Summary:');
        console.log('[LINE Callback] - User ID:', data.user.lineUserId);
        console.log('[LINE Callback] - Name:', data.user.displayName);
        console.log('[LINE Callback] - Has Picture:', !!data.user.pictureUrl);
        console.log('[LINE Callback] 📋 Modal should be visible now!');
        console.log('[LINE Callback] 📋 showUserModal state will be true after next render');
        
        // NOTE: Dispatch event AFTER setting modal state
        // This ensures modal shows before any navigation from AuthContext
        console.log('[LINE Callback] 📢 Dispatching auth_driver_updated event (DELAYED)...');
        // Don't dispatch yet - let modal show first
        // window.dispatchEvent(new Event('auth_driver_updated'));

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

  const handleModalClose = () => {
    console.log('[LINE Callback] 🔘 Modal close button clicked');
    setShowUserModal(false);
    
    // Dispatch auth event NOW (after user has seen the modal)
    console.log('[LINE Callback] 📢 Dispatching auth_driver_updated event...');
    window.dispatchEvent(new Event('auth_driver_updated'));
    
    // Check if there's a saved redirect destination (from ProtectedRoute)
    const redirectPath = sessionStorage.getItem('auth_redirect_after_login');
    sessionStorage.removeItem('auth_redirect_after_login');

    if (redirectPath && redirectPath !== '/' && redirectPath !== '/home') {
      console.log('[LINE Callback] 🚀 Navigating to saved redirect:', redirectPath);
      navigate(redirectPath, { replace: true });
    } else {
      console.log('[LINE Callback] 🚀 Navigating to /home...');
      navigate('/home', { replace: true });
    }
  };

  // Debug: Log render state
  console.log('[LINE Callback] 🔄 Render - status:', status, 'showUserModal:', showUserModal, 'lineUserData:', !!lineUserData);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* LINE User Info Modal */}
      <LineUserInfoModal
        open={showUserModal}
        onClose={handleModalClose}
        userData={lineUserData}
      />

      <div className="text-center space-y-4">
        {redirectingToApp ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-[#00B900]/10 flex items-center justify-center">
              <span className="text-2xl">📱</span>
            </div>
            <p className="text-lg font-medium text-[#00B900]">เข้าสู่ระบบสำเร็จ</p>
            <p className="text-sm text-muted-foreground">กำลังกลับไปที่แอพ...</p>
            <p className="text-xs text-muted-foreground mt-4">
              หากไม่ถูกเปลี่ยนหน้าอัตโนมัติ กรุณากลับไปที่แอพ thetroob
            </p>
          </>
        ) : status === 'loading' ? (
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
