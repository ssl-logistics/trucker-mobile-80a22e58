import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { setAuthItem } from '@/utils/authStorage';
import { useToast } from '@/hooks/use-toast';

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
        console.log('[DeepLink] Search params:', url.search);

        // Handle LINE auth success callback
        if (path === 'line-auth-success' || url.host === 'line-auth-success') {
          const encodedData = url.searchParams.get('data');
          
          // Close the in-app browser if it's open
          try {
            await Browser.close();
            console.log('[DeepLink] 📱 In-app browser closed');
          } catch (e) {
            console.log('[DeepLink] Browser.close not needed or failed:', e);
          }
          
          if (encodedData) {
            console.log('[DeepLink] 🔐 Processing LINE auth data');
            
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
