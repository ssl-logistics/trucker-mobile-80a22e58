import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { UserPlus, UserMinus, Loader2, Save } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Participant {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Member {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ManageGroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationName: string;
}

export function ManageGroupSheet({
  open,
  onOpenChange,
  conversationId,
  conversationName,
}: ManageGroupSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [groupName, setGroupName] = useState(conversationName);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      setGroupName(conversationName);
      loadParticipants();
      loadAvailableMembers();
    }
  }, [open, conversationId, conversationName]);

  const loadParticipants = async () => {
    const { data } = await supabase
      .from('conversation_participants')
      .select(`
        id,
        user_id,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId);

    if (data) {
      setParticipants(data as any);
    }
  };

  const loadAvailableMembers = async () => {
    if (!user) return;

    // Get current participants
    const { data: currentParticipants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    const participantIds = currentParticipants?.map(p => p.user_id) || [];

    // Get all profiles except current participants
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .not('id', 'in', `(${participantIds.join(',')})`);

    if (data) {
      setAvailableMembers(data);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!groupName.trim()) {
      toast({
        title: t('chat.error'),
        description: t('chat.groupNameRequired'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ name: groupName })
        .eq('id', conversationId);

      if (error) throw error;

      toast({
        title: t('chat.success'),
        description: t('chat.groupNameUpdated'),
      });
    } catch (error) {
      console.error('Error updating group name:', error);
      toast({
        title: t('chat.error'),
        description: t('chat.updateError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.size === 0) return;

    setLoading(true);
    try {
      const newParticipants = Array.from(selectedToAdd).map(memberId => ({
        conversation_id: conversationId,
        user_id: memberId,
      }));

      const { error } = await supabase
        .from('conversation_participants')
        .insert(newParticipants);

      if (error) throw error;

      toast({
        title: t('chat.success'),
        description: t('chat.membersAdded'),
      });

      setSelectedToAdd(new Set());
      loadParticipants();
      loadAvailableMembers();
    } catch (error) {
      console.error('Error adding members:', error);
      toast({
        title: t('chat.error'),
        description: t('chat.addMembersError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (participantId: string, userId: string) => {
    if (userId === user?.id) {
      toast({
        title: t('chat.error'),
        description: t('chat.cannotRemoveSelf'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      toast({
        title: t('chat.success'),
        description: t('chat.memberRemoved'),
      });

      loadParticipants();
      loadAvailableMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: t('chat.error'),
        description: t('chat.removeMemberError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberToAdd = (memberId: string) => {
    const newSelected = new Set(selectedToAdd);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedToAdd(newSelected);
  };

  const filteredAvailableMembers = availableMembers.filter(member =>
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('chat.manageGroup')}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">{t('chat.info')}</TabsTrigger>
            <TabsTrigger value="members">{t('chat.members')}</TabsTrigger>
            <TabsTrigger value="add">{t('chat.addMembers')}</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <div>
              <Label htmlFor="editGroupName">{t('chat.groupName')}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="editGroupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t('chat.groupNamePlaceholder')}
                />
                <Button
                  onClick={handleUpdateGroupName}
                  disabled={loading || groupName === conversationName}
                  size="icon"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <ScrollArea className="h-[calc(100vh-240px)]">
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-2 hover:bg-accent rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={participant.profiles?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {participant.profiles?.full_name[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{participant.profiles?.full_name}</p>
                        {participant.user_id === user?.id && (
                          <p className="text-xs text-muted-foreground">{t('chat.you')}</p>
                        )}
                      </div>
                    </div>
                    {participant.user_id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(participant.id, participant.user_id)}
                        disabled={loading}
                      >
                        <UserMinus className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('chat.searchMembers')}
              />
            </div>

            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2">
                {filteredAvailableMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-3 p-2 hover:bg-accent rounded-md cursor-pointer"
                    onClick={() => toggleMemberToAdd(member.id)}
                  >
                    <Checkbox
                      checked={selectedToAdd.has(member.id)}
                      onCheckedChange={() => toggleMemberToAdd(member.id)}
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
                {filteredAvailableMembers.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    {t('chat.noMembersFound')}
                  </div>
                )}
              </div>
            </ScrollArea>

            {selectedToAdd.size > 0 && (
              <Button
                className="w-full"
                onClick={handleAddMembers}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('chat.adding')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('chat.addSelected')} ({selectedToAdd.size})
                  </>
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
