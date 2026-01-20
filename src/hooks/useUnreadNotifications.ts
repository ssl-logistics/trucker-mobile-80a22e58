import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUnreadNotifications() {
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // Get unread notifications
        const { data: notifications, error } = await supabase
          .from('notifications')
          .select('id, reference_type, reference_id, is_read')
          .eq('is_read', false);

        if (error) {
          console.error('Error fetching unread notifications:', error);
          setHasUnread(false);
          setUnreadCount(0);
          return;
        }

        if (!notifications || notifications.length === 0) {
          setHasUnread(false);
          setUnreadCount(0);
          return;
        }

        // Filter out notifications for past jobs (same logic as NotificationsPage)
        const jobReferenceIds = notifications
          .filter(n => n.reference_type === 'job' && n.reference_id)
          .map(n => n.reference_id as string);

        if (jobReferenceIds.length === 0) {
          setHasUnread(notifications.length > 0);
          setUnreadCount(notifications.length);
          return;
        }

        // Fetch jobs to check their start dates
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, start_date')
          .in('id', jobReferenceIds);

        if (jobsError) {
          console.error('Error fetching jobs for filtering:', jobsError);
          setHasUnread(notifications.length > 0);
          setUnreadCount(notifications.length);
          return;
        }

        // Create a set of job IDs with past pickup dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pastJobIds = new Set<string>();

        jobsData?.forEach(job => {
          const pickupDate = new Date(job.start_date);
          pickupDate.setHours(0, 0, 0, 0);
          if (pickupDate < today) {
            pastJobIds.add(job.id);
          }
        });

        // Count valid unread notifications (excluding past jobs)
        const validUnreadCount = notifications.filter(n => {
          if (n.reference_type === 'job' && n.reference_id) {
            return !pastJobIds.has(n.reference_id);
          }
          return true;
        }).length;

        setHasUnread(validUnreadCount > 0);
        setUnreadCount(validUnreadCount);
      } catch (error) {
        console.error('Error in useUnreadNotifications:', error);
        setHasUnread(false);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadCount();

    // Subscribe to realtime updates for notifications
    const channel = supabase
      .channel('unread-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          // Refetch on any change
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { hasUnread, unreadCount, isLoading };
}
