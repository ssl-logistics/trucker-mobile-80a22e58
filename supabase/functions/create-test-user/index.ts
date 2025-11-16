import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // สร้าง test user
    const testEmail = 'test@truckers.app';
    const testPassword = 'Test1234!';
    const testPhone = '0999999999';

    // ลบ user เก่าถ้ามี
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === testEmail);
    
    if (existingUser) {
      await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
    }

    // สร้าง user ใหม่
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        firstName: 'Test',
        lastName: 'User',
        phone: testPhone
      }
    });

    if (authError) throw authError;

    // สร้าง profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: 'Test User',
        phone_number: testPhone
      });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ 
        success: true,
        credentials: {
          email: testEmail,
          password: testPassword,
          phone: testPhone
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
