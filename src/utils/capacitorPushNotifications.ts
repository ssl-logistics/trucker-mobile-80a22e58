import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

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

    // Register for push notifications
    await PushNotifications.register();

    // Return a promise that resolves with the token
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Native push registration success, token:', token.value);
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Native push registration error:', error);
        resolve(null);
      });
    });
  } catch (error) {
    console.error('Failed to register native push notifications:', error);
    return null;
  }
};

// Save native push token to database
export const saveNativePushToken = async (token: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const platform = Capacitor.getPlatform(); // 'ios' or 'android'

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: `native://${platform}/${token}`,
        p256dh: platform, // Store platform type
        auth: token, // Store the actual token in auth field
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      throw error;
    }

    console.log('Native push token saved to database');
  } catch (error) {
    console.error('Failed to save native push token:', error);
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
    
    // Remove from database
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const platform = Capacitor.getPlatform();
      
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .like('endpoint', `native://${platform}/%`);
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
