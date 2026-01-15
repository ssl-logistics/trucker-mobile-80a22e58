import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  tag?: string;
  requireInteraction?: boolean;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  id: string;
}

// ============= Firebase Cloud Messaging (FCM) for Native Mobile =============

interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Generate JWT for Firebase OAuth2
async function generateFirebaseAccessToken(serviceAccount: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiration
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import private key and sign
  const privateKeyPem = serviceAccount.private_key;
  const privateKeyDer = pemToDer(privateKeyPem);
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(unsignedToken)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Failed to get Firebase access token:', errorText);
    throw new Error(`Failed to get Firebase access token: ${errorText}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Convert PEM to DER format
function pemToDer(pem: string): ArrayBuffer {
  const pemLines = pem.split('\n');
  const pemContents = pemLines
    .filter(line => !line.startsWith('-----'))
    .join('');
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Send push notification via FCM HTTP v1 API
async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown> | undefined,
  accessToken: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = {
      message: {
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: data ? Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ) : undefined,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };
    
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );
    
    if (response.ok) {
      console.log('FCM notification sent successfully');
      return { success: true };
    }
    
    const errorText = await response.text();
    console.error(`FCM error ${response.status}: ${errorText}`);
    
    // Check if token is invalid/expired
    if (response.status === 404 || errorText.includes('NOT_FOUND') || errorText.includes('UNREGISTERED')) {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }
    
    return { success: false, error: errorText };
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============= Web Push (VAPID) for Browsers =============

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64Url = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = atob(base64Url);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveBits']
  );
}

async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKeyBytes: Uint8Array
): Promise<Uint8Array> {
  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer as ArrayBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    256
  );

  return new Uint8Array(sharedSecret);
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      salt: salt.buffer as ArrayBuffer,
      info: info.buffer as ArrayBuffer,
      hash: 'SHA-256',
    },
    keyMaterial,
    length * 8
  );

  return new Uint8Array(derived);
}

function createInfo(type: string, context: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);
  
  const info = new Uint8Array(typeBuffer.length + 1 + context.length);
  info.set(typeBuffer, 0);
  info.set([0], typeBuffer.length);
  info.set(context, typeBuffer.length + 1);
  
  return info;
}

async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<{ encryptedPayload: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  const localKeyPair = await generateECDHKeyPair();
  const localPublicKey = await exportPublicKey(localKeyPair.publicKey);
  
  const subscriberPublicKey = urlBase64ToUint8Array(subscription.p256dh);
  const authSecret = urlBase64ToUint8Array(subscription.auth);
  
  const sharedSecret = await deriveSharedSecret(localKeyPair.privateKey, subscriberPublicKey);
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const context = new Uint8Array(1 + 2 + 65 + 2 + 65);
  context[0] = 0;
  
  context[1] = 0;
  context[2] = 65;
  context.set(subscriberPublicKey, 3);
  
  context[68] = 0;
  context[69] = 65;
  context.set(localPublicKey, 70);
  
  const prkInfo = encoder.encode('Content-Encoding: auth\0');
  const prk = await hkdf(authSecret, sharedSecret, prkInfo, 32);
  
  const cekInfo = createInfo('Content-Encoding: aes128gcm', context);
  const contentEncryptionKey = await hkdf(salt, prk, cekInfo, 16);
  
  const nonceInfo = createInfo('Content-Encoding: nonce', context);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);
  
  const paddingLength = 0;
  const paddedPayload = new Uint8Array(2 + paddingLength + payloadBytes.length);
  paddedPayload[0] = (paddingLength >> 8) & 0xff;
  paddedPayload[1] = paddingLength & 0xff;
  paddedPayload.set(payloadBytes, 2 + paddingLength);
  
  const key = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce.buffer as ArrayBuffer,
      tagLength: 128,
    },
    key,
    paddedPayload
  );
  
  return {
    encryptedPayload: new Uint8Array(encrypted),
    salt,
    localPublicKey,
  };
}

async function createWebPushBody(
  payload: string,
  subscription: PushSubscription
): Promise<Uint8Array> {
  const { encryptedPayload, salt, localPublicKey } = await encryptPayload(payload, subscription);
  
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  
  header.set(salt, 0);
  
  header[16] = (recordSize >> 24) & 0xff;
  header[17] = (recordSize >> 16) & 0xff;
  header[18] = (recordSize >> 8) & 0xff;
  header[19] = recordSize & 0xff;
  
  header[20] = 65;
  header.set(localPublicKey, 21);
  
  const body = new Uint8Array(header.length + encryptedPayload.length);
  body.set(header, 0);
  body.set(encryptedPayload, header.length);
  
  return body;
}

async function generateVapidJwt(
  endpoint: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  subject: string
): Promise<string> {
  // VAPID public key is base64url-encoded uncompressed P-256 public key (65 bytes: 0x04 || X(32) || Y(32))
  // VAPID private key is base64url-encoded 32-byte private key (d)
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: 'JWT', alg: 'ES256' };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const publicKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
  if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID public key format. Expected 65-byte uncompressed P-256 public key.');
  }

  const x = publicKeyBytes.slice(1, 33);
  const y = publicKeyBytes.slice(33, 65);
  const d = urlBase64ToUint8Array(vapidPrivateKey);

  if (d.length !== 32) {
    throw new Error('Invalid VAPID private key format. Expected 32 bytes.');
  }

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToUrlBase64(x),
    y: uint8ArrayToUrlBase64(y),
    d: uint8ArrayToUrlBase64(d),
    ext: true,
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = uint8ArrayToUrlBase64(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = await createWebPushBody(payload, subscription);
    
    // VAPID auth for Web Push
    const jwt = await generateVapidJwt(
      subscription.endpoint,
      vapidPrivateKey,
      vapidPublicKey,
      vapidSubject
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': `WebPush ${jwt}`,
        'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: body.buffer as ArrayBuffer,
    });
    
    if (response.ok || response.status === 201) {
      return { success: true };
    }
    
    const errorText = await response.text();
    console.error(`Push failed with status ${response.status}: ${errorText}`);
    
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============= Main Handler =============

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const payload: NotificationPayload = await req.json();
    console.log('Sending push notification:', payload);

    if (!payload.title || !payload.body) {
      throw new Error('Title and body are required');
    }

    const userIds = payload.user_ids || (payload.user_id ? [payload.user_id] : []);
    
    if (userIds.length === 0) {
      throw new Error('No user IDs provided');
    }

    // Get web push subscriptions
    const { data: webSubscriptions, error: webSubError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (webSubError) {
      console.error('Error fetching web subscriptions:', webSubError);
    }

    // Get native push tokens (FCM)
    const { data: nativeTokens, error: nativeError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .like('endpoint', 'fcm://%');

    if (nativeError) {
      console.error('Error fetching native tokens:', nativeError);
    }

    // Separate web push and FCM tokens
    const webSubs = (webSubscriptions || []).filter(
      (sub: PushSubscription) => !sub.endpoint.startsWith('fcm://')
    );
    const fcmSubs = (webSubscriptions || []).filter(
      (sub: PushSubscription) => sub.endpoint.startsWith('fcm://')
    );

    console.log(`Found ${webSubs.length} web subscriptions, ${fcmSubs.length} FCM tokens`);

    const results: Array<{ success: boolean; error?: string; user_id: string; type: string }> = [];

    // Send web push notifications
    if (webSubs.length > 0) {
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || 'UUxI0TsfQ0pZKZr4H_SqKwZ6dO6lJtfcbO3s';
      const vapidSubject = 'mailto:support@sslmarketplace.com';

      const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        data: payload.data,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction || false,
      });

      const webResults = await Promise.allSettled(
        webSubs.map(async (sub: PushSubscription) => {
          const result = await sendWebPushNotification(
            sub,
            notificationPayload,
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject
          );

          if (!result.success && result.error?.includes('410')) {
            console.log('Removing expired web subscription:', sub.id);
            await supabaseClient
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }

          return { ...result, user_id: sub.user_id, type: 'web' };
        })
      );

      webResults.forEach(r => {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({ success: false, error: 'Promise rejected', user_id: '', type: 'web' });
        }
      });
    }

    // Send FCM notifications for native mobile
    if (fcmSubs.length > 0) {
      const firebaseServiceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
      
      if (firebaseServiceAccountJson) {
        try {
          const serviceAccount: FirebaseServiceAccount = JSON.parse(firebaseServiceAccountJson);
          const accessToken = await generateFirebaseAccessToken(serviceAccount);
          
          const fcmResults = await Promise.allSettled(
            fcmSubs.map(async (sub: PushSubscription) => {
              // Extract FCM token from endpoint (format: fcm://token)
              const fcmToken = sub.endpoint.replace('fcm://', '');
              
              const result = await sendFCMNotification(
                fcmToken,
                payload.title,
                payload.body,
                payload.data,
                accessToken,
                serviceAccount.project_id
              );

              if (!result.success && result.error === 'TOKEN_EXPIRED') {
                console.log('Removing expired FCM token:', sub.id);
                await supabaseClient
                  .from('push_subscriptions')
                  .delete()
                  .eq('id', sub.id);
              }

              return { ...result, user_id: sub.user_id, type: 'fcm' };
            })
          );

          fcmResults.forEach(r => {
            if (r.status === 'fulfilled') {
              results.push(r.value);
            } else {
              results.push({ success: false, error: 'Promise rejected', user_id: '', type: 'fcm' });
            }
          });
        } catch (fcmError) {
          console.error('Error with FCM:', fcmError);
        }
      } else {
        console.warn('FIREBASE_SERVICE_ACCOUNT not configured, skipping FCM notifications');
      }
    }

    if (results.length === 0) {
      console.log('No subscriptions found for users:', userIds);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No subscriptions found',
          sent: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount} notifications successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: results.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-push-notification function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
