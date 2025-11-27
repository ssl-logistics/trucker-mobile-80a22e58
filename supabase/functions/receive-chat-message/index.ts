import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingMessage {
  chat_id: string;
  target_user_id?: string; // Target user ID in THIS project (recipient)
  auto_create?: boolean;
  chat_info?: {
    name?: string;
    avatar_url?: string;
    type?: string;
  };
  message: {
    id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string;
    text: string;
    timestamp: string;
  };
  sender_info?: {
    local_user_id?: string;
    external_user_id: string;
    name: string;
    avatar_url?: string;
    email?: string;
  };
  source_project: {
    id: string;
    name?: string;
    callback_url?: string;
  };
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

    const payload: IncomingMessage = await req.json();
    console.log('Received message payload:', payload);

    // Validate required fields
    if (!payload.chat_id || !payload.message || !payload.source_project) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: chat_id, message, or source_project' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPORTANT: Validate target_user_id is required for new conversations
    if (!payload.target_user_id) {
      console.error('No target_user_id provided - this is required to create conversation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'target_user_id is required to identify the recipient' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that target_user_id exists in profiles table
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', payload.target_user_id)
      .maybeSingle();

    if (profileError || !targetProfile) {
      console.error('Target user not found:', payload.target_user_id, profileError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Target user not found in this project' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validated target user exists:', payload.target_user_id);

    // Check if conversation exists, create if not
    let conversationId = payload.chat_id;
    let isNewConversation = false;
    
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', payload.chat_id)
      .maybeSingle();

    if (!existingConversation) {
      console.log('Conversation not found, creating new one...');
      isNewConversation = true;
      
      // Use chat_info if provided, otherwise use defaults
      const conversationName = payload.chat_info?.name 
        || (payload.source_project.name 
          ? `Chat from ${payload.source_project.name}` 
          : `External Chat - ${payload.message.sender_name}`);
      
      const conversationType = payload.chat_info?.type || 'external';
      
      const { data: newConversation, error: createConvError } = await supabase
        .from('conversations')
        .insert({
          id: payload.chat_id,
          name: conversationName,
          type: conversationType,
          avatar_url: payload.chat_info?.avatar_url,
        })
        .select('id')
        .single();

      if (createConvError) {
        console.error('Failed to create conversation:', createConvError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to create conversation' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      conversationId = newConversation.id;
      console.log('Created new conversation:', conversationId);
      
      // Add TARGET user as participant (the recipient in THIS project)
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversationId,
          user_id: payload.target_user_id,
        });
      
      if (participantError) {
        console.error('Failed to add target participant:', participantError);
      } else {
        console.log('Added target participant:', payload.target_user_id);
      }
    } else {
      console.log('Found existing conversation:', existingConversation.id);
      
      // For existing conversations, verify target_user_id is already a participant
      // DO NOT add new participants to existing conversations - this prevents unauthorized access
      const { data: existingParticipant } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', existingConversation.id)
        .eq('user_id', payload.target_user_id)
        .maybeSingle();
      
      if (!existingParticipant) {
        console.error('Target user is not a participant in this conversation:', payload.target_user_id);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Target user is not authorized for this conversation' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Verified target user is participant:', payload.target_user_id);
    }

    // Create or get external_chat_config
    let externalConfigId: string;
    const { data: existingConfig } = await supabase
      .from('external_chat_config')
      .select('id')
      .eq('project_id', payload.source_project.id)
      .maybeSingle();

    if (existingConfig) {
      externalConfigId = existingConfig.id;
    } else {
      const { data: newConfig, error: configError } = await supabase
        .from('external_chat_config')
        .insert({
          project_name: payload.source_project.name || 'External Project',
          project_id: payload.source_project.id,
          target_url: payload.source_project.callback_url || '',
        })
        .select('id')
        .single();

      if (configError || !newConfig) {
        console.error('Failed to create external_chat_config:', configError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to create external chat config' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      externalConfigId = newConfig.id;
    }

    // Create or get external_user_mapping
    let userMappingId: string | null = null;
    const externalUserId = payload.sender_info?.external_user_id || payload.message.sender_id;
    
    const { data: existingMapping } = await supabase
      .from('external_user_mapping')
      .select('id')
      .eq('external_project_id', externalConfigId)
      .eq('external_user_id', externalUserId)
      .maybeSingle();

    if (existingMapping) {
      userMappingId = existingMapping.id;
    } else {
      const { data: newMapping } = await supabase
        .from('external_user_mapping')
        .insert({
          external_project_id: externalConfigId,
          external_user_id: externalUserId,
          external_user_name: payload.sender_info?.name || payload.message.sender_name,
          external_user_avatar: payload.sender_info?.avatar_url || payload.message.sender_avatar,
          local_user_id: payload.sender_info?.local_user_id,
        })
        .select('id')
        .single();

      if (newMapping) {
        userMappingId = newMapping.id;
      }
    }

    // Check if message already exists (prevent duplicates)
    const { data: existingMessage } = await supabase
      .from('external_chat_messages')
      .select('id')
      .eq('external_project_id', externalConfigId)
      .eq('external_message_id', payload.message.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists, skipping insert');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message already received' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert external_chat_message
    const { data: insertedMessage, error: messageError } = await supabase
      .from('external_chat_messages')
      .insert({
        conversation_id: conversationId,
        external_project_id: externalConfigId,
        external_message_id: payload.message.id,
        sender_mapping_id: userMappingId,
        message_text: payload.message.text,
        sender_name: payload.message.sender_name,
        sender_avatar: payload.message.sender_avatar,
        created_at: payload.message.timestamp,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Failed to insert message:', messageError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to insert message' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message inserted successfully:', insertedMessage.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message received',
        message_id: insertedMessage.id,
        conversation_id: conversationId,
        is_new_conversation: isNewConversation
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in receive-chat-message:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
