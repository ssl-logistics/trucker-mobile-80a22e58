import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { getAuthItem } from '@/utils/authStorage';

// Check if running on native platform
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

// Open device notification settings
// Note: On iOS, users need to manually go to Settings > App > Notifications
// On Android, this attempts to open app settings via intent
export const openNotificationSettings = async (): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('[NativePush] Not on native platform, cannot open settings');
    return;
  }

  const platform = Capacitor.getPlatform();
  console.log('[NativePush] Opening notification settings for:', platform);

  try {
    if (platform === 'ios') {
      // Try to open iOS app settings using URL scheme
      // This works for most iOS versions
      const opened = window.open('app-settings:', '_system');
      if (!opened) {
        console.log('[NativePush] Could not open settings automatically');
        console.log('[NativePush] Please open Settings > Notifications > [App Name] manually');
      }
      return;
    }

    if (platform === 'android') {
      // On Android, logging instruction for now
      // Full native settings requires capacitor-native-settings which doesn't support Cap 8
      console.log('[NativePush] Please open Settings > Apps > [App Name] > Notifications manually');
      return;
    }
  } catch (error) {
    console.error('[NativePush] Failed to open settings:', error);
  }

  console.log('[NativePush] Please open Settings manually and enable notifications for this app');
};

// Check if notification permission is denied (not just not-granted)
export const isNotificationPermissionDenied = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    return false;
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    return permStatus.receive === 'denied';
  } catch (error) {
    console.error('[NativePush] Failed to check permission:', error);
    return false;
  }
};

// Request permission and register for push notifications on native platforms
export const registerNativePushNotifications = async (): Promise<string | null> => {
  const platform = Capacitor.getPlatform();
  console.log('[NativePush] ========================================');
  console.log('[NativePush] registerNativePushNotifications called');
  console.log('[NativePush] Platform:', platform);
  console.log('[NativePush] isNativePlatform:', isNativePlatform());
  console.log('[NativePush] ========================================');

  if (!isNativePlatform()) {
    console.log('[NativePush] Not running on native platform, skipping native push registration');
    return null;
  }

  try {
    // Step 1: Check current permission status
    console.log('[NativePush] Step 1: Checking permissions...');
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[NativePush] Initial permission status:', JSON.stringify(permStatus));

    // Step 2: Request permission if needed
    if (permStatus.receive === 'prompt') {
      console.log('[NativePush] Step 2: Requesting permissions...');
      permStatus = await PushNotifications.requestPermissions();
      console.log('[NativePush] After request, permission status:', JSON.stringify(permStatus));
    }

    if (permStatus.receive !== 'granted') {
      console.log('[NativePush] ❌ Push notification permission not granted:', permStatus.receive);
      return null;
    }

    console.log('[NativePush] ✅ Permission granted! Setting up registration...');

    // Step 3: Remove all existing listeners first to prevent duplicates
    console.log('[NativePush] Step 3: Removing existing listeners...');
    try {
      await PushNotifications.removeAllListeners();
      console.log('[NativePush] Existing listeners removed');
    } catch (e) {
      console.log('[NativePush] No listeners to remove or error:', e);
    }

    // Step 4: Set up listeners and register
    console.log('[NativePush] Step 4: Setting up new listeners and registering...');
    
    return await new Promise<string | null>((resolve) => {
      let settled = false;
      let registrationHandle: any = null;
      let errorHandle: any = null;

      const settle = (value: string | null, reason: string) => {
        if (settled) {
          console.log('[NativePush] Already settled, ignoring:', reason);
          return;
        }
        settled = true;
        console.log('[NativePush] Settling with:', value ? 'token' : 'null', 'reason:', reason);

        try {
          clearTimeout(timeoutId);
        } catch {
          // ignore
        }

        // Clean up listeners after settling
        setTimeout(() => {
          try {
            registrationHandle?.remove?.();
          } catch { /* ignore */ }
          try {
            errorHandle?.remove?.();
          } catch { /* ignore */ }
        }, 100);

        resolve(value);
      };

      // Timeout after 20 seconds (increased for iOS cold start)
      const timeoutId = setTimeout(() => {
        console.warn('[NativePush] ⏰ Registration timed out (no token received after 20s)');
        console.warn('[NativePush] This might happen if:');
        console.warn('[NativePush] - APNs is not properly configured');
        console.warn('[NativePush] - Push Notifications capability not enabled in Xcode');
        console.warn('[NativePush] - Invalid provisioning profile');
        settle(null, 'timeout');
      }, 20000);

      // Set up listeners before calling register
      (async () => {
        try {
          console.log('[NativePush] Adding registration listener...');
          registrationHandle = await PushNotifications.addListener('registration', (token: Token) => {
            console.log('[NativePush] 🎉🎉🎉 Registration SUCCESS! 🎉🎉🎉');
            console.log('[NativePush] Token value:', token.value);
            console.log('[NativePush] Token length:', token.value?.length);
            settle(token.value, 'registration_success');
          });
          console.log('[NativePush] Registration listener added');

          console.log('[NativePush] Adding error listener...');
          errorHandle = await PushNotifications.addListener('registrationError', (error: any) => {
            console.error('[NativePush] ❌❌❌ Registration ERROR! ❌❌❌');
            console.error('[NativePush] Error details:', JSON.stringify(error));
            settle(null, 'registration_error');
          });
          console.log('[NativePush] Error listener added');

          // iOS specific: Wait a bit longer to ensure listeners are attached
          // This is crucial for iOS where the native bridge might need more time
          const delayMs = platform === 'ios' ? 300 : 100;
          console.log(`[NativePush] Waiting ${delayMs}ms for listeners to be fully ready (${platform})...`);
          await new Promise(r => setTimeout(r, delayMs));

          // Now call register
          console.log('[NativePush] 📱 Calling PushNotifications.register()...');
          await PushNotifications.register();
          console.log('[NativePush] PushNotifications.register() call completed');
          console.log('[NativePush] Waiting for registration callback...');
        } catch (error) {
          console.error('[NativePush] ❌ Failed in registration flow:', error);
          settle(null, 'exception: ' + (error instanceof Error ? error.message : String(error)));
        }
      })();
    });
  } catch (error) {
    console.error('[NativePush] ❌ Top-level registration error:', error);
    return null;
  }
};

// ============= Token persistence helpers =============

type CurrentUserIdResult = {
  userId: string | null;
  source: string;
};

const getCurrentUserIdFromAnySource = async (): Promise<CurrentUserIdResult> => {
  // Try backend auth first, then fall back to stored driver_id (custom auth)
  let userId: string | null = null;
  let authSource = 'none';

  // Method 1: Backend auth
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

  return { userId, source: authSource };
};

// Check if we already have a saved push token in DB for the current user
export const hasNativePushTokenInDb = async (): Promise<boolean> => {
  try {
    const { userId } = await getCurrentUserIdFromAnySource();
    if (!userId) return false;

    const platform = Capacitor.getPlatform();
    const prefix = platform === 'ios' ? 'apns://' : 'fcm://';

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .like('endpoint', `${prefix}%`)
      .limit(1);

    if (error) {
      console.error('[NativePush] Failed to check existing push token:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    console.error('[NativePush] Failed to check existing push token:', error);
    return false;
  }
};

// Save native push token to database (APNs for iOS, FCM for Android)
export const saveNativePushToken = async (token: string): Promise<void> => {
  console.log('[NativePush] ========================================');
  console.log('[NativePush] saveNativePushToken called');
  console.log('[NativePush] Token to save:', token?.substring(0, 50) + '...');
  console.log('[NativePush] Token length:', token?.length);
  console.log('[NativePush] ========================================');

  if (!token) {
    console.error('[NativePush] ❌ No token provided to save!');
    throw new Error('No token provided');
  }

  try {
    const { userId, source } = await getCurrentUserIdFromAnySource();

    if (!userId) {
      console.error('[NativePush] ❌ No user ID found from any source!');
      console.error('[NativePush] Cannot save token without user ID');
      throw new Error('User not authenticated - no user ID found');
    }

    const platform = Capacitor.getPlatform(); // 'ios' or 'android'
    
    // Use apns:// for iOS, fcm:// for Android
    const prefix = platform === 'ios' ? 'apns://' : 'fcm://';
    const endpoint = `${prefix}${token}`;

    console.log('[NativePush] Saving push token:');
    console.log('[NativePush] - User ID:', userId);
    console.log('[NativePush] - Platform:', platform);
    console.log('[NativePush] - Prefix:', prefix);
    console.log('[NativePush] - Source:', source);

    // First, delete any existing subscriptions for this user on this platform
    console.log(`[NativePush] Deleting old ${prefix} subscriptions for user...`);
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .like('endpoint', `${prefix}%`);
    
    if (deleteError) {
      console.warn('[NativePush] Delete old tokens warning:', deleteError);
    } else {
      console.log('[NativePush] Old tokens deleted');
    }

    // Then insert the new token
    console.log('[NativePush] Inserting new push token...');
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: endpoint,
        p256dh: platform, // Store platform type
        auth: token, // Store the actual token
      })
      .select()
      .single();

    if (error) {
      console.error('[NativePush] ❌ Database error saving push token:', error);
      throw error;
    }

    console.log(`[NativePush] ✅✅✅ ${platform.toUpperCase()} push token saved successfully! ✅✅✅`);
    console.log('[NativePush] Saved record ID:', data?.id);
  } catch (error) {
    console.error('[NativePush] ❌ Failed to save push token:', error);
    throw error;
  }
};

// Track if listeners are already set up to prevent duplicates
let listenersSetUp = false;

// Setup push notification listeners
export const setupNativePushListeners = (): void => {
  if (!isNativePlatform()) {
    return;
  }

  // Prevent duplicate listener setup which can crash Android
  if (listenersSetUp) {
    console.log('[NativePush] Listeners already set up, skipping...');
    return;
  }

  console.log('[NativePush] Setting up push notification listeners...');

  try {
    // Handle incoming push notifications when app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[NativePush] Push notification received in foreground:', JSON.stringify(notification));
      // You can show a local notification or update UI here
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('[NativePush] Push notification action performed:', JSON.stringify(notification));
      
      try {
        const data = notification.notification.data;
        console.log('[NativePush] Notification data:', JSON.stringify(data));
        
        // Navigate to appropriate page based on notification data
        if (data?.url) {
          console.log('[NativePush] Navigating to:', data.url);
          // Use setTimeout to ensure navigation happens after app is ready
          setTimeout(() => {
            try {
              window.location.hash = data.url;
            } catch (navError) {
              console.error('[NativePush] Navigation error:', navError);
            }
          }, 500);
        }
      } catch (error) {
        console.error('[NativePush] Error handling notification action:', error);
      }
    });

    listenersSetUp = true;
    console.log('[NativePush] Push notification listeners set up successfully');
  } catch (error) {
    console.error('[NativePush] Failed to set up listeners:', error);
  }
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
      const platform = Capacitor.getPlatform();
      const prefix = platform === 'ios' ? 'apns://' : 'fcm://';
      
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .like('endpoint', `${prefix}%`);
    }
    
    console.log('Unregistered from native push notifications');
  } catch (error) {
    console.error('Failed to unregister native push notifications:', error);
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
