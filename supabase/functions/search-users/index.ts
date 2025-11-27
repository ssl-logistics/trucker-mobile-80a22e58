import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchUsersRequest {
  query: string;
  limit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: SearchUsersRequest = await req.json();
    console.log('Search users request:', payload);

    if (!payload.query) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Query is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limit = payload.limit || 10;
    
    // Search for users by full_name or phone_number
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone_number, avatar_url')
      .or(`full_name.ilike.%${payload.query}%,phone_number.ilike.%${payload.query}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching users:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to search users' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users?.length || 0} users`);

    return new Response(
      JSON.stringify({ 
        success: true,
        users: users || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-users:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
