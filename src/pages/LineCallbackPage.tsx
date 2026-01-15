import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { setAuthItem } from '@/utils/authStorage';
import { Loader2 } from 'lucide-react';

const LineCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[LINE Callback] 🔄 Starting callback handler');
      console.log('[LINE Callback] Full URL:', window.location.href);
      console.log('[LINE Callback] Search params:', Object.fromEntries(searchParams.entries()));
      
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
      const savedState = sessionStorage.getItem('line_oauth_state');
      console.log('[LINE Callback] State verification:', { received: state, saved: savedState, match: state === savedState });
      
      if (state !== savedState) {
        console.error('[LINE Callback] ❌ State mismatch - CSRF protection triggered');
        setStatus('error');
        setErrorMessage('Invalid state parameter');
        setTimeout(() => navigate('/'), 3000);
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

        console.log('[LINE Callback] ✅ LINE user data received:', {
          lineUserId: data.user.lineUserId,
          displayName: data.user.displayName,
          pictureUrl: data.user.pictureUrl ? 'present' : 'missing',
          statusMessage: data.user.statusMessage,
        });

        // Store LINE user data and login type (persistent across app restarts)
        console.log('[LINE Callback] 💾 Saving auth data to storage...');
        await Promise.all([
          setAuthItem('line_user', JSON.stringify(data.user)),
          setAuthItem('auth_login_type', 'line'),
        ]);
        sessionStorage.removeItem('line_oauth_state');

        // Create a driver record for LINE user
        const lineDriver = {
          id: data.user.lineUserId,
          full_name: data.user.displayName,
          avatar_url: data.user.pictureUrl || null,
          loginType: 'line',
          lineUser: data.user,
        };
        console.log('[LINE Callback] 💾 Saving driver data:', lineDriver);
        await setAuthItem('auth_driver', JSON.stringify(lineDriver));

        // Dispatch event to notify AuthContext
        console.log('[LINE Callback] 📢 Dispatching auth_driver_updated event');
        window.dispatchEvent(new Event('auth_driver_updated'));

        toast({
          title: 'เข้าสู่ระบบสำเร็จ',
          description: `ยินดีต้อนรับ ${data.user.displayName}`,
        });

        console.log('[LINE Callback] ✅ Login complete, navigating to /home');
        // Navigate to home or dashboard
        navigate('/home');

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#00B900]" />
            <p className="text-lg font-medium">กำลังเข้าสู่ระบบ LINE...</p>
            <p className="text-sm text-muted-foreground">กรุณารอสักครู่</p>
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
