import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, driverCode } = await req.json();

    if (!email || !driverCode) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: email and driverCode are required',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log('Processing delete driver request:', { email, driverCode });

    // Create admin client
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

    // Get user by email
    const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error listing users:', getUserError);
      throw new Error(`Failed to list users: ${getUserError.message}`);
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.log('User not found with email:', email);
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

    console.log('Found user:', user.id);

    // Delete from internal_drivers table
    const { error: deleteDriverError } = await supabaseAdmin
      .from('internal_drivers')
      .delete()
      .eq('driver_code', driverCode);

    if (deleteDriverError) {
      console.error('Error deleting from internal_drivers:', deleteDriverError);
      throw new Error(`Failed to delete driver data: ${deleteDriverError.message}`);
    }

    console.log('Deleted driver data for code:', driverCode);

    // Delete user account
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('Error deleting user account:', deleteUserError);
      throw new Error(`Failed to delete user account: ${deleteUserError.message}`);
    }

    console.log('Deleted user account:', user.id);

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
    console.error('Error in delete-driver function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? { stack: error.stack } : {}
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
