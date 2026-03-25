import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { setAuthItem } from '@/utils/authStorage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { autoRegisterOAuthUser } from '@/utils/oauthAutoRegister';

interface LineUserData {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export const useDeepLinkHandler = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleDeepLink = async (event: URLOpenListenerEvent) => {
      console.log('[DeepLink] 📱 Received deep link:', event.url);
      
      try {
        const url = new URL(event.url);
        const path = url.host + url.pathname;
        
        console.log('[DeepLink] Path:', path);
        console.log('[DeepLink] Host:', url.host);
        console.log('[DeepLink] Pathname:', url.pathname);
        console.log('[DeepLink] Search params:', url.search);

        // Close the in-app browser if it's open
        try {
          await Browser.close();
          console.log('[DeepLink] 📱 In-app browser closed');
        } catch (e) {
          console.log('[DeepLink] Browser.close not needed or failed:', e);
        }

        // Handle LINE callback with code/state (from LINE app redirect)
        // thetroob://line-callback?code=xxx&state=yyy
        if (url.host === 'line-callback') {
          console.log('[DeepLink] 🔐 LINE callback detected');
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          
          if (code) {
            console.log('[DeepLink] 📡 Exchanging code for token...');
            
            // Call edge function to exchange code for token
            const redirectUri = 'https://mobile.thetroob.com/auth/line/callback';
            const { data, error: fnError } = await supabase.functions.invoke('line-auth', {
              body: { code, redirectUri },
            });
            
            if (fnError || data?.error) {
              console.error('[DeepLink] ❌ LINE auth error:', fnError || data?.error);
              toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถเข้าสู่ระบบ LINE ได้',
              });
              navigate('/', { replace: true });
              return;
            }
            
            console.log('[DeepLink] ✅ LINE user data received:', data.user.displayName);

            // Auto-create account in database
            let driverUserId = data.user.lineUserId;
            try {
              const { data: accountData, error: accountError } = await supabase.functions.invoke('create-account', {
                body: {
                  authProvider: 'line',
                  lineUserId: data.user.lineUserId,
                  firstName: data.user.displayName?.split(' ')[0] || 'LINE',
                  lastName: data.user.displayName?.split(' ').slice(1).join(' ') || 'User',
                  phone: '0000000000',
                  email: '',
                  avatarUrl: data.user.pictureUrl || '',
                },
              });
              if (!accountError && accountData?.userId) {
                driverUserId = accountData.userId;
                console.log('[DeepLink] ✅ Account created/found:', driverUserId);
              }
            } catch (e) {
              console.warn('[DeepLink] ⚠️ Account creation failed (non-blocking):', e);
            }

            // Register driver in external TMS (minimal body)
            try {
              const registerBody: Record<string, string> = {
                authProvider: 'line',
                authUserId: driverUserId,
              };
              if (data.user.displayName) {
                const nameParts = data.user.displayName.split(' ');
                registerBody.firstName = nameParts[0] || 'LINE';
                registerBody.lastName = nameParts.slice(1).join(' ') || 'User';
              }
              const { data: regData, error: regError } = await supabase.functions.invoke('register-driver', {
                body: registerBody,
              });
              if (regError) {
                console.warn('[DeepLink] ⚠️ External registration warning:', regError.message);
              } else {
                console.log('[DeepLink] ✅ External TMS registration:', regData);
              }
            } catch (regErr) {
              console.warn('[DeepLink] ⚠️ External registration failed (non-blocking):', regErr);
            }
            
            // Store LINE user data
            await setAuthItem('line_user', JSON.stringify(data.user));
            await setAuthItem('auth_login_type', 'line');
            
            // Create driver record with resolved userId
            const lineDriver = {
              id: driverUserId,
              full_name: data.user.displayName,
              avatar_url: data.user.pictureUrl || null,
              loginType: 'line',
              lineUser: data.user,
            };
            await setAuthItem('auth_driver', JSON.stringify(lineDriver));
            await setAuthItem('auth_driver_id', driverUserId);
            
            console.log('[DeepLink] ✅ Auth data saved, driverId:', driverUserId);
            
            // Dispatch auth event
            window.dispatchEvent(new Event('auth_driver_updated'));
            
            toast({
              title: 'เข้าสู่ระบบสำเร็จ',
              description: `ยินดีต้อนรับ ${data.user.displayName}`,
            });
            
            // Navigate to home
            navigate('/home', { replace: true });
            return;
          }
        }

        // Handle Apple auth callback (from Safari redirect with tokens)
        // thetroob://apple-auth-callback?access_token=xxx&refresh_token=xxx
        if (url.host === 'apple-auth-callback') {
          console.log('[DeepLink] 🍎 Apple auth callback detected');
          const code = url.searchParams.get('code');
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          
          if (code) {
            try {
              console.log('[DeepLink] 📡 Exchanging Apple auth code for session...');
              const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

              if (exchangeError) {
                console.error('[DeepLink] ❌ Code exchange error:', exchangeError);
                toast({
                  variant: 'destructive',
                  title: 'เกิดข้อผิดพลาด',
                  description: 'ไม่สามารถยืนยันตัวตน Apple ได้: ' + exchangeError.message,
                });
                navigate('/', { replace: true });
                return;
              }

              const user = exchangeData?.user;
              if (!user) {
                toast({
                  variant: 'destructive',
                  title: 'เกิดข้อผิดพลาด',
                  description: 'ไม่พบข้อมูลผู้ใช้จาก Apple',
                });
                navigate('/', { replace: true });
                return;
              }

              const appleDriver = {
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email || 'Apple User',
                avatar_url: user.user_metadata?.avatar_url || null,
                loginType: 'apple',
                email: user.email,
              };

              // Auto-register in DB + external TMS (non-blocking)
              autoRegisterOAuthUser({
                authProvider: 'apple',
                authUserId: user.id,
                firstName: user.user_metadata?.full_name?.split(' ')[0],
                lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' '),
              });

              await Promise.all([
                setAuthItem('auth_driver', JSON.stringify(appleDriver)),
                setAuthItem('auth_driver_id', user.id),
                setAuthItem('auth_login_type', 'apple'),
                setAuthItem('auth_user_type', 'freelance_driver'),
                setAuthItem('user_role', 'freelance'),
              ]);

              window.dispatchEvent(new Event('auth_driver_updated'));
              toast({
                title: 'เข้าสู่ระบบสำเร็จ',
                description: `ยินดีต้อนรับ ${appleDriver.full_name}`,
              });
              navigate('/home', { replace: true });
              return;
            } catch (err) {
              console.error('[DeepLink] ❌ Apple code flow error:', err);
              toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถเข้าสู่ระบบ Apple ได้',
              });
              navigate('/', { replace: true });
              return;
            }
          }

          if (accessToken) {
            try {
              // Close the browser FIRST to return to the app
              try {
                await Browser.close();
                console.log('[DeepLink] 📱 Browser closed after Apple auth');
              } catch (e) {
                console.log('[DeepLink] Browser close skipped:', e);
              }
              
              let user = null;

              if (refreshToken) {
                console.log('[DeepLink] 📡 Setting Supabase session...');
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                
                if (sessionError) {
                  console.error('[DeepLink] ❌ Session error:', sessionError);
                  toast({
                    variant: 'destructive',
                    title: 'เกิดข้อผิดพลาด',
                    description: 'ไม่สามารถเข้าสู่ระบบ Apple ได้: ' + sessionError.message,
                  });
                  navigate('/', { replace: true });
                  return;
                }

                user = sessionData?.user ?? null;
              } else {
                // Some providers/flows may return only access_token without refresh_token.
                // In that case, fetch profile from access token and proceed with app-level auth.
                console.log('[DeepLink] ℹ️ Missing refresh token, resolving user from access token');
                const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

                if (userError || !userData?.user) {
                  console.error('[DeepLink] ❌ getUser error:', userError);
                  toast({
                    variant: 'destructive',
                    title: 'เกิดข้อผิดพลาด',
                    description: 'ไม่สามารถยืนยันตัวตน Apple ได้',
                  });
                  navigate('/', { replace: true });
                  return;
                }

                user = userData.user;
              }
              
              if (!user?.id) {
                toast({
                  variant: 'destructive',
                  title: 'เกิดข้อผิดพลาด',
                  description: 'ไม่พบข้อมูลผู้ใช้จาก Apple',
                });
                navigate('/', { replace: true });
                return;
              }

              console.log('[DeepLink] ✅ Apple auth success, user:', user?.email);
              
              // Store auth data
              const appleDriver = {
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email || 'Apple User',
                avatar_url: user.user_metadata?.avatar_url || null,
                loginType: 'apple',
                email: user.email,
              };

              await Promise.all([
                setAuthItem('auth_driver', JSON.stringify(appleDriver)),
                setAuthItem('auth_driver_id', user.id),
                setAuthItem('auth_login_type', 'apple'),
                setAuthItem('auth_user_type', 'freelance_driver'),
                setAuthItem('user_role', 'freelance'),
              ]);
              
              // Dispatch auth event
              window.dispatchEvent(new Event('auth_driver_updated'));
              
              toast({
                title: 'เข้าสู่ระบบสำเร็จ',
                description: `ยินดีต้อนรับ ${appleDriver.full_name}`,
              });
              
              navigate('/home', { replace: true });
              return;
            } catch (err) {
              console.error('[DeepLink] ❌ Apple auth error:', err);
              toast({
                variant: 'destructive',
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถเข้าสู่ระบบ Apple ได้',
              });
              navigate('/', { replace: true });
              return;
            }
          } else {
            console.error('[DeepLink] ❌ Missing tokens in Apple callback');
            toast({
              variant: 'destructive',
              title: 'เกิดข้อผิดพลาด',
              description: 'ไม่ได้รับ code หรือ token จาก Apple',
            });
            navigate('/', { replace: true });
            return;
          }
        }

        // Handle LINE auth success callback (from Safari redirect with encoded data)
        if (path === 'line-auth-success' || url.host === 'line-auth-success') {
          const encodedData = url.searchParams.get('data');
          
          if (encodedData) {
            console.log('[DeepLink] 🔐 Processing LINE auth data (encoded)');
            
            // Decode and parse user data
            const userData: LineUserData = JSON.parse(atob(decodeURIComponent(encodedData)));
            console.log('[DeepLink] ✅ User data decoded:', userData.displayName);
            
            // Store LINE user data
            await setAuthItem('line_user', JSON.stringify(userData));
            await setAuthItem('auth_login_type', 'line');
            
            // Create driver record
            const lineDriver = {
              id: userData.lineUserId,
              full_name: userData.displayName,
              avatar_url: userData.pictureUrl || null,
              loginType: 'line',
              lineUser: userData,
            };
            await setAuthItem('auth_driver', JSON.stringify(lineDriver));
            
            console.log('[DeepLink] ✅ Auth data saved');
            
            // Dispatch auth event
            window.dispatchEvent(new Event('auth_driver_updated'));
            
            toast({
              title: 'เข้าสู่ระบบสำเร็จ',
              description: `ยินดีต้อนรับ ${userData.displayName}`,
            });
            
            // Navigate to home
            navigate('/home', { replace: true });
            return;
          }
        }
        
        // Handle other deep links (notifications, etc.)
        // Example: thetroob://job/123 -> navigate to /job/123
        if (path.startsWith('job/')) {
          const jobId = path.replace('job/', '');
          navigate(`/job/${jobId}`, { replace: true });
          return;
        }
        
        if (path.startsWith('notifications/')) {
          const notificationId = path.replace('notifications/', '');
          navigate(`/notifications/${notificationId}`, { replace: true });
          return;
        }
        
        // Default: navigate to home
        console.log('[DeepLink] No specific handler, navigating to home');
        
      } catch (error) {
        console.error('[DeepLink] ❌ Error handling deep link:', error);
        toast({
          variant: 'destructive',
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถประมวลผลลิงก์ได้',
        });
      }
    };

    // Listen for deep links when app is already open
    const listener = App.addListener('appUrlOpen', handleDeepLink);

    // Check if app was opened with a deep link
    App.getLaunchUrl().then((result) => {
      if (result?.url) {
        console.log('[DeepLink] 🚀 App launched with URL:', result.url);
        handleDeepLink({ url: result.url });
      }
    }).catch(() => {
      // Not running in Capacitor
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, toast]);
};
