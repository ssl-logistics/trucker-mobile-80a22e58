import { useEffect, useState } from 'react';
import { ListOrdered, Loader2, Truck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface JobQueueInfo {
  orderNumber?: string;
  myQueue: string;
  currentQueue: string;
  remainingQueues: number;
  estimatedTime: string;
  status?: string;
  gate?: string;
}

interface JobQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: JobQueueInfo | null;
}

const fmtSlot = (slot: any) =>
  slot ? `${slot.date ?? ''} ${String(slot.start_time ?? '').slice(0, 5)} - ${String(slot.end_time ?? '').slice(0, 5)}`.trim() : '';

export default function JobQueueDialog({ open, onOpenChange, queue }: JobQueueDialogProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<JobQueueInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || !queue?.orderNumber) return;
    let cancelled = false;
    const load = async (first: boolean) => {
      if (first) { setLoading(true); setNotFound(false); setLive(null); }
      try {
        const { data } = await supabase.functions.invoke('get-qtruck-queue', {
          body: { order_number: queue.orderNumber },
        });
        if (cancelled) return;
        const d = data?.data;
        if (!data?.success || !d?.queue) { if (first) setNotFound(true); return; }
        const q = d.queue;
        const ahead: any[] = Array.isArray(d.queues_ahead) ? d.queues_ahead : [];
        const serving = ahead.find((x) => x.status === 'processing' || x.status === 'called') ?? ahead[0];
        setNotFound(false);
        setLive({
          orderNumber: queue.orderNumber,
          myQueue: String(q.queue_number ?? '-').padStart(4, '0'),
          currentQueue: serving ? String(serving.queue_number).padStart(4, '0') : '-',
          remainingQueues: Number(d.queues_ahead_count ?? d.position?.ahead_in_slot ?? ahead.length ?? 0),
          estimatedTime: fmtSlot(d.slot ?? q.slot ?? d.list_item?.slot) || '-',
          status: q.status,
          gate: d.gate?.name ?? q.gate?.name ?? q.gate_name,
        });
      } catch {
        if (!cancelled && first) setNotFound(true);
      } finally {
        if (!cancelled && first) setLoading(false);
      }
    };
    load(true);
    const id = setInterval(() => load(false), 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, queue?.orderNumber]);

  if (!queue) return null;
  const view = queue.orderNumber ? live : queue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-3rem)] max-w-sm overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('currentJobs.queueStatus')}</DialogTitle>
          <DialogDescription>{t('currentJobs.queueStatusDescription')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{t('currentJobs.queueLoading')}</p>
          </div>
        ) : notFound || !view ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ListOrdered className="h-8 w-8" />
            <p className="text-sm">{t('currentJobs.queueNotFound')}</p>
          </div>
        ) : (
          <>
            <div className="border-b border-border bg-muted/40 px-5 pb-5 pt-7 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                <ListOrdered className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t('currentJobs.myQueue')}</p>
              <p className="mt-1 text-4xl font-bold text-secondary">{view.myQueue}</p>
              <p className="mt-1 text-base font-semibold text-primary">
                {view.status ? t(`currentJobs.qs_${view.status}`) : t('currentJobs.waitingForQueue')}
              </p>
            </div>

            <div className="divide-y divide-border px-5">
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-muted-foreground">{t('currentJobs.currentServingQueue')}</span>
                <span className="text-base font-bold text-secondary">{view.currentQueue}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-muted-foreground">{t('currentJobs.queuesRemaining')}</span>
                <span className="text-base font-bold text-foreground">
                  {view.remainingQueues} {t('currentJobs.queueUnit')}
                </span>
              </div>
              {view.gate && (
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-sm text-muted-foreground">{t('currentJobs.queueGate')}</span>
                  <span className="text-base font-bold text-foreground">{view.gate}</span>
                </div>
              )}
              <div className="py-4">
                <p className="text-sm text-muted-foreground">{t('currentJobs.estimatedServiceTime')}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{view.estimatedTime}</p>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-center bg-primary/5 py-4 text-primary">
          <Truck className="h-9 w-9" aria-hidden="true" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
