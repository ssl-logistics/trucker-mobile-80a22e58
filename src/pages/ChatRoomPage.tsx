import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Phone, MoreVertical, Send, Paperclip, Smile, Check, CheckCheck, Settings } from 'lucide-react';
import { ManageGroupSheet } from '@/components/chat/ManageGroupSheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useCall } from '@/components/call/CallProvider';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  is_read: boolean;
  created_at: string;
  message_type?: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  is_external?: boolean; // Flag for external messages
}
interface Conversation {
  id: string;
  name: string;
  type: string;
  avatar_url: string | null;
}
interface ExternalChatInfo {
  external_project_id: string;
  target_user_id: string;
  target_url: string;
}

export default function ChatRoomPage() {
  const {
    conversationId
  } = useParams();
  const navigate = useNavigate();
  const {
    t
  } = useLanguage();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showManageGroup, setShowManageGroup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [externalChatInfo, setExternalChatInfo] = useState<ExternalChatInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (conversationId && user) {
      loadConversation();
      loadMessages();
      const cleanup = subscribeToMessages();
      markMessagesAsRead();
      return cleanup;
    }
  }, [conversationId, user]);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const loadConversation = async () => {
    const {
      data
    } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
    if (data) {
      setConversation(data);
      
      // If external/individual type, load external chat info for replies
      if (data.type === 'external' || data.type === 'individual') {
        await loadExternalChatInfo();
      }
    }
  };

  const loadExternalChatInfo = async () => {
    // Get the external message to find the source project and sender
    const { data: extMessages } = await supabase
      .from('external_chat_messages')
      .select('external_project_id, sender_mapping_id, sender_name, external_message_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (extMessages && extMessages.length > 0) {
      const extMsg = extMessages[0];
      
      // Get external project config
      const { data: projectConfig } = await supabase
        .from('external_chat_config')
        .select('id, target_url, project_id')
        .eq('id', extMsg.external_project_id)
        .maybeSingle();

      if (projectConfig) {
        let targetUserId: string | null = null;
        
        // Try to get target from sender_mapping_id first
        if (extMsg.sender_mapping_id) {
          const { data: senderMapping } = await supabase
            .from('external_user_mapping')
            .select('external_user_id')
            .eq('id', extMsg.sender_mapping_id)
            .maybeSingle();
          
          if (senderMapping) {
            targetUserId = senderMapping.external_user_id;
          }
        }
        
        // If no sender_mapping_id, try to find by external_user_name from the mapping table
        if (!targetUserId && extMsg.sender_name) {
          const { data: mappingByName } = await supabase
            .from('external_user_mapping')
            .select('external_user_id')
            .eq('external_project_id', extMsg.external_project_id)
            .eq('external_user_name', extMsg.sender_name)
            .maybeSingle();
          
          if (mappingByName) {
            targetUserId = mappingByName.external_user_id;
          }
        }
        
        // Last resort: get any user from the external project mapping
        if (!targetUserId) {
          const { data: anyMapping } = await supabase
            .from('external_user_mapping')
            .select('external_user_id')
            .eq('external_project_id', extMsg.external_project_id)
            .limit(1)
            .maybeSingle();
          
          if (anyMapping) {
            targetUserId = anyMapping.external_user_id;
          }
        }

        if (targetUserId) {
          setExternalChatInfo({
            external_project_id: projectConfig.id,
            target_user_id: targetUserId,
            target_url: projectConfig.target_url
          });
          console.log('Loaded external chat info:', {
            external_project_id: projectConfig.id,
            target_user_id: targetUserId
          });
        } else {
          console.log('Could not find target user for external chat');
        }
      }
    }
  };
  const loadMessages = async () => {
    // Load regular messages
    const { data: regularMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Load external messages
    const { data: externalMessages } = await supabase
      .from('external_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Combine and sort all messages
    const allMessages: Message[] = [];
    
    if (regularMessages) {
      allMessages.push(...regularMessages.map(msg => ({
        ...msg,
        is_external: false
      })));
    }
    
    if (externalMessages) {
      allMessages.push(...externalMessages.map(msg => ({
        id: msg.id,
        content: msg.message_text || '',
        sender_id: msg.sender_mapping_id || '',
        sender_name: msg.sender_name,
        sender_avatar: msg.sender_avatar,
        is_read: true,
        created_at: msg.created_at,
        message_type: msg.message_type || 'text',
        file_url: msg.file_url,
        file_name: msg.file_name,
        file_size: msg.file_size,
        is_external: true
      })));
    }

    // Sort by created_at
    allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    setMessages(allMessages);
  };
  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages_${conversationId}`)
      // Subscribe to regular messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, payload => {
        const newMsg = payload.new as Message;
        newMsg.is_external = false;
        // Only add if not already in messages (avoid duplicates from optimistic updates)
        setMessages(prev => {
          const exists = prev.some(m => 
            m.id === newMsg.id || 
            (m.sender_id === newMsg.sender_id && 
             m.content === newMsg.content && 
             Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 1000)
          );
          if (exists) {
            return prev.map(m => 
              m.id.startsWith('temp-') && m.content === newMsg.content ? newMsg : m
            );
          }
          return [...prev, newMsg].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      })
      // Subscribe to external messages
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'external_chat_messages',
        filter: `conversation_id=eq.${conversationId}`
      }, payload => {
        const extMsg = payload.new as any;
        const newMsg: Message = {
          id: extMsg.id,
          content: extMsg.message_text || '',
          sender_id: extMsg.sender_mapping_id || '',
          sender_name: extMsg.sender_name,
          sender_avatar: extMsg.sender_avatar,
          is_read: true,
          created_at: extMsg.created_at,
          message_type: extMsg.message_type || 'text',
          file_url: extMsg.file_url,
          file_name: extMsg.file_name,
          file_size: extMsg.file_size,
          is_external: true
        };
        
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };
  const markMessagesAsRead = async () => {
    if (!user) return;
    await supabase.from('messages').update({
      is_read: true
    }).eq('conversation_id', conversationId).neq('sender_id', user.id).eq('is_read', false);
  };
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !conversationId) return;

    // Check file size (10MB limit)
    if (file.size > 10485760) {
      toast({
        title: t('chat.error'),
        description: t('toast.fileTooLarge'),
        variant: 'destructive'
      });
      return;
    }
    setIsUploading(true);
    toast({
      title: t('toast.uploadingFile'),
      description: file.name
    });
    try {
      const {
        data: profile
      } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const {
        error: uploadError
      } = await supabase.storage.from('chat-attachments').upload(fileName, file);
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('chat-attachments').getPublicUrl(fileName);

      // Send message with file attachment
      const { data: insertedMessage, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_name: profile?.full_name || 'User',
        sender_avatar: profile?.avatar_url,
        content: file.name,
        message_type: 'file',
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size
      }).select('id').single();
      if (error || !insertedMessage) {
        console.error('Message insert error:', error);
        throw error;
      }
      toast({
        title: t('toast.fileSentSuccess'),
        description: file.name
      });

      // If this is an external conversation, also send file to external project
      if (externalChatInfo) {
        try {
          const { error: sendError } = await supabase.functions.invoke('send-chat-message', {
            body: {
              conversation_id: conversationId,
              external_project_id: externalChatInfo.external_project_id,
              target_user_id: externalChatInfo.target_user_id,
              message: {
                id: insertedMessage.id,
                sender_id: user.id,
                sender_name: profile?.full_name || 'User',
                sender_avatar: profile?.avatar_url,
                text: file.name,
                timestamp: new Date().toISOString(),
                message_type: file.type.startsWith('image/') ? 'image' : 'file',
                file_url: publicUrl,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
              },
            },
          });

          if (sendError) {
            console.error('Failed to send file to external project:', sendError);
          } else {
            console.log('File sent to external project successfully');
          }
        } catch (err) {
          console.error('Error invoking send-chat-message for file:', err);
        }
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('File upload failed:', error);
      toast({
        title: t('toast.fileSentError'),
        description: t('toast.tryAgain'),
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return;
    const messageContent = newMessage;
    setNewMessage('');
    const {
      data: profile
    } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      sender_name: profile?.full_name || 'User',
      sender_avatar: profile?.avatar_url,
      content: messageContent,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);
    
    const {
      data: insertedMessage,
      error
    } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: profile?.full_name || 'User',
      sender_avatar: profile?.avatar_url,
      content: messageContent,
      message_type: 'text'
    }).select('id').single();
    
    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageContent);
      toast({
        title: t('chat.error'),
        description: t('chat.sendError'),
        variant: 'destructive'
      });
      return;
    }

    // If this is an external conversation, also send to external project
    if (externalChatInfo && insertedMessage) {
      try {
        const { error: sendError } = await supabase.functions.invoke('send-chat-message', {
          body: {
            conversation_id: conversationId,
            external_project_id: externalChatInfo.external_project_id,
            target_user_id: externalChatInfo.target_user_id,
            message: {
              id: insertedMessage.id,
              sender_id: user.id,
              sender_name: profile?.full_name || 'User',
              sender_avatar: profile?.avatar_url,
              text: messageContent,
              timestamp: new Date().toISOString()
            }
          }
        });
        
        if (sendError) {
          console.error('Failed to send to external project:', sendError);
          // Don't show error toast since local message was saved successfully
        } else {
          console.log('Message sent to external project successfully');
        }
      } catch (err) {
        console.error('Error invoking send-chat-message:', err);
      }
    }
  };
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };
  const handleMuteConversation = async () => {
    if (!user) return;
    await supabase.from('conversation_participants').update({
      is_muted: true
    }).eq('conversation_id', conversationId).eq('user_id', user.id);
    toast({
      title: t('chat.muted'),
      description: t('chat.mutedDesc')
    });
  };
  const handleDeleteConversation = async () => {
    if (!user) return;
    await supabase.from('conversation_participants').delete().eq('conversation_id', conversationId).eq('user_id', user.id);
    navigate('/chat');
  };
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  if (!conversation) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#153860] text-white shadow-md page-header-safe">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => navigate('/chat')} className="p-1">
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={conversation.avatar_url || ''} />
                <AvatarFallback className="bg-white/20">
                  {conversation.name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#153860]"></div>}
            </div>
            
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold truncate">{conversation.name}</h2>
              <p className="text-xs text-white/70">
                {isOnline ? t('chat.online') : t('chat.offline')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2">
              <Phone className="w-5 h-5" />
            </button>
            
            {conversation?.type === 'group' && <button className="p-2" onClick={() => setShowManageGroup(true)}>
                <Settings className="w-5 h-5" />
              </button>}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleMuteConversation}>
                  {t('chat.muteNotifications')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteConversation} className="text-destructive">
                  {t('chat.deleteConversation')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && conversation.type === 'group' && <div className="text-center py-12">
            <div className="text-6xl mb-4">👋</div>
            <h3 className="font-bold text-lg mb-2">{conversation.name}</h3>
            <p className="text-muted-foreground text-sm">
              {t('chat.welcomeGroup')}
            </p>
          </div>}

        {messages.map(message => {
        const isOwn = message.sender_id === user?.id && !message.is_external;
        return <div key={message.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isOwn && <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={message.sender_avatar || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {message.sender_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>}
              
              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {message.file_url ? <div className={`rounded-2xl overflow-hidden ${isOwn ? 'bg-[#153860] text-white rounded-br-none' : 'bg-accent text-foreground rounded-bl-none'}`}>
                    {message.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <div>
                        <img src={message.file_url} alt={message.file_name} className="max-w-[250px] max-h-[250px] object-cover" />
                        <div className="px-3 py-2">
                          <p className="text-xs opacity-80">{message.file_name}</p>
                        </div>
                      </div> : <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 hover:opacity-80 transition-opacity">
                        <div className="p-2 bg-white/10 rounded-lg">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{message.file_name}</p>
                          {message.file_size && <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>}
                        </div>
                      </a>}
                  </div> : <div className={`rounded-2xl px-4 py-2 ${isOwn ? 'bg-[#153860] text-white rounded-br-none' : 'bg-accent text-foreground rounded-bl-none'}`}>
                    <p className="text-sm">{message.content}</p>
                  </div>}
                <div className="flex items-center gap-1 mt-1 px-2">
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.created_at)}
                  </span>
                  {isOwn && (message.is_read ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3 text-muted-foreground" />)}
                </div>
              </div>
            </div>;
      })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 p-4 bg-background border-t border-border shadow-lg">
        <div className="flex items-center gap-2">
          <Input type="text" placeholder={t('chat.typeMessage')} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} disabled={isUploading} className="flex-1 bg-gray/30 border  rounded-full" />
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50 relative">
            {isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <button className="p-2 text-muted-foreground hover:text-foreground">
                <Smile className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 border-none" align="end">
              <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" height="400px" />
            </PopoverContent>
          </Popover>
          <Button onClick={handleSendMessage} size="icon" className="bg-primary hover:bg-primary/90 rounded-full" disabled={isUploading || !newMessage.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {conversation?.type === 'group' && <ManageGroupSheet open={showManageGroup} onOpenChange={setShowManageGroup} conversationId={conversationId!} conversationName={conversation?.name || ''} />}
    </div>;
}