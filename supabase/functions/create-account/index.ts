import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateAccountRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  vehicleId?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

const validateInput = (data: CreateAccountRequest): string | null => {
  if (!data.firstName || data.firstName.trim() === '') {
    return 'firstName is required';
  }
  if (!data.lastName || data.lastName.trim() === '') {
    return 'lastName is required';
  }
  if (!data.phone || data.phone.length < 10) {
    return 'phone must be at least 10 digits';
  }
  // Validate E.164 phone format (+66xxxxxxxxx)
  if (!data.phone.startsWith('+')) {
    return 'phone must be in E.164 format (e.g., +66825940196)';
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Invalid email format';
  }
  return null;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse incoming JSON data
    const data: CreateAccountRequest = await req.json();
    
    console.log('=== Received Create Account Request ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Data:', JSON.stringify(data, null, 2));
    
    // Validate input
    const validationError = validateInput(data);
    if (validationError) {
      console.error('Validation error:', validationError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid input',
          details: validationError
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if email already exists
    console.log('Checking if email already exists:', data.email);
    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (checkError) {
      console.error('Error checking existing users:', checkError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to check existing users',
          details: checkError.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const emailExists = existingUser?.users.some(user => user.email === data.email);
    if (emailExists) {
      console.log('Email already exists:', data.email);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Email already exists',
          details: 'A user with this email address has already been registered'
        }),
        {
          status: 409,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create user account in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      phone: data.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        firstName: data.firstName,
        lastName: data.lastName,
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to create user account',
          details: authError.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const userId = authData.user.id;
    console.log('Created user with ID:', userId);

    // Check if profile already exists (shouldn't happen, but handle it gracefully)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    let profileError = null;

    if (existingProfile) {
      console.log('Profile already exists, updating instead...');
      // Update existing profile
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: `${data.firstName} ${data.lastName}`,
          phone_number: data.phone,
          avatar_url: data.avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      profileError = error;
    } else {
      // Insert new profile
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          full_name: `${data.firstName} ${data.lastName}`,
          phone_number: data.phone,
          avatar_url: data.avatarUrl || null,
        });
      profileError = error;
    }

    if (profileError) {
      console.error('Profile error:', profileError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Failed to create user profile',
          details: profileError.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('Profile created/updated successfully');

    // Insert bank info if provided
    if (data.bankName && data.bankAccountName && data.bankAccountNumber) {
      console.log('Adding bank account information...');
      
      // Check if bank account already exists
      const { data: existingBank } = await supabaseAdmin
        .from('bank_accounts')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingBank) {
        // Update existing bank account
        const { error: bankError } = await supabaseAdmin
          .from('bank_accounts')
          .update({
            bank_name: data.bankName,
            account_name: data.bankAccountName,
            account_number: data.bankAccountNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (bankError) {
          console.error('Bank account update error:', bankError);
        } else {
          console.log('Bank account updated successfully');
        }
      } else {
        // Insert new bank account
        const { error: bankError } = await supabaseAdmin
          .from('bank_accounts')
          .insert({
            user_id: userId,
            bank_name: data.bankName,
            account_name: data.bankAccountName,
            account_number: data.bankAccountNumber,
          });

        if (bankError) {
          console.error('Bank account insert error:', bankError);
        } else {
          console.log('Bank account created successfully');
        }
      }
    }

    // Assign vehicle if provided
    if (data.vehicleId) {
      console.log('Assigning vehicle:', data.vehicleId);
      const { error: vehicleError } = await supabaseAdmin
        .from('vehicles')
        .update({ driver_id: userId })
        .eq('id', data.vehicleId);

      if (vehicleError) {
        console.error('Vehicle assignment error:', vehicleError);
      } else {
        console.log('Vehicle assigned successfully');
      }
    }

    console.log('=== Account Created Successfully ===');
    console.log('User ID:', userId);

    // Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        userId: userId
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
