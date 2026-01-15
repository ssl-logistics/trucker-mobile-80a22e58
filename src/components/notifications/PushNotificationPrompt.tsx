import { useState, useEffect } from 'react';
import { Bell, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  isPushSupported,
  getPushPermissionStatus,
  enablePushNotifications,
  isPushEnabled,
  getPlatformName,
  initializePushNotifications,
  openNotificationSettings,
  isNotificationPermissionDenied,
} from '@/utils/unifiedPushNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

export const PushNotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDeniedPrompt, setShowDeniedPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    // Initialize push notification listeners
    initializePushNotifications();

    const checkPermission = async () => {
      // Check if notifications are supported
      if (!isPushSupported()) {
        return;
      }

      // Check current permission status
      const status = await getPushPermissionStatus();

      // If denied (native/web), show the "open settings" prompt (and auto-open settings once)
      const denied = status === 'denied' || (await isNotificationPermissionDenied());
      if (denied) {
        // Check if user has dismissed the denied prompt recently
        const lastDeniedPrompt = localStorage.getItem('push_notification_denied_prompt');
        if (lastDeniedPrompt) {
          const lastPromptTime = new Date(lastDeniedPrompt).getTime();
          const now = new Date().getTime();
          const daysSinceLastPrompt = (now - lastPromptTime) / (1000 * 60 * 60 * 24);

          // Don't show prompt if less than 3 days since last prompt
          if (daysSinceLastPrompt < 3) {
            return;
          }
        }

        setTimeout(() => {
          setShowDeniedPrompt(true);
        }, 1200);

        // Auto-open settings (best effort) once per day when we detect it's denied
        const lastAutoOpen = localStorage.getItem('push_notification_denied_auto_open');
        const shouldAutoOpen = !lastAutoOpen
          ? true
          : (new Date().getTime() - new Date(lastAutoOpen).getTime()) / (1000 * 60 * 60 * 24) >= 1;

        if (shouldAutoOpen) {
          localStorage.setItem('push_notification_denied_auto_open', new Date().toISOString());
          setTimeout(() => {
            void openNotificationSettings();
          }, 1800);
        }

        return;
      }

      // Check if user has already been prompted recently
      const lastPrompt = localStorage.getItem('push_notification_last_prompt');
      if (lastPrompt) {
        const lastPromptTime = new Date(lastPrompt).getTime();
        const now = new Date().getTime();
        const daysSinceLastPrompt = (now - lastPromptTime) / (1000 * 60 * 60 * 24);
        
        // Don't show prompt if less than 7 days since last prompt
        if (daysSinceLastPrompt < 7) {
          return;
        }
      }

      // Check if already subscribed
      const isSubscribed = await isPushEnabled();
      if (isSubscribed) {
        return;
      }

      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    checkPermission();
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    
    try {
      const success = await enablePushNotifications();
      
      if (success) {
        toast({
          title: t('toast.notificationEnabled'),
          description: t('toast.notificationEnabledDesc'),
        });
        setShowPrompt(false);
      } else {
        // Check if permission was denied
        const isDenied = await isNotificationPermissionDenied();
        const platform = getPlatformName();
        
        if (isDenied) {
          // Show the denied prompt and auto-open settings
          setShowPrompt(false);
          setShowDeniedPrompt(true);
          
          // Auto-open settings to help user
          try {
            await openNotificationSettings();
            toast({
              title: platform === 'Android' 
                ? 'กรุณาเปิดการแจ้งเตือนใน Settings' 
                : 'Please enable notifications in Settings',
              description: platform === 'Android'
                ? 'เลือก "การแจ้งเตือน" แล้วเปิดสวิตช์'
                : 'Find "Notifications" and enable it',
            });
          } catch {
            // Settings couldn't open automatically - show manual instruction
            toast({
              title: 'ไม่สามารถเปิดการแจ้งเตือนได้',
              description: platform === 'Android'
                ? 'ไปที่ Settings > Apps > The Troob > Notifications > เปิด'
                : 'Go to Settings > Notifications > The Troob > Allow',
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: t('toast.cannotEnableNotification'),
            description: platform === 'Web' 
              ? t('toast.allowNotificationInBrowser')
              : `Please enable notifications in your ${platform} settings`,
            variant: "destructive",
          });
        }
      }
      
      // Save timestamp of prompt
      localStorage.setItem('push_notification_last_prompt', new Date().toISOString());
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.cannotChangeSettings'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    const platform = getPlatformName();
    
    try {
      await openNotificationSettings();
      
      // Show instruction toast
      toast({
        title: platform === 'Android' 
          ? 'เปิดการแจ้งเตือนใน Settings' 
          : 'Open Notifications in Settings',
        description: platform === 'Android'
          ? 'กรุณาเปิดการแจ้งเตือนสำหรับแอปนี้'
          : 'Please enable notifications for this app',
      });
      
      setShowDeniedPrompt(false);
      localStorage.setItem('push_notification_denied_prompt', new Date().toISOString());
    } catch (error) {
      console.error('Failed to open settings:', error);
      
      // Show manual instruction
      toast({
        title: 'เปิดการแจ้งเตือนด้วยตนเอง',
        description: platform === 'Android'
          ? 'ไปที่ Settings > Apps > The Troob > Notifications > เปิด'
          : 'Go to Settings > Notifications > The Troob > Allow',
        variant: "default",
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push_notification_last_prompt', new Date().toISOString());
  };

  const handleDismissDenied = () => {
    setShowDeniedPrompt(false);
    localStorage.setItem('push_notification_denied_prompt', new Date().toISOString());
  };

  // Denied permission prompt - show option to open settings
  if (showDeniedPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
        <Card className="p-4 shadow-lg border-2 border-orange-500/30 bg-background">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-500" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">
                การแจ้งเตือนถูกปิดอยู่
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                คุณได้ปฏิเสธการแจ้งเตือน กรุณาเปิดใน Settings เพื่อรับการแจ้งเตือนงานใหม่
              </p>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleOpenSettings}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  เปิด Settings
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissDenied}
                >
                  ไว้ก่อน
                </Button>
              </div>
            </div>
            
            <button
              onClick={handleDismissDenied}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!showPrompt) {
    return null;
  }

  const handleEnableViaSettings = async () => {
    setIsLoading(true);
    
    try {
      await openNotificationSettings();
      
      toast({
        title: 'กรุณาเปิดการแจ้งเตือน',
        description: 'เปิดสวิตช์การแจ้งเตือนสำหรับแอปนี้',
      });
      
      setShowPrompt(false);
      localStorage.setItem('push_notification_last_prompt', new Date().toISOString());
    } catch (error) {
      console.error('Failed to open settings:', error);
      // Fallback to regular enable flow
      await handleEnable();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="p-4 shadow-lg border-2 border-orange-500/30 bg-background">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-orange-500" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              {t('notification.enableTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {t('notification.enableDesc')}
            </p>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEnableViaSettings}
                disabled={isLoading}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Settings className="w-4 h-4 mr-1" />
                {isLoading ? t('notification.enabling') : t('notification.enableButton')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                {t('notification.later')}
              </Button>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </div>
  );
};