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
  console.log('[NativePush] registerNativePushNotifications called');
  console.log('[NativePush] Platform:', Capacitor.getPlatform());
  console.log('[NativePush] isNativePlatform:', isNativePlatform());

  if (!isNativePlatform()) {
    console.log('[NativePush] Not running on native platform, skipping native push registration');
    return null;
  }

  try {
    // Request permission
    console.log('[NativePush] Checking permissions...');
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[NativePush] Initial permission status:', permStatus.receive);

    if (permStatus.receive === 'prompt') {
      console.log('[NativePush] Requesting permissions...');
      permStatus = await PushNotifications.requestPermissions();
      console.log('[NativePush] After request, permission status:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.log('[NativePush] Push notification permission not granted:', permStatus.receive);
      return null;
    }

    console.log('[NativePush] Permission granted, setting up listeners...');

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
        console.warn('[NativePush] Registration timed out (no token received after 15s)');
        settle(null);
      }, 15000);

      (async () => {
        try {
          console.log('[NativePush] Adding registration listeners...');
          [registrationHandle, errorHandle] = await Promise.all([
            PushNotifications.addListener('registration', (token: Token) => {
              console.log('[NativePush] ✅ Registration SUCCESS!');
              console.log('[NativePush] Token received:', token.value?.substring(0, 30) + '...');
              settle(token.value);
            }),
            PushNotifications.addListener('registrationError', (error: any) => {
              console.error('[NativePush] ❌ Registration ERROR:', JSON.stringify(error));
              settle(null);
            }),
          ]);

          console.log('[NativePush] Listeners added, calling PushNotifications.register()...');
          await PushNotifications.register();
          console.log('[NativePush] PushNotifications.register() completed');
        } catch (error) {
          console.error('[NativePush] Failed to register:', error);
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
  console.log('[NativePush] saveNativePushToken called');
  console.log('[NativePush] Token to save:', token?.substring(0, 30) + '...');

  try {
    // Try backend auth first, then fall back to stored driver_id (custom auth)
    let userId: string | null = null;
    let authSource = 'none';

    // Method 1: Supabase auth
    try {
      console.log('[NativePush] Trying supabase.auth.getUser()...');
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      if (userId) authSource = 'supabase_auth';
      console.log('[NativePush] Supabase auth user_id:', userId);
    } catch (e) {
      console.log('[NativePush] Supabase auth failed:', e);
    }

    // Method 2: Capacitor Preferences - auth_driver_id
    if (!userId) {
      console.log('[NativePush] Trying getAuthItem("auth_driver_id")...');
      userId = await getAuthItem('auth_driver_id');
      if (userId) authSource = 'preferences_driver_id';
      console.log('[NativePush] Preferences auth_driver_id:', userId);
    }

    // Method 3: Capacitor Preferences - auth_driver object
    if (!userId) {
      console.log('[NativePush] Trying getAuthItem("auth_driver")...');
      const driverStr = await getAuthItem('auth_driver');
      console.log('[NativePush] auth_driver string:', driverStr?.substring(0, 50) + '...');
      if (driverStr) {
        try {
          const parsed = JSON.parse(driverStr) as any;
          if (parsed?.id) {
            userId = String(parsed.id);
            authSource = 'preferences_driver_object';
          }
          console.log('[NativePush] Parsed driver.id:', userId);
        } catch (e) {
          console.log('[NativePush] Failed to parse auth_driver:', e);
        }
      }
    }

    // Method 4: localStorage fallback
    if (!userId) {
      console.log('[NativePush] Trying localStorage.getItem("auth_driver_id")...');
      userId = localStorage.getItem('auth_driver_id');
      if (userId) authSource = 'localStorage';
      console.log('[NativePush] localStorage auth_driver_id:', userId);
    }

    console.log('[NativePush] Final userId:', userId, 'source:', authSource);

    if (!userId) {
      console.error('[NativePush] ❌ No user ID found from any source!');
      throw new Error('User not authenticated - no user ID found');
    }

    const platform = Capacitor.getPlatform(); // 'ios' or 'android'

    console.log('[NativePush] Saving FCM token for user:', userId, 'platform:', platform);

    // Use fcm:// prefix so backend can identify FCM tokens
    const endpoint = `fcm://${token}`;
    console.log('[NativePush] Upserting to push_subscriptions...');
    console.log('[NativePush] Data:', { user_id: userId, endpoint: endpoint.substring(0, 30) + '...', p256dh: platform });

    // First, delete any existing FCM subscriptions for this user
    console.log('[NativePush] Deleting old FCM subscriptions for user...');
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .like('endpoint', 'fcm://%');

    // Then insert the new token
    console.log('[NativePush] Inserting new FCM token...');
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: endpoint,
        p256dh: platform, // Store platform type
        auth: token, // Store the actual token
      });

    if (error) {
      console.error('[NativePush] ❌ Database error saving FCM token:', error);
      throw error;
    }

    console.log('[NativePush] ✅ FCM token saved successfully!');
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
