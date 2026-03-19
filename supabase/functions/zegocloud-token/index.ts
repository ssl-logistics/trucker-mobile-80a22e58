/**
 * ZegoCloud Token04 Generator Edge Function
 * 
 * Generates a Token04 for ZegoCloud authentication.
 * Uses AES-CBC encryption with the server secret.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Token04 generation using Web Crypto API
async function generateToken04(
  appId: number,
  userId: string,
  serverSecret: string,
  effectiveTimeInSeconds: number,
  payload: string = ''
): Promise<string> {
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  const tokenInfo = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce,
    ctime: createTime,
    expire: expireTime,
    payload: payload || '',
  });

  const plainTextBytes = new TextEncoder().encode(tokenInfo);

  // Generate random 16-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(16));

  // Import server secret as AES-CBC key (must be 32 bytes for AES-256 or 16 bytes for AES-128)
  // ZegoCloud server secrets are typically 32 hex chars = 32 bytes as UTF-8
  const secretBytes = new TextEncoder().encode(serverSecret);
  
  // Use first 16 or 32 bytes depending on secret length
  const keyLength = secretBytes.length >= 32 ? 32 : 16;
  const keyData = secretBytes.slice(0, keyLength);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  // PKCS7 padding is handled by Web Crypto API automatically
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      cryptoKey,
      plainTextBytes
    )
  );

  // Pack binary: [expireTime(8 bytes BE)] [ivLength(2 bytes BE)] [iv] [encryptedLength(2 bytes BE)] [encrypted]
  const totalSize = 8 + 2 + iv.length + 2 + encrypted.length;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  let offset = 0;

  // Expire time as 64-bit big-endian (write as two 32-bit values)
  view.setUint32(offset, 0); offset += 4; // high 32 bits (0 for reasonable timestamps)
  view.setUint32(offset, expireTime); offset += 4; // low 32 bits

  // IV length (2 bytes BE)
  view.setUint16(offset, iv.length); offset += 2;

  // IV
  buf.set(iv, offset); offset += iv.length;

  // Encrypted length (2 bytes BE)
  view.setUint16(offset, encrypted.length); offset += 2;

  // Encrypted data
  buf.set(encrypted, offset);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  const base64Token = btoa(binary);

  return '04' + base64Token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, effectiveTimeInSeconds = 3600 } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appIdStr = Deno.env.get('ZEGOCLOUD_APP_ID');
    const serverSecret = Deno.env.get('ZEGOCLOUD_SERVER_SECRET');

    if (!appIdStr || !serverSecret) {
      return new Response(
        JSON.stringify({ error: 'ZegoCloud credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appId = parseInt(appIdStr, 10);

    const token = await generateToken04(
      appId,
      userId,
      serverSecret,
      effectiveTimeInSeconds
    );

    return new Response(
      JSON.stringify({ token, appId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Token generation error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
