import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to create SHA256 hash
async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hashBuffer)));
}

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

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'profile';
    const fileName = formData.get('fileName') as string;
    const overwriteKey = formData.get('overwriteKey') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // S3 Configuration
    const bucket = 'ssl-thetroob';
    const region = 'ap-southeast-1';
    const service = 's3';
    
    // Use overwriteKey if provided (to replace existing file at same URL),
    // otherwise generate a new unique file name
    let s3Key: string;
    if (overwriteKey) {
      s3Key = overwriteKey;
      console.log('📤 Overwriting existing S3 file:', { s3Key, fileType: file.type, fileSize: file.size });
    } else {
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const finalFileName = fileName || `${timestamp}.${extension}`;
      s3Key = `mobile/${folder}/${finalFileName}`;
      console.log('📤 Uploading new file to S3:', { s3Key, fileType: file.type, fileSize: file.size });
    }

    // Convert file to array buffer
    const body = await file.arrayBuffer();

    // Create date strings
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    // Create canonical request
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const canonicalUri = '/' + s3Key;
    const canonicalQuerystring = '';
    const payloadHash = await sha256(body);
    
    const canonicalHeaders = 
      `content-type:${file.type}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = 
      'PUT\n' +
      canonicalUri + '\n' +
      canonicalQuerystring + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      payloadHash;

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest).buffer);
    
    const stringToSign = 
      algorithm + '\n' +
      amzDate + '\n' +
      credentialScope + '\n' +
      canonicalRequestHash;

    // Calculate signature
    const signingKey = await getSignatureKey(AWS_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = new TextDecoder().decode(hexEncode(new Uint8Array(signatureBuffer)));

    // Create authorization header
    const authorizationHeader = 
      `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`;

    // Make PUT request to S3
    const s3Url = `https://${host}${canonicalUri}`;
    
    const s3Response = await fetch(s3Url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Host': host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorizationHeader,
      },
      body: body,
    });

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      console.error('❌ S3 upload failed:', s3Response.status, errorText);
      return new Response(
        JSON.stringify({ error: `S3 upload failed: ${s3Response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct public URL
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
    
    console.log('✅ File uploaded successfully:', publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: publicUrl,
        key: s3Key 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error uploading to S3:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
