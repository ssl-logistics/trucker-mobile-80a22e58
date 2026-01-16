import { Capacitor } from '@capacitor/core';
import {
  isNativePlatform,
  registerNativePushNotifications,
  saveNativePushToken,
  setupNativePushListeners,
  unregisterNativePushNotifications,
  checkNativePushStatus,
  hasNativePushTokenInDb,
  openNotificationSettings,
  isNotificationPermissionDenied,
} from './capacitorPushNotifications';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  savePushSubscription,
  unsubscribeFromPushNotifications,
  checkPushSubscriptionStatus,
} from './pushNotifications';

// Re-export for convenience
export { openNotificationSettings, isNotificationPermissionDenied };

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

// Unified function to check if push notifications are supported
export const isPushSupported = (): boolean => {
  if (isNativePlatform()) {
    return true;
  }
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Unified function to get current permission status
export const getPushPermissionStatus = async (): Promise<PushPermissionStatus> => {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  if (isNativePlatform()) {
    // Native can be explicitly denied (Android 13+ / iOS), or just not requested yet.
    const denied = await isNotificationPermissionDenied();
    if (denied) return 'denied';

    const isEnabled = await checkNativePushStatus();
    return isEnabled ? 'granted' : 'prompt';
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission as PushPermissionStatus;
};

// Unified function to request permission and subscribe
export const enablePushNotifications = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return false;
  }

  try {
    if (isNativePlatform()) {
      // Native platform (iOS/Android)
      console.log('[UnifiedPush] Starting native push registration...');
      const token = await registerNativePushNotifications();
      console.log('[UnifiedPush] Registration result, token:', token ? token.substring(0, 20) + '...' : null);
      
      if (token) {
        console.log('[UnifiedPush] Token received, saving to database...');
        try {
          await saveNativePushToken(token);
          console.log('[UnifiedPush] Token saved successfully!');
        } catch (saveError) {
          console.error('[UnifiedPush] Failed to save token:', saveError);
          // Still return true if we got the token, save might fail due to auth timing
          // The token will be saved later when auth is ready
        }
        setupNativePushListeners();
        return true;
      }
      console.log('[UnifiedPush] No token received');
      return false;
    } else {
      // Web platform
      const permission = await requestNotificationPermission();
      
      if (permission === 'granted') {
        const subscription = await subscribeToPushNotifications();
        await savePushSubscription(subscription);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('Failed to enable push notifications:', error);
    return false;
  }
};

// Unified function to disable push notifications
export const disablePushNotifications = async (): Promise<void> => {
  try {
    if (isNativePlatform()) {
      await unregisterNativePushNotifications();
    } else {
      await unsubscribeFromPushNotifications();
    }
  } catch (error) {
    console.error('Failed to disable push notifications:', error);
    throw error;
  }
};

// Unified function to check if subscribed
export const isPushEnabled = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    if (isNativePlatform()) {
      // For native: "enabled" means permission granted AND we have a saved FCM token in DB
      const permitted = await checkNativePushStatus();
      if (!permitted) return false;
      return await hasNativePushTokenInDb();
    } else {
      return await checkPushSubscriptionStatus();
    }
  } catch (error) {
    console.error('Failed to check push status:', error);
    return false;
  }
};

// Get platform name for display
export const getPlatformName = (): string => {
  if (isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' ? 'iOS' : 'Android';
  }
  return 'Web';
};

// Initialize push notifications (call on app start)
export const initializePushNotifications = (): void => {
  if (isNativePlatform()) {
    setupNativePushListeners();
  }
};
