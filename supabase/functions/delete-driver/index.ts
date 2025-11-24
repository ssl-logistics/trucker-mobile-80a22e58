import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, driverCode } = await req.json();
    console.log('🗑️ Deleting driver:', { email, driverCode });

    if (!email) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required field: email is required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Get user by email and delete
    const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const user = userData.users.find((u) => u.email === email);
    
    if (!user) {
      console.log('⚠️ No auth user found for this email');
      return new Response(
        JSON.stringify({ 
          error: 'User not found with the provided email',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Delete user account
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.error('❌ Error deleting user account:', deleteError);
      throw new Error(`Failed to delete user account: ${deleteError.message}`);
    }

    console.log('✅ Deleted auth user:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Driver deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error in delete-driver function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
