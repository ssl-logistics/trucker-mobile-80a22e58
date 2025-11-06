import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Phone, MoreVertical, Send, Paperclip, Smile, Check, CheckCheck, Settings } from 'lucide-react';
import { ManageGroupSheet } from '@/components/chat/ManageGroupSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  name: string;
  type: string;
  avatar_url: string | null;
}

export default function ChatRoomPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showManageGroup, setShowManageGroup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && user) {
      loadConversation();
      loadMessages();
      subscribeToMessages();
      markMessagesAsRead();
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (data) {
      setConversation(data);
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_name: profile?.full_name || 'User',
        sender_avatar: profile?.avatar_url,
        content: newMessage,
        message_type: 'text'
      });

    if (error) {
      toast({
        title: t('chat.error'),
        description: t('chat.sendError'),
        variant: 'destructive'
      });
    } else {
      setNewMessage('');
    }
  };

  const handleMuteConversation = async () => {
    if (!user) return;

    await supabase
      .from('conversation_participants')
      .update({ is_muted: true })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    toast({
      title: t('chat.muted'),
      description: t('chat.mutedDesc')
    });
  };

  const handleDeleteConversation = async () => {
    if (!user) return;

    await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    navigate('/chat');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  if (!conversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-[#153860] text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate('/chat')} className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={conversation.avatar_url || ''} />
              <AvatarFallback className="bg-white/20">
                {conversation.name?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#153860]"></div>
            )}
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
          
          {conversation?.type === 'group' && (
            <button className="p-2" onClick={() => setShowManageGroup(true)}>
              <Settings className="w-5 h-5" />
            </button>
          )}
          
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
              <DropdownMenuItem 
                onClick={handleDeleteConversation}
                className="text-destructive"
              >
                {t('chat.deleteConversation')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && conversation.type === 'group' && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👋</div>
            <h3 className="font-bold text-lg mb-2">{conversation.name}</h3>
            <p className="text-muted-foreground text-sm">
              {t('chat.welcomeGroup')}
            </p>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.sender_id === user?.id;
          return (
            <div
              key={message.id}
              className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isOwn && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={message.sender_avatar || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {message.sender_name?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div
                  className={`rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-[#153860] text-white rounded-br-none'
                      : 'bg-accent text-foreground rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
                <div className="flex items-center gap-1 mt-1 px-2">
                  <span className="text-xs text-muted-foreground">
                    {formatTime(message.created_at)}
                  </span>
                  {isOwn && (
                    message.is_read ? (
                      <CheckCheck className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Check className="w-3 h-3 text-muted-foreground" />
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder={t('chat.typeMessage')}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-accent/30 border-none"
          />
          <button className="p-2 text-muted-foreground hover:text-foreground">
            <Paperclip className="w-5 h-5" />
          </button>
          <button className="p-2 text-muted-foreground hover:text-foreground">
            <Smile className="w-5 h-5" />
          </button>
          <Button
            onClick={handleSendMessage}
            size="icon"
            className="bg-primary hover:bg-primary/90"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {conversation?.type === 'group' && (
        <ManageGroupSheet
          open={showManageGroup}
          onOpenChange={setShowManageGroup}
          conversationId={conversationId!}
          conversationName={conversation?.name || ''}
        />
      )}
    </div>
  );
}
