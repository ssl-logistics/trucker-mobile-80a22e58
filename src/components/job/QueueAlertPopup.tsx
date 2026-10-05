import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import JobQueueDialog, { type JobQueueInfo } from './JobQueueDialog';

const SEEN_KEY = 'qtruck_alert_seen_v1';
// Queue statuses that must not pop the in-app dialog (push + list still work)
const NO_POPUP_TITLES = new Set(['กำลังขึ้น/ลงสินค้า', 'คิวเสร็จสิ้น', 'Loading/unloading in progress', 'Queue completed']);
const readSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
};
const markSeen = (id: string) => {
  const s = readSeen().filter((x) => x !== id);
  s.push(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-200)));
};

/** Global center-screen popup for QTruck queue alerts (upcoming / called / moved / cancelled). */
export default function QueueAlertPopup() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [alert, setAlert] = useState<any | null>(null);
  const [queueView, setQueueView] = useState<JobQueueInfo | null>(null);

  const check = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.functions.invoke('get-notifications', {
        body: { action: 'list', user_id: user.id },
      });
      const list: any[] = data?.data || [];
      const seen = readSeen();
      // Only recent (last 2h) queue alerts not yet shown
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      const next = list.find(
        (n) => n.notification_type === 'qtruck_queue' && !seen.includes(n.id) && new Date(n.created_at).getTime() > cutoff,
      );
      if (next) {
        markSeen(next.id);
        // processing/completed status changes: keep push + notification list, but no in-app popup
        if (next.reference_type === 'queue.status_changed' && NO_POPUP_TITLES.has(next.title_th)) return;
        setAlert(next);
        if (next.reference_type === 'queue.called' && 'vibrate' in navigator) {
          try { navigator.vibrate([400, 200, 400, 200, 400]); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    check();
    const id = setInterval(check, 15_000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', check);
    };
  }, [user?.id, check]);

  const pick = (n: any, base: 'title' | 'description') =>
    (language === 'en' && n[`${base}_en`]) ||
    (language === 'ko' && n[`${base}_ko`]) ||
    (language === 'zh' && n[`${base}_zh`]) ||
    n[`${base}_en`] ||
    n[`${base}_th`];
  const title = alert ? pick(alert, 'title') : '';
  const desc = alert ? pick(alert, 'description') : '';
  const isCalled = alert?.reference_type === 'queue.called';

  return (
    <>
      <Dialog open={!!alert} onOpenChange={(o) => !o && setAlert(null)}>
        <DialogContent className="w-[calc(100%-3rem)] max-w-sm text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isCalled ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-primary/10 text-primary'}`}>
            <BellRing className="h-8 w-8" />
          </div>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base text-foreground">{desc}</DialogDescription>
          {alert?.reference_id && (
            <p className="text-sm text-muted-foreground">{t('job.order_code')} {alert.reference_id}</p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11" onClick={() => setAlert(null)}>
              {t('currentJobs.close')}
            </Button>
            <Button
              className="h-11"
              onClick={() => {
                const ref = alert?.reference_id;
                setAlert(null);
                if (ref) setQueueView({ orderNumber: ref, myQueue: '', currentQueue: '', remainingQueues: 0, estimatedTime: '' });
              }}
            >
              {t('currentJobs.viewQueue')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <JobQueueDialog open={!!queueView} onOpenChange={(o) => !o && setQueueView(null)} queue={queueView} />
    </>
  );
}
