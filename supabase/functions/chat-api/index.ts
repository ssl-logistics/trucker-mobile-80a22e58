import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.77.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // GET - Retrieve conversations or messages
    if (req.method === 'GET') {
      if (action === 'conversations') {
        // Get user's conversations
        const { data: participants, error: participantsError } = await supabase
          .from('conversation_participants')
          .select('conversation_id, conversations(*)')
          .eq('user_id', user.id);

        if (participantsError) {
          console.error('Error fetching conversations:', participantsError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch conversations' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const conversations = participants?.map(p => p.conversations) || [];
        
        return new Response(
          JSON.stringify({ conversations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } 
      
      if (action === 'messages') {
        const conversationId = url.searchParams.get('conversationId');
        if (!conversationId) {
          return new Response(
            JSON.stringify({ error: 'conversationId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user is participant in conversation
        const { data: participant } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .single();

        if (!participant) {
          return new Response(
            JSON.stringify({ error: 'Not authorized to access this conversation' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get messages
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch messages' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ messages }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Send message
    if (req.method === 'POST') {
      const { conversationId, content, messageType, fileUrl, fileName, fileSize } = await req.json();

      if (!conversationId || !content) {
        return new Response(
          JSON.stringify({ error: 'conversationId and content are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user is participant in conversation
      const { data: participant } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (!participant) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to send messages to this conversation' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user profile for sender info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      // Insert message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_name: profile?.full_name || 'Unknown',
          sender_avatar: profile?.avatar_url,
          content,
          message_type: messageType || 'text',
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error sending message:', messageError);
        return new Response(
          JSON.stringify({ error: 'Failed to send message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ message }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
