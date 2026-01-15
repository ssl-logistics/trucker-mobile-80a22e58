import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { getAuthItem } from '@/utils/authStorage';

// Check if running on native platform
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Request permission and register for push notifications on native platforms
export const registerNativePushNotifications = async (): Promise<string | null> => {
  if (!isNativePlatform()) {
    console.log('Not running on native platform, skipping native push registration');
    return null;
  }

  try {
    // Request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // IMPORTANT: add listeners BEFORE calling register() to avoid missing fast events.
    return await new Promise<string | null>((resolve) => {
      let settled = false;
      let registrationHandle: any = null;
      let errorHandle: any = null;

      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;

        try {
          clearTimeout(timeoutId);
        } catch {
          // ignore
        }

        try {
          registrationHandle?.remove?.();
        } catch {
          // ignore
        }

        try {
          errorHandle?.remove?.();
        } catch {
          // ignore
        }

        resolve(value);
      };

      const timeoutId = setTimeout(() => {
        console.warn('Native push registration timed out (no token received)');
        settle(null);
      }, 15000);

      (async () => {
        try {
          [registrationHandle, errorHandle] = await Promise.all([
            PushNotifications.addListener('registration', (token: Token) => {
              console.log('Native push registration success, token:', token.value);
              settle(token.value);
            }),
            PushNotifications.addListener('registrationError', (error: any) => {
              console.error('Native push registration error:', error);
              settle(null);
            }),
          ]);

          await PushNotifications.register();
        } catch (error) {
          console.error('Failed to register native push notifications:', error);
          settle(null);
        }
      })();
    });
  } catch (error) {
    console.error('Failed to register native push notifications:', error);
    return null;
  }
};

// Save native push token to database (FCM format for Firebase)
export const saveNativePushToken = async (token: string): Promise<void> => {
  try {
    // Try backend auth first, then fall back to stored driver_id (custom auth)
    let userId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // ignore
    }

    // On native, auth state is often stored in Capacitor Preferences (not localStorage)
    if (!userId) {
      userId = await getAuthItem('auth_driver_id');
    }

    // Fallback: derive from stored driver object
    if (!userId) {
      const driverStr = await getAuthItem('auth_driver');
      if (driverStr) {
        try {
          const parsed = JSON.parse(driverStr) as any;
          if (parsed?.id) userId = String(parsed.id);
        } catch {
          // ignore
        }
      }
    }

    // Last fallback
    if (!userId) {
      userId = localStorage.getItem('auth_driver_id');
    }

    if (!userId) {
      throw new Error('User not authenticated - no user ID found');
    }

    const platform = Capacitor.getPlatform(); // 'ios' or 'android'

    console.log('Saving FCM token for user:', userId, 'platform:', platform);

    // Use fcm:// prefix so backend can identify FCM tokens
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint: `fcm://${token}`,
          p256dh: platform, // Store platform type
          auth: token, // Store the actual token
        },
        {
          onConflict: 'user_id,endpoint',
        }
      );

    if (error) {
      console.error('Database error saving FCM token:', error);
      throw error;
    }

    console.log('FCM push token saved to database for platform:', platform, 'token:', token.substring(0, 20) + '...');
  } catch (error) {
    console.error('Failed to save FCM push token:', error);
    throw error;
  }
};

// Setup push notification listeners
export const setupNativePushListeners = (): void => {
  if (!isNativePlatform()) {
    return;
  }

  // Handle incoming push notifications when app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push notification received:', notification);
    // You can show a local notification or update UI here
  });

  // Handle notification tap
  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push notification action performed:', notification);
    
    const data = notification.notification.data;
    
    // Navigate to appropriate page based on notification data
    if (data?.url) {
      window.location.hash = data.url;
    }
  });
};

// Unregister from native push notifications
export const unregisterNativePushNotifications = async (): Promise<void> => {
  if (!isNativePlatform()) {
    return;
  }

  try {
    await PushNotifications.removeAllListeners();
    
    // Get user ID from Supabase auth or localStorage
    let userId: string | null = null;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch (e) {
      console.log('Supabase auth not available, checking localStorage');
    }
    
    if (!userId) {
      userId = localStorage.getItem('auth_driver_id');
    }
    
    if (userId) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .like('endpoint', 'fcm://%');
    }
    
    console.log('Unregistered from FCM push notifications');
  } catch (error) {
    console.error('Failed to unregister FCM push notifications:', error);
    throw error;
  }
};

// Check if native push notifications are enabled
export const checkNativePushStatus = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    return permStatus.receive === 'granted';
  } catch (error) {
    console.error('Failed to check native push status:', error);
    return false;
  }
};
