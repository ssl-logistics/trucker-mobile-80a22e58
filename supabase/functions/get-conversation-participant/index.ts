import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestPayload {
  conversation_id: string;
  external_sender_id?: string; // Optional: to exclude the external sender from results
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

    const payload: RequestPayload = await req.json();
    console.log('Get conversation participant request:', payload);

    // Validate required fields
    if (!payload.conversation_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'conversation_id is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, name, type')
      .eq('id', payload.conversation_id)
      .maybeSingle();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch conversation' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Conversation not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all participants
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id, joined_at')
      .eq('conversation_id', payload.conversation_id);

    if (partError) {
      console.error('Error fetching participants:', partError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch participants' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No participants found in this conversation' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get local users (users that exist in profiles table)
    const participantIds = participants.map(p => p.user_id);
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone_number')
      .in('id', participantIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch profiles' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only local users (those with profiles)
    const localUsers = profiles || [];
    
    // If external_sender_id provided, exclude that user's mapping
    let targetUsers = localUsers;
    if (payload.external_sender_id) {
      // Check if any of the local users is mapped to this external sender
      const { data: mapping } = await supabase
        .from('external_user_mapping')
        .select('local_user_id')
        .eq('external_user_id', payload.external_sender_id)
        .maybeSingle();
      
      if (mapping?.local_user_id) {
        targetUsers = localUsers.filter(u => u.id !== mapping.local_user_id);
      }
    }

    // Return the first local user as the recommended target
    const recommendedTarget = targetUsers.length > 0 ? targetUsers[0] : null;

    console.log('Found participants:', {
      total: participants.length,
      localUsers: localUsers.length,
      recommendedTarget: recommendedTarget?.id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation: {
          id: conversation.id,
          name: conversation.name,
          type: conversation.type
        },
        participants: {
          total: participants.length,
          local_users: localUsers.map(u => ({
            user_id: u.id,
            full_name: u.full_name,
            avatar_url: u.avatar_url
          }))
        },
        recommended_target: recommendedTarget ? {
          user_id: recommendedTarget.id,
          full_name: recommendedTarget.full_name,
          avatar_url: recommendedTarget.avatar_url
        } : null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-conversation-participant:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
