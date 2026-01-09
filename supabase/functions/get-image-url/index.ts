import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to create HMAC-SHA256
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

// Get AWS Signature Key
async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

// Helper to create SHA256 hash
async function sha256(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return new TextDecoder().decode(hexEncode(new Uint8Array(hashBuffer)));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      console.error('❌ AWS credentials not configured');
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { url, expiresIn = 604800 } = body; // Default 7 days (max for S3)

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔑 Generating presigned URL for:', url);

    // S3 Configuration
    const bucket = 'ssl-thetroob';
    const region = 'ap-southeast-1';
    const service = 's3';
    const host = `${bucket}.s3.${region}.amazonaws.com`;

    // Extract S3 key from URL
    let s3Key: string;
    
    if (url.includes(`${bucket}.s3.${region}.amazonaws.com/`)) {
      // Full S3 URL format
      s3Key = url.split(`${bucket}.s3.${region}.amazonaws.com/`)[1];
    } else if (url.includes('s3.amazonaws.com/')) {
      // Alternative S3 URL format
      s3Key = url.split('s3.amazonaws.com/')[1]?.split('/').slice(1).join('/') || url;
    } else if (url.startsWith('mobile/') || url.startsWith('/mobile/')) {
      // Direct key format
      s3Key = url.startsWith('/') ? url.substring(1) : url;
    } else {
      // Try to extract key from any URL pattern
      const urlParts = url.split('/');
      const mobileIndex = urlParts.findIndex((p: string) => p === 'mobile');
      if (mobileIndex !== -1) {
        s3Key = urlParts.slice(mobileIndex).join('/');
      } else {
        s3Key = url;
      }
    }

    // URL decode the key
    s3Key = decodeURIComponent(s3Key);

    console.log('📁 S3 Key:', s3Key);

    // Create presigned URL using AWS Signature Version 4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Credential scope
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${AWS_ACCESS_KEY_ID}/${credentialScope}`;

    // Query parameters for presigned URL
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': credential,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host',
    });

    // Sort query parameters
    const sortedParams = new URLSearchParams([...queryParams.entries()].sort());
    const canonicalQuerystring = sortedParams.toString();

    // Canonical URI (URL encode each segment)
    const canonicalUri = '/' + s3Key.split('/').map(segment => encodeURIComponent(segment)).join('/');

    // Canonical headers
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';

    // Payload hash for GET request
    const payloadHash = 'UNSIGNED-PAYLOAD';

    // Create canonical request
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const canonicalRequestHash = await sha256(canonicalRequest);
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    // Calculate signature
    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = new TextDecoder().decode(hexEncode(new Uint8Array(signatureBuffer)));

    // Create presigned URL
    const presignedUrl = `https://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;

    // Calculate expiration timestamp
    const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();

    console.log('✅ Presigned URL generated, expires at:', expiresAt);

    return new Response(
      JSON.stringify({
        success: true,
        presignedUrl,
        originalUrl: url,
        expiresAt,
        expiresIn
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error generating presigned URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
