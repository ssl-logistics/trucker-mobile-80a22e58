import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutgoingMessage {
  conversation_id: string;
  external_project_id: string;
  target_user_id?: string; // Target user ID in the external project
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

    const payload: OutgoingMessage = await req.json();
    console.log('Sending message payload:', payload);

    // Validate required fields
    if (!payload.conversation_id || !payload.external_project_id || !payload.message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate target_user_id is required
    if (!payload.target_user_id) {
      console.error('target_user_id is required for sending to external project');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'target_user_id is required to identify the recipient in the external project' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation info for chat_info
    const { data: conversation } = await supabase
      .from('conversations')
      .select('name, avatar_url, type')
      .eq('id', payload.conversation_id)
      .maybeSingle();

    // Get sender profile for sender_info
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, phone_number')
      .eq('id', payload.message.sender_id)
      .maybeSingle();

    // Get sender's email from auth (using service role)
    const { data: { user: senderUser } } = await supabase.auth.admin.getUserById(payload.message.sender_id);

    // Get external project config
    const { data: externalConfig, error: configError } = await supabase
      .from('external_chat_config')
      .select('*')
      .eq('id', payload.external_project_id)
      .single();

    if (configError || !externalConfig) {
      console.error('External project config not found:', configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External project configuration not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!externalConfig.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External project is not active' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!externalConfig.target_url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Target URL not configured for external project' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare payload for external project
    const externalPayload = {
      chat_id: payload.conversation_id,
      target_user_id: payload.target_user_id,
      auto_create: true,
      chat_info: payload.chat_info || {
        name: senderProfile?.full_name || payload.message.sender_name,
        avatar_url: senderProfile?.avatar_url || payload.message.sender_avatar,
        type: conversation?.type || 'individual',
      },
      message: {
        id: payload.message.id,
        sender_id: payload.message.sender_id,
        sender_name: payload.message.sender_name,
        sender_avatar: payload.message.sender_avatar,
        text: payload.message.text,
        timestamp: payload.message.timestamp,
      },
      sender_info: {
        user_id: payload.message.sender_id,
        name: senderProfile?.full_name || payload.message.sender_name,
        avatar_url: senderProfile?.avatar_url || payload.message.sender_avatar,
        email: senderUser?.email,
        phone: senderProfile?.phone_number,
      },
      source_project: {
        id: supabaseUrl.split('//')[1].split('.')[0], // Extract project ID from URL
        name: 'Trucker Platform',
        callback_url: `${supabaseUrl}/functions/v1/receive-chat-message`,
      },
    };

    console.log('Sending external payload:', JSON.stringify(externalPayload, null, 2));

    // Send message to external project
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (externalConfig.api_key) {
      headers['Authorization'] = `Bearer ${externalConfig.api_key}`;
    }

    const response = await fetch(externalConfig.target_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(externalPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send message to external project:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to send message: ${response.status} ${response.statusText}`,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    console.log('Message sent successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent to external project',
        result
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-chat-message:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});