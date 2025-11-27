import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Conversation {
  id: string;
  name: string;
  type: string;
  avatar_url: string | null;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
  is_online?: boolean;
}
export default function ChatListPage() {
  const {
    t
  } = useLanguage();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    company: true,
    friends: true,
    groups: true
  });
  
  useEffect(() => {
    if (user) {
      loadConversations();
      subscribeToConversations();
    }
  }, [user]);
  const loadConversations = async () => {
    if (!user) return;

    // First get conversation IDs for the user
    const {
      data: participantData
    } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id);
    if (!participantData || participantData.length === 0) {
      setConversations([]);
      return;
    }
    const conversationIds = participantData.map(p => p.conversation_id);

    // Then get conversation details
    const {
      data: conversationData
    } = await supabase.from('conversations').select('id, name, type, avatar_url, updated_at').in('id', conversationIds);
    if (conversationData) {
      // Get last messages and unread counts (including external messages)
      const conversationsWithData = await Promise.all(conversationData.map(async (conv: any) => {
        // Get regular messages
        const {
          data: messages
        } = await supabase.from('messages').select('content, is_read, sender_id, created_at').eq('conversation_id', conv.id).order('created_at', {
          ascending: false
        }).limit(1);
        
        // Get external messages
        const {
          data: externalMessages
        } = await supabase.from('external_chat_messages').select('message_text, created_at, sender_name').eq('conversation_id', conv.id).order('created_at', {
          ascending: false
        }).limit(1);
        
        // Determine last message (from regular or external)
        let lastMessage = '';
        let lastMessageTime = conv.updated_at;
        
        if (messages?.[0] && externalMessages?.[0]) {
          const msgTime = new Date(messages[0].created_at).getTime();
          const extTime = new Date(externalMessages[0].created_at).getTime();
          if (extTime > msgTime) {
            lastMessage = externalMessages[0].message_text || '';
            lastMessageTime = externalMessages[0].created_at;
          } else {
            lastMessage = messages[0].content || '';
            lastMessageTime = messages[0].created_at;
          }
        } else if (externalMessages?.[0]) {
          lastMessage = externalMessages[0].message_text || '';
          lastMessageTime = externalMessages[0].created_at;
        } else if (messages?.[0]) {
          lastMessage = messages[0].content || '';
          lastMessageTime = messages[0].created_at;
        }
        
        const {
          count: unreadCount
        } = await supabase.from('messages').select('*', {
          count: 'exact',
          head: true
        }).eq('conversation_id', conv.id).eq('is_read', false).neq('sender_id', user.id);
        
        return {
          ...conv,
          last_message: lastMessage,
          unread_count: unreadCount || 0,
          updated_at: lastMessageTime,
          is_online: false
        };
      }));
      
      // Sort by updated_at descending
      conversationsWithData.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      setConversations(conversationsWithData);
    }
  };
  const subscribeToConversations = () => {
    const channel = supabase.channel('conversations_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        loadConversations();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'external_chat_messages'
      }, () => {
        loadConversations();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  };
  const toggleSection = (section: 'company' | 'friends' | 'groups') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const filteredConversations = conversations.filter(conv => conv.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const companyChats = filteredConversations.filter(c => c.type === 'company' || c.type === 'external');
  const friendChats = filteredConversations.filter(c => c.type === 'private' || c.type === 'individual');
  const groupChats = filteredConversations.filter(c => c.type === 'group');
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const renderConversationItem = (conv: Conversation) => <div key={conv.id} onClick={() => navigate(`/chat/${conv.id}`)} className="flex items-center gap-3 p-4 hover:bg-accent/50 cursor-pointer transition-colors">
      <div className="relative">
        <Avatar className="w-12 h-12">
          <AvatarImage src={conv.avatar_url || ''} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {conv.name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        {conv.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-foreground truncate">{conv.name}</h3>
          <span className="text-xs text-muted-foreground">
            {formatTime(conv.updated_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>
      </div>
      
      {(conv.unread_count || 0) > 0 && <Badge className="bg-red-500 text-white rounded-full min-w-[24px] h-6 flex items-center justify-center">
          {conv.unread_count}
        </Badge>}
    </div>;
  const renderSection = (title: string, count: number, conversations: Conversation[], sectionKey: 'company' | 'friends' | 'groups') => <div className="mb-4">
      <div onClick={() => toggleSection(sectionKey)} className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-accent/30 transition-colors">
        <h2 className="font-bold text-foreground">
          {title} ({count})
        </h2>
        {expandedSections[sectionKey] ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </div>
      {expandedSections[sectionKey] && <div className="divide-y divide-border">
          {conversations.map(renderConversationItem)}
        </div>}
    </div>;
  return <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-[#DDEDFF] text-white p-4 shadow-lg">
        <h1 className="text-xl font-semibold text-[#153860] text-center">{t('chat.title')}</h1>
      </div>
      
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input type="text" placeholder={t('chat.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-gray-300 border-none" />
        </div>
      </div>

      <div className="space-y-2">
        {renderSection(t('chat.company'), companyChats.length, companyChats, 'company')}
        {renderSection(t('chat.friends'), friendChats.length, friendChats, 'friends')}
        {renderSection(t('chat.groups'), groupChats.length, groupChats, 'groups')}
      </div>

      <BottomNavigation />
    </div>;
}