import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const LineCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for errors from LINE
      if (error) {
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
        setStatus('error');
        setErrorMessage('No authorization code received');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Verify state to prevent CSRF
      const savedState = sessionStorage.getItem('line_oauth_state');
      if (state !== savedState) {
        setStatus('error');
        setErrorMessage('Invalid state parameter');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Get the redirect URI that was used (must match exactly what was sent to LINE)
        // NOTE: Must NOT include a "#" fragment for LINE.
        const redirectUri = `${window.location.origin}/auth/line/callback`;

        // Call edge function to exchange code for token
        const { data, error: fnError } = await supabase.functions.invoke('line-auth', {
          body: { code, redirectUri },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Store LINE user data and login type in localStorage (persistent across app restarts)
        localStorage.setItem('line_user', JSON.stringify(data.user));
        localStorage.setItem('auth_login_type', 'line');
        sessionStorage.removeItem('line_oauth_state');

        // Create a driver record for LINE user
        const lineDriver = {
          id: data.user.lineUserId,
          full_name: data.user.displayName,
          avatar_url: data.user.pictureUrl || null,
          loginType: 'line',
          lineUser: data.user,
        };
        localStorage.setItem('auth_driver', JSON.stringify(lineDriver));

        // Dispatch event to notify AuthContext
        window.dispatchEvent(new Event('auth_driver_updated'));

        toast({
          title: 'เข้าสู่ระบบสำเร็จ',
          description: `ยินดีต้อนรับ ${data.user.displayName}`,
        });

        // Navigate to home or dashboard
        navigate('/home');

      } catch (err: any) {
        console.error('LINE callback error:', err);
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
