import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateAccountRequest {
  // OAuth fields
  authProvider?: 'line' | 'apple' | 'google';
  authUserId?: string; // Existing Supabase auth user ID (for Apple/Google)
  lineUserId?: string; // LINE-specific user ID
  // Traditional fields
  password?: string;
  // Common fields
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username?: string;
  plateNumber?: string;
  avatarUrl?: string;
  vehicleId?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  role?: 'freelance' | 'company' | 'factory';
  companyType?: 'freelance' | 'company' | 'factory';
}

const normalizePhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '66' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('66')) {
    cleaned = '66' + cleaned;
  }
  return '+' + cleaned;
};

const validateInput = (data: CreateAccountRequest): string | null => {
  if (!data.firstName || data.firstName.trim() === '') {
    return 'firstName is required';
  }
  if (!data.lastName || data.lastName.trim() === '') {
    return 'lastName is required';
  }
  if (!data.phone || data.phone.replace(/\D/g, '').length < 9) {
    return 'phone must be at least 9 digits';
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Invalid email format';
  }
  // Password required only for non-OAuth registration
  if (!data.authProvider && (!data.password || data.password.length < 6)) {
    return 'password must be at least 6 characters';
  }
  // OAuth registration requires authUserId
  if (data.authProvider && !data.authUserId) {
    return 'authUserId is required for OAuth registration';
  }
  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: CreateAccountRequest = await req.json();

    console.log('=== Received Create Account Request ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Auth Provider:', data.authProvider || 'email/password');

    const sanitizedData = {
      ...data,
      password: data.password ? `[${data.password.length} characters]` : undefined,
      authUserId: data.authUserId ? `[${data.authUserId.substring(0, 8)}...]` : undefined,
    };
    console.log('Request Data:', JSON.stringify(sanitizedData, null, 2));

    const validationError = validateInput(data);
    if (validationError) {
      console.error('Validation error:', validationError);
      return new Response(
        JSON.stringify({ status: 'error', message: 'Invalid input', details: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(data.phone);
    console.log('Normalized phone:', normalizedPhone);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let userId: string;

    if (data.authProvider && data.authUserId) {
      // ===== OAuth Registration: Link existing auth user =====
      console.log(`OAuth registration: provider=${data.authProvider}, userId=${data.authUserId}`);

      // Verify the user exists in auth.users
      const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(data.authUserId);
      if (getUserError || !existingUser?.user) {
        console.error('OAuth user not found:', getUserError);
        return new Response(
          JSON.stringify({ status: 'error', message: 'OAuth user not found', details: getUserError?.message || 'User does not exist' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = data.authUserId;
      console.log('✅ OAuth user verified, userId:', userId);

      // Update user metadata with registration info
      await supabaseAdmin.auth.admin.updateUser(userId, {
        user_metadata: {
          ...existingUser.user.user_metadata,
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.username,
        },
        phone: normalizedPhone,
        phone_confirm: true,
      });
    } else {
      // ===== Email/Password Registration =====
      console.log('Email/Password registration for:', data.email);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        phone: normalizedPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.username,
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ status: 'error', message: 'Failed to create user account', details: authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = authData.user.id;
      console.log('✅ User created successfully, userId:', userId);
    }

    // ===== Create/Update Profile =====
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    const profilePayload = {
      full_name: `${data.firstName} ${data.lastName}`,
      phone_number: normalizedPhone,
      avatar_url: data.avatarUrl || null,
      username: data.username || null,
      updated_at: new Date().toISOString(),
    };

    let profileError = null;
    if (existingProfile) {
      console.log('Profile exists, updating...');
      const { error } = await supabaseAdmin.from('profiles').update(profilePayload).eq('id', userId);
      profileError = error;
    } else {
      console.log('Creating new profile...');
      const { error } = await supabaseAdmin.from('profiles').insert({ id: userId, ...profilePayload });
      profileError = error;
    }

    if (profileError) {
      console.error('Profile error:', profileError);
      // Rollback only for email/password (we created the user)
      if (!data.authProvider) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ status: 'error', message: 'Failed to create user profile', details: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Profile created/updated');

    // ===== Assign Role =====
    const userRole = data.role || data.companyType || 'freelance';
    console.log(`Assigning role: ${userRole}`);
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: userRole }, { onConflict: 'user_id' });
    if (roleError) {
      console.error('Role assignment error:', roleError);
    } else {
      console.log('✅ Role assigned');
    }

    // ===== Bank Account =====
    if (data.bankName && data.bankAccountName && data.bankAccountNumber) {
      console.log('Adding bank account...');
      const { data: existingBank } = await supabaseAdmin
        .from('bank_accounts').select('id').eq('user_id', userId).single();

      const bankPayload = {
        bank_name: data.bankName,
        account_name: data.bankAccountName,
        account_number: data.bankAccountNumber,
      };

      if (existingBank) {
        const { error } = await supabaseAdmin.from('bank_accounts')
          .update({ ...bankPayload, updated_at: new Date().toISOString() }).eq('user_id', userId);
        if (error) console.error('Bank update error:', error);
        else console.log('✅ Bank account updated');
      } else {
        const { error } = await supabaseAdmin.from('bank_accounts')
          .insert({ user_id: userId, ...bankPayload });
        if (error) console.error('Bank insert error:', error);
        else console.log('✅ Bank account created');
      }
    }

    // ===== Vehicle Assignment =====
    if (data.vehicleId) {
      console.log('Assigning vehicle:', data.vehicleId);
      const { error } = await supabaseAdmin.from('vehicles').update({ driver_id: userId }).eq('id', data.vehicleId);
      if (error) console.error('Vehicle assignment error:', error);
      else console.log('✅ Vehicle assigned');
    }

    console.log('=== Account Created Successfully ===');
    console.log('User ID:', userId);
    console.log('Provider:', data.authProvider || 'email/password');

    return new Response(
      JSON.stringify({ status: 'success', userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
