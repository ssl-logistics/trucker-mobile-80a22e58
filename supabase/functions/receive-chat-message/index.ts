import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingMessage {
  chat_id: string;
  message: {
    id: string;
    sender_id: string;
    sender_name: string;
    sender_avatar?: string;
    text: string;
    timestamp: string;
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

    // Check if conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', payload.chat_id)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Conversation not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or get external_chat_config
    let externalConfigId: string;
    const { data: existingConfig } = await supabase
      .from('external_chat_config')
      .select('id')
      .eq('project_id', payload.source_project.id)
      .single();

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
    const { data: existingMapping } = await supabase
      .from('external_user_mapping')
      .select('id')
      .eq('external_project_id', externalConfigId)
      .eq('external_user_id', payload.message.sender_id)
      .single();

    if (existingMapping) {
      userMappingId = existingMapping.id;
    } else {
      const { data: newMapping } = await supabase
        .from('external_user_mapping')
        .insert({
          external_project_id: externalConfigId,
          external_user_id: payload.message.sender_id,
          external_user_name: payload.message.sender_name,
          external_user_avatar: payload.message.sender_avatar,
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
      .single();

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
        conversation_id: payload.chat_id,
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
        message_id: insertedMessage.id
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