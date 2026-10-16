/**
 * Unified Push Notifications
 * 
 * This module provides a unified interface for push notifications
 * across native (iOS/Android via Capacitor) and web platforms.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import {
  isNativePlatform,
  registerNativePushNotifications,
  saveNativePushToken,
  setupNativePushListeners,
  unregisterNativePushNotifications,
  checkNativePushStatus,
  hasNativePushTokenInDb,
  getStoredNativePushToken,
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
    try {
      // Use Capacitor PushNotifications to check actual permission status
      const permStatus = await PushNotifications.checkPermissions();
      console.log('[UnifiedPush] Native permission status:', permStatus.receive);
      
      if (permStatus.receive === 'denied') {
        return 'denied';
      } else if (permStatus.receive === 'granted') {
        return 'granted';
      } else {
        return 'prompt';
      }
    } catch (error) {
      console.error('[UnifiedPush] Failed to check native permission:', error);
      return 'prompt';
    }
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission as PushPermissionStatus;
};

// Unified function to request permission and subscribe
// Set forceRegister=true to bypass cooldown (e.g., when user explicitly clicks Enable button)
export const enablePushNotifications = async (forceRegister: boolean = true): Promise<boolean> => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return false;
  }

  try {
    if (isNativePlatform()) {
      // Native platform (iOS/Android)
      console.log('[UnifiedPush] Starting native push registration (force:', forceRegister, ')...');
      const token = await registerNativePushNotifications(forceRegister);
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
// This will also auto-register the FCM token if permission is already granted but no token saved
// Always fetch the device's latest token and re-save it when it differs from
// what's stored — stale/expired tokens otherwise linger forever (TOKEN_EXPIRED,
// BadDeviceToken) and the phone never gets alerts again.
let refreshInFlight = false;
let lastRefreshAt = 0;
let resumeListenerAdded = false;

const refreshNativeToken = async (reason: string): Promise<void> => {
  if (refreshInFlight) return;
  if (Date.now() - lastRefreshAt < 60_000 && reason === 'resume') return;
  refreshInFlight = true;
  lastRefreshAt = Date.now();
  try {
    const permitted = await checkNativePushStatus();
    if (!permitted) return;
    const token = await registerNativePushNotifications(true);
    if (!token) return;
    const stored = await getStoredNativePushToken();
    if (stored === token) {
      console.log('[UnifiedPush] Token unchanged (', reason, ')');
      return;
    }
    await saveNativePushToken(token);
    console.log('[UnifiedPush] ✅ Token refreshed and saved (', reason, ')');
  } catch (error) {
    console.error('[UnifiedPush] Token refresh failed:', error);
  } finally {
    refreshInFlight = false;
  }
};

export const initializePushNotifications = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  setupNativePushListeners();
  await refreshNativeToken('init');
  if (!resumeListenerAdded) {
    resumeListenerAdded = true;
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refreshNativeToken('resume');
      });
      window.addEventListener('auth_driver_updated', () => {
        lastRefreshAt = 0;
        void refreshNativeToken('login');
      });
    } catch (e) {
      console.warn('[UnifiedPush] Could not add resume listener', e);
    }
  }
};

// Call after a successful login so the device is bound to the new account.
export const refreshPushTokenAfterLogin = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  lastRefreshAt = 0;
  await refreshNativeToken('login');
};
