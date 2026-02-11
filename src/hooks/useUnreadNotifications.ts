import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadNotifications() {
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const driverId = user?.id;

  useEffect(() => {
    if (!driverId) {
      setHasUnread(false);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const { data: response, error } = await supabase.functions.invoke('get-notifications', {
          body: { action: 'unread_count', user_id: driverId },
        });

        if (error) {
          console.error('Error fetching unread notifications:', error);
          setHasUnread(false);
          setUnreadCount(0);
          return;
        }

        const count = response?.count || 0;
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

    // Subscribe to realtime updates using driver ID
    const channel = supabase
      .channel('unread-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${driverId}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return { hasUnread, unreadCount, isLoading };
}
