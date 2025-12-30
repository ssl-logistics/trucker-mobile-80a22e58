import { Capacitor } from '@capacitor/core';
import {
  isNativePlatform,
  registerNativePushNotifications,
  saveNativePushToken,
  setupNativePushListeners,
  unregisterNativePushNotifications,
  checkNativePushStatus,
} from './capacitorPushNotifications';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  savePushSubscription,
  unsubscribeFromPushNotifications,
  checkPushSubscriptionStatus,
} from './pushNotifications';

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
      const token = await registerNativePushNotifications();
      
      if (token) {
        await saveNativePushToken(token);
        setupNativePushListeners();
        return true;
      }
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
      return await checkNativePushStatus();
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
