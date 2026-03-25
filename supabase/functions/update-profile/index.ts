import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | undefined | null): value is string => {
  return typeof value === 'string' && UUID_REGEX.test(value);
};

const resolveLineAuthUserId = async (
  adminClient: ReturnType<typeof createClient>,
  lineUserId: string
): Promise<string | null> => {
  const normalizedLineUserId = lineUserId.replace(/^line_/i, '');
  const possibleEmails = new Set([
    `line_${normalizedLineUserId.toLowerCase()}@line.oauth.local`,
    `${normalizedLineUserId.toLowerCase()}@line.user`,
  ]);

  const { data: byLineId } = await adminClient
    .schema('auth')
    .from('users')
    .select('id')
    .eq('raw_user_meta_data->>lineUserId', lineUserId)
    .limit(1)
    .maybeSingle();

  if (byLineId?.id) {
    return byLineId.id;
  }

  for (const email of possibleEmails) {
    const { data: byEmail } = await adminClient
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (byEmail?.id) {
      return byEmail.id;
    }
  }

  return null;
};

const resolveProfileIdFromLookups = async (
  adminClient: ReturnType<typeof createClient>,
  lookupUsername?: string,
  lookupFullName?: string,
  lookupPhoneNumber?: string
): Promise<string | null> => {
  const username = lookupUsername?.trim();
  const fullName = lookupFullName?.trim();
  const phoneNumber = lookupPhoneNumber?.trim();

  if (username) {
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  if (fullName && phoneNumber) {
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .eq('full_name', fullName)
      .eq('phone_number', phoneNumber)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  if (fullName) {
    const { data } = await adminClient
      .from('profiles')
      .select('id')
      .eq('full_name', fullName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'PUT') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      user_id,
      full_name,
      phone_number,
      avatar_url,
      auth_provider,
      auth_user_id,
      line_user_id,
      lookup_username,
      lookup_full_name,
      lookup_phone_number,
    } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS (needed for LINE/Apple OAuth users)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let targetUserId = typeof user_id === 'string' ? user_id : '';

    if (isUuid(auth_user_id)) {
      targetUserId = auth_user_id;
    }

    if (!isUuid(targetUserId)) {
      const resolvedByLookups = await resolveProfileIdFromLookups(
        adminClient,
        lookup_username,
        lookup_full_name,
        lookup_phone_number
      );

      if (resolvedByLookups) {
        targetUserId = resolvedByLookups;
        console.log('Resolved profile id from lookup fields:', targetUserId);
      }
    }

    if (!isUuid(targetUserId)) {
      const isLikelyLineFlow = auth_provider === 'line' || !!line_user_id || /^U[a-zA-Z0-9]+$/.test(targetUserId);
      if (isLikelyLineFlow) {
        const lineIdToResolve =
          (typeof line_user_id === 'string' && line_user_id) ||
          (typeof auth_user_id === 'string' && auth_user_id) ||
          targetUserId;

        const resolvedAuthId = await resolveLineAuthUserId(adminClient, lineIdToResolve);
        if (resolvedAuthId) {
          targetUserId = resolvedAuthId;
          console.log('Resolved LINE user id to auth UUID:', targetUserId);
        }
      }
    }

    if (!isUuid(targetUserId)) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve profile user id to UUID', original_user_id: user_id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updates.full_name = full_name;
    if (phone_number !== undefined) updates.phone_number = phone_number;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    console.log('Updating profile for user:', targetUserId, 'with:', JSON.stringify(updates));

    const { data, error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data, resolved_user_id: targetUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
