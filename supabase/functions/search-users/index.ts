import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchUsersRequest {
  query?: string;
  email?: string;
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

    if (!payload.query && !payload.email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Query or email is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const limit = payload.limit || 10;
    let users: any[] = [];

    // If email is provided, search by email using admin API
    if (payload.email) {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
        perPage: limit,
      });

      if (authError) {
        console.error('Error searching auth users:', authError);
      } else if (authUsers?.users) {
        // Filter users by email match
        const matchingAuthUsers = authUsers.users.filter(u => 
          u.email?.toLowerCase().includes(payload.email!.toLowerCase())
        );

        // Get profiles for matching auth users
        if (matchingAuthUsers.length > 0) {
          const userIds = matchingAuthUsers.map(u => u.id);
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, phone_number, avatar_url')
            .in('id', userIds)
            .limit(limit);

          if (!profileError && profiles) {
            // Add email to each profile from auth users
            users = profiles.map(profile => {
              const authUser = matchingAuthUsers.find(u => u.id === profile.id);
              return {
                ...profile,
                email: authUser?.email || null
              };
            });
          }
        }
      }
    }
    
    // If query is provided, also search by name/phone
    if (payload.query) {
      const { data: profileUsers, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url')
        .or(`full_name.ilike.%${payload.query}%,phone_number.ilike.%${payload.query}%`)
        .limit(limit);

      if (error) {
        console.error('Error searching users by query:', error);
      } else if (profileUsers) {
        // Merge with existing users, avoiding duplicates
        for (const profile of profileUsers) {
          if (!users.find(u => u.id === profile.id)) {
            users.push(profile);
          }
        }
      }
    }

    console.log(`Found ${users.length} users`);

    return new Response(
      JSON.stringify({ 
        success: true,
        users: users.slice(0, limit)
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
