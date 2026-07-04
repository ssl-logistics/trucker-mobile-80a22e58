import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface IncomingMessage {
  chat_id: string;
  target_user_id?: string; // Target user ID in THIS project (recipient)
  target_user_email?: string; // Target user EMAIL in THIS project (alternative to target_user_id)
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
    file_url?: string; // URL to attached file (direct format)
    file_name?: string; // Original file name (direct format)
    file_size?: number; // File size in bytes (direct format)
    message_type?: string; // 'text', 'image', 'file'
    attachments?: Array<{ // Alternative format: array of attachments
      file_url: string;
      file_name: string;
      file_type?: string;
      file_size: number;
    }>;
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

    // IMPORTANT: Validate either target_user_id OR target_user_email is provided
    if (!payload.target_user_id && !payload.target_user_email) {
      console.error('Neither target_user_id nor target_user_email provided');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Either target_user_id or target_user_email is required to identify the recipient' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRIORITY: Use target_user_email as the primary method to identify recipient
    let targetUserId: string;
    
    if (payload.target_user_email) {
      console.log('Primary method: Resolving user_id from email:', payload.target_user_email);
      
      // Query auth.users to get user_id from email
      const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error fetching users:', authError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to resolve user from email' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const matchedUser = authUser.users.find(u => u.email === payload.target_user_email);
      
      if (!matchedUser) {
        console.error('No user found with email:', payload.target_user_email);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `No user found with email: ${payload.target_user_email}` 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      targetUserId = matchedUser.id;
      console.log('Resolved user_id from email:', targetUserId);
      
      // CRITICAL SECURITY CHECK: If both email and user_id are provided, verify they match
      if (payload.target_user_id && payload.target_user_id !== targetUserId) {
        console.error('Security violation: target_user_id does not match target_user_email');
        console.error(`Provided user_id: ${payload.target_user_id}, Email resolves to: ${targetUserId}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Security error: target_user_id and target_user_email do not match the same user. Please use target_user_email only.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (payload.target_user_id) {
      // Fallback: Use target_user_id directly (backward compatibility)
      console.log('Fallback method: Using target_user_id directly:', payload.target_user_id);
      targetUserId = payload.target_user_id;
    } else {
      // This should never happen due to earlier validation, but keeping for safety
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid user identifier provided' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that target_user_id exists in profiles table
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profileError || !targetProfile) {
      console.error('Target user not found:', targetUserId, profileError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Target user not found in this project' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validated target user exists:', targetUserId);

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
          user_id: targetUserId,
        });
      
      if (participantError) {
        console.error('Failed to add target participant:', participantError);
      } else {
        console.log('Added target participant:', targetUserId);
      }

      // Add SENDER as participant if local_user_id is provided
      if (payload.sender_info?.local_user_id) {
        const { error: senderParticipantError } = await supabase
          .from('conversation_participants')
          .insert({
            conversation_id: conversationId,
            user_id: payload.sender_info.local_user_id,
          });
        
        if (senderParticipantError) {
          console.error('Failed to add sender participant:', senderParticipantError);
        } else {
          console.log('Added sender participant:', payload.sender_info.local_user_id);
        }
      }
    } else {
      console.log('Found existing conversation:', existingConversation.id);
      
      // For existing conversations, verify target_user_id is already a participant
      // DO NOT add new participants to existing conversations - this prevents unauthorized access
      const { data: existingParticipant } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', existingConversation.id)
        .eq('user_id', targetUserId)
        .maybeSingle();
      
      if (!existingParticipant) {
        console.error('Target user is not a participant in this conversation:', targetUserId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Target user is not authorized for this conversation' 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Verified target user is participant:', targetUserId);
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
    // IMPORTANT: We store the sender's local_user_id (their ID in their project) as external_user_id
    // This is the ID we need to use when sending messages back to that user
    let userMappingId: string | null = null;
    
    // Priority: Use local_user_id (sender's ID in their project) for replies
    // Fallback to external_user_id or message.sender_id
    const senderIdInExternalProject = payload.sender_info?.local_user_id 
      || payload.sender_info?.external_user_id 
      || payload.message.sender_id;
    
    console.log('Storing sender ID for replies:', senderIdInExternalProject);
    
    const { data: existingMapping } = await supabase
      .from('external_user_mapping')
      .select('id, external_user_id')
      .eq('external_project_id', externalConfigId)
      .eq('external_user_id', senderIdInExternalProject)
      .maybeSingle();

    if (existingMapping) {
      userMappingId = existingMapping.id;
      console.log('Found existing mapping:', existingMapping.id);
    } else {
      const { data: newMapping, error: mappingError } = await supabase
        .from('external_user_mapping')
        .insert({
          external_project_id: externalConfigId,
          external_user_id: senderIdInExternalProject, // This is the ID to use when replying
          external_user_name: payload.sender_info?.name || payload.message.sender_name,
          external_user_avatar: payload.sender_info?.avatar_url || payload.message.sender_avatar,
          local_user_id: null, // This would be for linking to a local user if needed
        })
        .select('id')
        .single();

      if (newMapping) {
        userMappingId = newMapping.id;
        console.log('Created new mapping:', userMappingId, 'for external user:', senderIdInExternalProject);
      } else {
        console.error('Failed to create mapping:', mappingError);
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

    // Handle file attachments - support both direct format and attachments array
    let fileUrl = payload.message.file_url;
    let fileName = payload.message.file_name;
    let fileSize = payload.message.file_size;
    let messageType = payload.message.message_type || 'text';

    // If attachments array exists, use the first attachment
    if (payload.message.attachments && payload.message.attachments.length > 0) {
      const firstAttachment = payload.message.attachments[0];
      fileUrl = firstAttachment.file_url;
      fileName = firstAttachment.file_name;
      fileSize = firstAttachment.file_size;
      
      // Determine message type from file_type if not explicitly set
      if (!payload.message.message_type && firstAttachment.file_type) {
        if (firstAttachment.file_type.startsWith('image/')) {
          messageType = 'image';
        } else {
          messageType = 'file';
        }
      }
      
      console.log('Processing attachment:', { fileUrl, fileName, fileSize, messageType });
    }

    // Insert external_chat_message with file support
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
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        message_type: messageType,
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

    // Send push notification to target user via send-push-notification edge function
    try {
      console.log('Attempting to send push notification to user:', targetUserId);
      
      // Get the conversation name for notification
      const { data: convData } = await supabase
        .from('conversations')
        .select('name')
        .eq('id', conversationId)
        .maybeSingle();
      
      const notificationTitle = convData?.name || payload.message.sender_name || 'ข้อความใหม่';
      const notificationBody = payload.message.text 
        ? (payload.message.text.length > 100 
            ? payload.message.text.substring(0, 100) + '...' 
            : payload.message.text)
        : (payload.message.file_name ? `ส่งไฟล์: ${payload.message.file_name}` : 'ข้อความใหม่');

      // Call the send-push-notification edge function
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          user_id: targetUserId,
          title: notificationTitle,
          body: notificationBody,
          url: `/chat/${conversationId}`,
          tag: `chat-${conversationId}`,
          data: {
            conversationId,
            senderId: payload.message.sender_id,
            senderName: payload.message.sender_name,
          }
        }),
      });

      if (pushResponse.ok) {
        const pushResult = await pushResponse.json();
        console.log('Push notification result:', pushResult);
      } else {
        const errorText = await pushResponse.text();
        console.error('Failed to send push notification:', pushResponse.status, errorText);
      }
    } catch (notifError) {
      console.error('Error in push notification process:', notifError);
      // Don't fail the message insertion if notification fails
    }

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
