import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTestUserRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role?: 'freelance' | 'company' | 'factory';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const body: CreateTestUserRequest = await req.json();
    
    const testEmail = body.email || 'test@truckers.app';
    const testPassword = body.password || 'Test1234!';
    const testPhone = body.phoneNumber || '0999999999';
    const fullName = body.fullName || 'Test User';
    const role = body.role || 'freelance';

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === testEmail);
    
    if (existingUser) {
      // User already exists, return their info
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User already exists',
          credentials: {
            email: testEmail,
            userId: existingUser.id
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Create new user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        fullName: fullName,
        phone: testPhone
      }
    });

    if (authError) throw authError;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: fullName,
        phone_number: testPhone
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      throw profileError;
    }

    // Create user role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authData.user.id,
        role: role
      });

    if (roleError) {
      console.error('Role error:', roleError);
      throw roleError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        credentials: {
          email: testEmail,
          password: testPassword,
          phone: testPhone,
          userId: authData.user.id,
          role: role
        },
        message: 'Test user created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
