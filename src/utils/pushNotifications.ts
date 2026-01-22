import { supabase } from '@/integrations/supabase/client';
import { getAuthItem } from '@/utils/authStorage';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Request notification permission from user
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service workers');
  }

  return await Notification.requestPermission();
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('Service worker registered:', registration);
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    throw error;
  }
};

// Subscribe to push notifications
export const subscribeToPushNotifications = async (): Promise<PushSubscription> => {
  try {
    const registration = await registerServiceWorker();
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('Already subscribed to push notifications');
      return subscription;
    }

    // Subscribe to push notifications
    // Get the VAPID public key from the edge function
    const { data: vapidData, error: vapidError } = await supabase.functions.invoke('get-vapid-key');
    
    if (vapidError || !vapidData?.publicKey) {
      throw new Error('Failed to get VAPID key');
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as BufferSource,
    });

    console.log('Subscribed to push notifications:', subscription);
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    throw error;
  }
};

// Save subscription to database
export const savePushSubscription = async (subscription: PushSubscription): Promise<void> => {
  try {
    // Our app may run with custom auth (driver_id) without backend-auth session.
    // Prefer backend-auth user id, fall back to stored driver id.
    const { data: { user } } = await supabase.auth.getUser();
    const fallbackDriverId = await getAuthItem('auth_driver_id');
    const userId = user?.id ?? fallbackDriverId;

    if (!userId) {
      throw new Error('Missing user id for push subscription');
    }

    const subscriptionData = subscription.toJSON();
    
    if (!subscriptionData.endpoint || !subscriptionData.keys) {
      throw new Error('Invalid subscription data');
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      throw error;
    }

    console.log('Push subscription saved to database');
  } catch (error) {
    console.error('Failed to save push subscription:', error);
    throw error;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPushNotifications = async (): Promise<void> => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      
      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      const fallbackDriverId = await getAuthItem('auth_driver_id');
      const userId = user?.id ?? fallbackDriverId;

      if (userId) {
        const subscriptionData = subscription.toJSON();
        
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscriptionData.endpoint);
      }
    }
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    throw error;
  }
};

// Check if user is subscribed
export const checkPushSubscriptionStatus = async (): Promise<boolean> => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    return subscription !== null;
  } catch (error) {
    console.error('Failed to check push subscription status:', error);
    return false;
  }
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}
