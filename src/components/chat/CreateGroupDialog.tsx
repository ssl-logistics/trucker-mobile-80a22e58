import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open]);

  const loadMembers = async () => {
    if (!user) return;

    // Load all profiles except current user
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .neq('id', user.id);

    if (data) {
      setMembers(data);
    }
  };

  const toggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleCreateGroup = async () => {
    if (!user) {
      console.log('❌ No user found');
      return;
    }
    
    console.log('🔍 User info:', { userId: user.id, email: user.email });
    
    if (!groupName.trim()) {
      toast({
        title: t('chat.error'),
        description: t('chat.groupNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    if (selectedMembers.size === 0) {
      toast({
        title: t('chat.error'),
        description: t('chat.selectMembersRequired'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('🔑 Session check:', { 
        hasSession: !!sessionData?.session,
        sessionError,
        userId: sessionData?.session?.user?.id
      });

      // Create conversation
      console.log('📝 Attempting to create conversation:', { name: groupName, type: 'group' });
      
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: groupName,
          type: 'group',
        })
        .select()
        .single();

      console.log('📊 Conversation creation result:', { conversation, error: convError });

      if (convError) throw convError;

      // Add current user as participant
      const participants = [
        { conversation_id: conversation.id, user_id: user.id },
        ...Array.from(selectedMembers).map(memberId => ({
          conversation_id: conversation.id,
          user_id: memberId,
        })),
      ];

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      // Create welcome message
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_name: profile?.full_name || '',
        sender_avatar: profile?.avatar_url,
        content: t('chat.groupCreated'),
        message_type: 'text',
      });

      toast({
        title: t('chat.success'),
        description: t('chat.groupCreatedSuccess'),
      });

      onOpenChange(false);
      setGroupName('');
      setSelectedMembers(new Set());
      navigate(`/chat/${conversation.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: t('chat.error'),
        description: t('chat.groupCreatedError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member =>
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('chat.createGroup')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="groupName">{t('chat.groupName')}</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('chat.groupNamePlaceholder')}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t('chat.selectMembers')}</Label>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat.searchMembers')}
              className="mt-1 mb-2"
            />
            <ScrollArea className="h-64 border rounded-md p-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-3 p-2 hover:bg-accent rounded-md cursor-pointer"
                  onClick={() => toggleMember(member.id)}
                >
                  <Checkbox
                    checked={selectedMembers.has(member.id)}
                    onCheckedChange={() => toggleMember(member.id)}
                  />
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.full_name[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{member.full_name}</span>
                </div>
              ))}
              {filteredMembers.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  {t('chat.noMembersFound')}
                </div>
              )}
            </ScrollArea>
            <p className="text-sm text-muted-foreground mt-2">
              {t('chat.selectedCount')}: {selectedMembers.size}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('chat.cancel')}
          </Button>
          <Button onClick={handleCreateGroup} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('chat.creating')}
              </>
            ) : (
              t('chat.create')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
