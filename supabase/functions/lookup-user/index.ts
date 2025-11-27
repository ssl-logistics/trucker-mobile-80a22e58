import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LookupRequest {
  email?: string;
  phone?: string;
  name?: string;
  source_project_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: LookupRequest = await req.json();
    console.log('Lookup request:', payload);

    // Validate source_project_id
    if (!payload.source_project_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'source_project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // At least one search criteria is required
    if (!payload.email && !payload.phone && !payload.name) {
      return new Response(
        JSON.stringify({ success: false, error: 'At least one of email, phone, or name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search in auth.users for email
    let userId: string | null = null;
    let userInfo: any = null;

    if (payload.email) {
      // Search by email in auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      if (!authError && authData?.users) {
        const foundUser = authData.users.find(u => u.email?.toLowerCase() === payload.email?.toLowerCase());
        if (foundUser) {
          userId = foundUser.id;
          
          // Get profile info
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number, avatar_url')
            .eq('id', foundUser.id)
            .single();
          
          userInfo = {
            id: foundUser.id,
            email: foundUser.email,
            full_name: profile?.full_name,
            phone_number: profile?.phone_number,
            avatar_url: profile?.avatar_url,
          };
        }
      }
    }

    // If not found by email, search by phone in profiles
    if (!userId && payload.phone) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url')
        .eq('phone_number', payload.phone)
        .single();
      
      if (profile) {
        userId = profile.id;
        userInfo = {
          id: profile.id,
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          avatar_url: profile.avatar_url,
        };
      }
    }

    // If not found, search by name (partial match)
    if (!userId && payload.name) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number, avatar_url')
        .ilike('full_name', `%${payload.name}%`)
        .limit(10);
      
      if (profiles && profiles.length > 0) {
        // Return multiple matches for name search
        return new Response(
          JSON.stringify({
            success: true,
            users: profiles.map(p => ({
              id: p.id,
              full_name: p.full_name,
              phone_number: p.phone_number,
              avatar_url: p.avatar_url,
            })),
            message: `Found ${profiles.length} user(s) matching name "${payload.name}"`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found', users: [] }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found user:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        user: userInfo,
        target_user_id: userId,
        message: 'User found. Use target_user_id when sending messages.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in lookup-user:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
