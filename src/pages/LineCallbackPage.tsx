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

const LineCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [lineUserData, setLineUserData] = useState<LineUserData | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

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
      const stateMatch = (state && savedStateSession && state === savedStateSession) || (state && savedStateLocal && state === savedStateLocal);

      console.log('[LINE Callback] State verification:', {
        received: state,
        savedSession: savedStateSession,
        savedLocal: savedStateLocal,
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
        const redirectUri = `${window.location.origin}/auth/line/callback`;
        console.log('[LINE Callback] 📡 Calling line-auth edge function with redirectUri:', redirectUri);

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

        // Store LINE user data and login type (persistent across app restarts)
        console.log('[LINE Callback] 💾 Saving auth data to storage...');
        
        const lineUserJson = JSON.stringify(data.user);
        console.log('[LINE Callback] 💾 line_user JSON:', lineUserJson);
        
        await setAuthItem('line_user', lineUserJson);
        console.log('[LINE Callback] ✅ line_user saved');
        
        await setAuthItem('auth_login_type', 'line');
        console.log('[LINE Callback] ✅ auth_login_type saved');
        
        sessionStorage.removeItem('line_oauth_state');
        localStorage.removeItem('line_oauth_state');
        console.log('[LINE Callback] ✅ line_oauth_state removed from sessionStorage & localStorage');

        // Create a driver record for LINE user
        const lineDriver = {
          id: data.user.lineUserId,
          full_name: data.user.displayName,
          avatar_url: data.user.pictureUrl || null,
          loginType: 'line',
          lineUser: data.user,
        };
        console.log('[LINE Callback] 💾 Driver object created:', JSON.stringify(lineDriver, null, 2));
        
        const driverJson = JSON.stringify(lineDriver);
        console.log('[LINE Callback] 💾 auth_driver JSON:', driverJson);
        
        await setAuthItem('auth_driver', driverJson);
        console.log('[LINE Callback] ✅ auth_driver saved successfully');

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
