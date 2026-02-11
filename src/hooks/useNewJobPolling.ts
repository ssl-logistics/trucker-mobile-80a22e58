import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { getAuthItem } from '@/utils/authStorage';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useNewJobPolling() {
  const { user, isAuthenticated } = useAuth();
  const { userType } = useUserRole();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const checkNewJobs = async () => {
      if (isPollingRef.current) return; // Skip if already polling
      isPollingRef.current = true;

      try {
        // Determine driver_type for external API
        let driverType = 'freelance';
        if (userType === 'internal_driver') driverType = 'internal';
        else if (userType === 'external_driver') driverType = 'external';

        // Get the external driver ID from auth storage
        const storedDriver = await getAuthItem('auth_driver');
        let driverId = user.id;
        if (storedDriver) {
          try {
            const parsed = JSON.parse(storedDriver);
            if (parsed?.id) driverId = parsed.id;
          } catch {}
        }

        // Use driver ID as user_id for scoped notifications
        // This is the external driver ID, not Supabase auth user
        const { data, error } = await supabase.functions.invoke('check-new-jobs', {
          body: {
            driver_id: driverId,
            driver_type: driverType,
            user_id: driverId,
          },
        });

        if (error) {
          console.error('[NewJobPolling] Error:', error);
          return;
        }

        if (data?.new_notifications > 0) {
          console.log(`[NewJobPolling] 🔔 ${data.new_notifications} new job notification(s) created`);
        }
      } catch (err) {
        console.error('[NewJobPolling] Exception:', err);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(checkNewJobs, 5000);

    // Then poll every 30 seconds
    intervalRef.current = setInterval(checkNewJobs, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, user?.id, userType]);
}
