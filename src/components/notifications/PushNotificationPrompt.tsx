import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  savePushSubscription,
  checkPushSubscriptionStatus,
} from '@/utils/pushNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

export const PushNotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const checkPermission = async () => {
      // Check if notifications are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
      }

      // Check if already granted or denied
      if (Notification.permission === 'granted') {
        return;
      }

      if (Notification.permission === 'denied') {
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
      const isSubscribed = await checkPushSubscriptionStatus();
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
      // Request permission
      const permission = await requestNotificationPermission();
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications();
        
        // Save subscription to database
        await savePushSubscription(subscription);
        
        toast({
          title: t('toast.notificationEnabled'),
          description: t('toast.notificationEnabledDesc'),
        });
        
        setShowPrompt(false);
      } else if (permission === 'denied') {
        toast({
          title: t('toast.cannotEnableNotification'),
          description: t('toast.allowNotificationInBrowser'),
          variant: "destructive",
        });
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

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push_notification_last_prompt', new Date().toISOString());
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="p-4 shadow-lg border-2 border-primary/20 bg-background">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              เปิดการแจ้งเตือน
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              รับการแจ้งเตือนเมื่อมีงานใหม่, ข้อความ หรืออัพเดทสำคัญ
            </p>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'กำลังเปิด...' : 'เปิดการแจ้งเตือน'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                ภายหลัง
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
