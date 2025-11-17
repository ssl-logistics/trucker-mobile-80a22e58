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
  profileImage?: string;
  assignedCarId?: string;
  bankInfo?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
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

    // Insert profile data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: `${data.firstName} ${data.lastName}`,
        phone_number: data.phone,
        avatar_url: data.profileImage || null,
      });

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

    // Insert bank info if provided
    if (data.bankInfo) {
      const { error: bankError } = await supabaseAdmin
        .from('bank_accounts')
        .insert({
          user_id: userId,
          bank_name: data.bankInfo.bankName,
          account_name: data.bankInfo.accountName,
          account_number: data.bankInfo.accountNumber,
        });

      if (bankError) {
        console.error('Bank info error:', bankError);
        // Continue anyway, bank info is optional
      }
    }

    // Assign vehicle if provided
    if (data.assignedCarId) {
      const { error: vehicleError } = await supabaseAdmin
        .from('vehicles')
        .update({ driver_id: userId })
        .eq('id', data.assignedCarId);

      if (vehicleError) {
        console.error('Vehicle assignment error:', vehicleError);
        // Continue anyway, vehicle assignment is optional
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
