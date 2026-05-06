import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { getAuthItem } from '@/utils/authStorage';

// Adaptive intervals
const POLL_FOREGROUND_MS = 60_000;       // foreground: every 60s
const POLL_IDLE_MS = 5 * 60_000;          // idle (>5m no activity): 5m heartbeat
const IDLE_THRESHOLD_MS = 5 * 60_000;

export function useNewJobPolling() {
  const { user, isAuthenticated } = useAuth();
  const { userType } = useUserRole();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const checkNewJobs = async () => {
      if (isPollingRef.current) return;
      // Skip when tab is hidden (rely on push notifications)
      if (typeof document !== 'undefined' && document.hidden) return;
      isPollingRef.current = true;
      try {
        let driverType = 'freelance';
        if (userType === 'internal_driver') driverType = 'internal';
        else if (userType === 'external_driver') driverType = 'external';

        const storedDriver = await getAuthItem('auth_driver');
        let driverId = user.id;
        if (storedDriver) {
          try {
            const parsed = JSON.parse(storedDriver);
            if (parsed?.id) driverId = parsed.id;
          } catch {}
        }

        const { data, error } = await supabase.functions.invoke('check-new-jobs', {
          body: { driver_id: driverId, driver_type: driverType, user_id: driverId },
        });

        if (error) {
          console.error('[NewJobPolling] Error:', error);
          return;
        }
        if (data?.new_notifications > 0) {
          console.log(`[NewJobPolling] 🔔 ${data.new_notifications} new job notification(s)`);
        }
      } catch (err) {
        console.error('[NewJobPolling] Exception:', err);
      } finally {
        isPollingRef.current = false;
      }
    };

    const getDelay = () => {
      if (typeof document !== 'undefined' && document.hidden) return 0; // pause
      const idle = Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
      return idle ? POLL_IDLE_MS : POLL_FOREGROUND_MS;
    };

    const schedule = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const delay = getDelay();
      if (delay <= 0) return;
      timeoutRef.current = setTimeout(async () => {
        await checkNewJobs();
        schedule();
      }, delay);
    };

    const onActivity = () => { lastActivityRef.current = Date.now(); };
    const onVisibility = () => {
      if (!document.hidden) {
        lastActivityRef.current = Date.now();
        checkNewJobs();
        schedule();
      } else if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // Initial check shortly after mount
    const initial = setTimeout(() => { checkNewJobs(); schedule(); }, 5000);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(initial);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, user?.id, userType]);
}
