import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[line-auth] 🔄 Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('[line-auth] ✅ CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[line-auth] 📥 Request body:', JSON.stringify({
      hasCode: !!body.code,
      hasAccessToken: !!body.accessToken,
      tokenPreview: body.accessToken ? body.accessToken.substring(0, 20) + '...' : null,
      redirectUri: body.redirectUri,
    }));

    const { code, redirectUri, accessToken: liffAccessToken } = body;

    if (!code && !liffAccessToken) {
      console.log('[line-auth] ❌ No code or accessToken provided');
      return new Response(
        JSON.stringify({ error: 'Authorization code or LIFF accessToken is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID');
    const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET');
    
    console.log('[line-auth] 🔑 Credentials check:', {
      hasChannelId: !!LINE_CHANNEL_ID,
      hasChannelSecret: !!LINE_CHANNEL_SECRET,
      channelIdPreview: LINE_CHANNEL_ID ? LINE_CHANNEL_ID.substring(0, 5) + '...' : null,
    });

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      console.log('[line-auth] ❌ Missing LINE credentials');
      return new Response(
        JSON.stringify({ error: 'LINE credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Exchange authorization code for access token
    console.log('[line-auth] 📡 Calling LINE token API...');
    console.log('[line-auth] 📡 Token request params:', {
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: LINE_CHANNEL_ID,
    });
    
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('[line-auth] 📡 Token response status:', tokenResponse.status);
    console.log('[line-auth] 📡 Token response:', JSON.stringify({
      hasAccessToken: !!tokenData.access_token,
      hasIdToken: !!tokenData.id_token,
      error: tokenData.error,
      errorDescription: tokenData.error_description,
    }));

    if (tokenData.error) {
      console.error('[line-auth] ❌ LINE token error:', JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ error: tokenData.error_description || 'Failed to get access token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token, id_token } = tokenData;

    // Step 2: Get user profile from LINE
    console.log('[line-auth] 📡 Calling LINE profile API...');
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const profile = await profileResponse.json();
    console.log('[line-auth] 📡 Profile response status:', profileResponse.status);
    console.log('[line-auth] 📡 Profile data:', JSON.stringify({
      userId: profile.userId,
      displayName: profile.displayName,
      hasPicture: !!profile.pictureUrl,
      hasStatus: !!profile.statusMessage,
      error: profile.error,
    }));

    if (profile.error) {
      console.error('[line-auth] ❌ LINE profile error:', JSON.stringify(profile));
      return new Response(
        JSON.stringify({ error: 'Failed to get user profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[line-auth] ✅ SUCCESS! User:', profile.displayName);

    // Return LINE user data
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          statusMessage: profile.statusMessage,
        },
        accessToken: access_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('LINE auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
