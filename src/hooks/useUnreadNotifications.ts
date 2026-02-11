import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUnreadNotifications() {
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // Jobs come from external API, reference_id is order_number not UUID
        // RLS already filters by user_id, just count unread
        const { data: notifications, error } = await supabase
          .from('notifications')
          .select('id, is_read')
          .eq('is_read', false);

        if (error) {
          console.error('Error fetching unread notifications:', error);
          setHasUnread(false);
          setUnreadCount(0);
          return;
        }

        const count = notifications?.length || 0;
        setHasUnread(count > 0);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error in useUnreadNotifications:', error);
        setHasUnread(false);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadCount();

    // Subscribe to realtime updates filtered by current user
    let channel: any;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.id) return;
      channel = supabase
        .channel('unread-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { hasUnread, unreadCount, isLoading };
}
