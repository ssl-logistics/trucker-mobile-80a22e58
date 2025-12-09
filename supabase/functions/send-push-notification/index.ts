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

// Helper functions for web push encryption
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

// Generate ECDH key pair for encryption
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

// Export public key to uncompressed format
async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

// Derive shared secret using ECDH
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

// HKDF key derivation
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

// Create info for HKDF
function createInfo(type: string, context: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBuffer = encoder.encode(type);
  
  const info = new Uint8Array(typeBuffer.length + 1 + context.length);
  info.set(typeBuffer, 0);
  info.set([0], typeBuffer.length);
  info.set(context, typeBuffer.length + 1);
  
  return info;
}

// Encrypt payload using AES-128-GCM
async function encryptPayload(
  payload: string,
  subscription: PushSubscription
): Promise<{ encryptedPayload: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // Generate local ECDH key pair
  const localKeyPair = await generateECDHKeyPair();
  const localPublicKey = await exportPublicKey(localKeyPair.publicKey);
  
  // Get subscriber's public key
  const subscriberPublicKey = urlBase64ToUint8Array(subscription.p256dh);
  const authSecret = urlBase64ToUint8Array(subscription.auth);
  
  // Derive shared secret
  const sharedSecret = await deriveSharedSecret(localKeyPair.privateKey, subscriberPublicKey);
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Create context for key derivation
  const context = new Uint8Array(1 + 2 + 65 + 2 + 65);
  context[0] = 0; // P-256 curve indicator
  
  // Recipient public key length and value
  context[1] = 0;
  context[2] = 65;
  context.set(subscriberPublicKey, 3);
  
  // Sender public key length and value
  context[68] = 0;
  context[69] = 65;
  context.set(localPublicKey, 70);
  
  // Derive PRK using auth secret
  const prkInfo = encoder.encode('Content-Encoding: auth\0');
  const prk = await hkdf(authSecret, sharedSecret, prkInfo, 32);
  
  // Derive content encryption key
  const cekInfo = createInfo('Content-Encoding: aes128gcm', context);
  const contentEncryptionKey = await hkdf(salt, prk, cekInfo, 16);
  
  // Derive nonce
  const nonceInfo = createInfo('Content-Encoding: nonce', context);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);
  
  // Add padding (2 bytes for padding length + actual padding)
  const paddingLength = 0;
  const paddedPayload = new Uint8Array(2 + paddingLength + payloadBytes.length);
  paddedPayload[0] = (paddingLength >> 8) & 0xff;
  paddedPayload[1] = paddingLength & 0xff;
  paddedPayload.set(payloadBytes, 2 + paddingLength);
  
  // Encrypt using AES-GCM
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

// Create encrypted body for web push
async function createWebPushBody(
  payload: string,
  subscription: PushSubscription
): Promise<Uint8Array> {
  const { encryptedPayload, salt, localPublicKey } = await encryptPayload(payload, subscription);
  
  // aes128gcm content coding header
  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  
  // Salt (16 bytes)
  header.set(salt, 0);
  
  // Record size (4 bytes, big-endian)
  header[16] = (recordSize >> 24) & 0xff;
  header[17] = (recordSize >> 16) & 0xff;
  header[18] = (recordSize >> 8) & 0xff;
  header[19] = recordSize & 0xff;
  
  // Key ID length (1 byte) and key ID (public key, 65 bytes)
  header[20] = 65;
  header.set(localPublicKey, 21);
  
  // Combine header and encrypted payload
  const body = new Uint8Array(header.length + encryptedPayload.length);
  body.set(header, 0);
  body.set(encryptedPayload, header.length);
  
  return body;
}

// Generate VAPID JWT
async function generateVapidJwt(
  endpoint: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };
  
  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Create JWK for P-256 private key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
    x: vapidPublicKey.substring(0, 43),
    y: vapidPublicKey.substring(43),
  };
  
  try {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      privateKey,
      encoder.encode(unsignedToken)
    );
    
    const signatureB64 = uint8ArrayToUrlBase64(new Uint8Array(signature));
    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    console.error('Error generating VAPID JWT:', error);
    throw error;
  }
}

// Send push notification
async function sendPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create encrypted body
    const body = await createWebPushBody(payload, subscription);
    
    // Generate VAPID authorization
    const jwt = await generateVapidJwt(
      subscription.endpoint,
      vapidPrivateKey,
      vapidPublicKey,
      vapidSubject
    );
    
    const vapidHeader = `vapid t=${jwt}, k=${vapidPublicKey}`;
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': vapidHeader,
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Validate required fields
    if (!payload.title || !payload.body) {
      throw new Error('Title and body are required');
    }

    // Get user IDs to send to
    const userIds = payload.user_ids || (payload.user_id ? [payload.user_id] : []);
    
    if (userIds.length === 0) {
      throw new Error('No user IDs provided');
    }

    // Get subscriptions for the users
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
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

    console.log(`Found ${subscriptions.length} subscriptions`);

    // VAPID keys
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || 'UUxI0TsfQ0pZKZr4H_SqKwZ6dO6lJtfcbO3s';
    const vapidSubject = 'mailto:support@sslmarketplace.com';

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      data: payload.data,
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
    });

    // Send notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: PushSubscription) => {
        const result = await sendPushNotification(
          sub,
          notificationPayload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (!result.success && result.error?.includes('410')) {
          // Subscription expired, remove it
          console.log('Removing expired subscription:', sub.id);
          await supabaseClient
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }

        return { ...result, user_id: sub.user_id };
      })
    );

    const successCount = results.filter(
      r => r.status === 'fulfilled' && (r.value as { success: boolean }).success
    ).length;

    console.log(`Sent ${successCount} notifications successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
        results: results.map(r => 
          r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
        ),
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
