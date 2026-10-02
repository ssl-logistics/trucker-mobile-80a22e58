import { useEffect, useState } from 'react';
import { Clock3, ListOrdered, Loader2, MapPin, Truck } from 'lucide-react';
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

const formatQueueNumber = (value: string) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '-') return '-';
  return normalized.toUpperCase().startsWith('Q') ? normalized.toUpperCase() : `Q${normalized}`;
};

const statusStyles: Record<string, string> = {
  waiting: 'border-secondary/20 bg-secondary/10 text-secondary',
  called: 'border-primary/25 bg-primary/10 text-primary',
  processing: 'border-primary/25 bg-primary/10 text-primary',
  completed: 'border-primary/20 bg-primary/10 text-primary',
  cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
  moved: 'border-secondary/20 bg-secondary/10 text-secondary',
};

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
  const statusClass = statusStyles[view?.status ?? 'waiting'] ?? statusStyles.waiting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[350px] overflow-hidden rounded-[28px] border-border/70 bg-card p-0 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('currentJobs.queueStatus')}</DialogTitle>
          <DialogDescription>{t('currentJobs.queueStatusDescription')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 bg-muted/30 px-6 text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/15 bg-secondary/10">
              <Loader2 className="h-7 w-7 animate-spin text-secondary motion-reduce:animate-none" />
            </div>
            <p className="text-sm">{t('currentJobs.queueLoading')}</p>
          </div>
        ) : notFound || !view ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 bg-muted/30 px-6 text-center text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
              <ListOrdered className="h-7 w-7 text-secondary" />
            </div>
            <p className="text-sm">{t('currentJobs.queueNotFound')}</p>
          </div>
        ) : (
          <>
            <div className="px-7 pb-5 pt-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">{t('currentJobs.myQueue')}</p>
              <p className="mt-2 text-6xl font-bold leading-none text-primary">
                {formatQueueNumber(view.myQueue)}
              </p>
              <p className={`mx-auto mt-4 w-fit rounded-full border px-4 py-1.5 text-sm font-semibold ${statusClass}`}>
                {view.status ? t(`currentJobs.qs_${view.status}`) : t('currentJobs.waitingForQueue')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-border bg-muted/50 p-4">
                <span className="text-xs leading-5 text-muted-foreground">{t('currentJobs.currentServingQueue')}</span>
                <span className="mt-2 text-2xl font-bold text-foreground">{formatQueueNumber(view.currentQueue)}</span>
              </div>
              <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-secondary/15 bg-secondary/10 p-4">
                <span className="text-xs leading-5 text-secondary">{t('currentJobs.queuesRemaining')}</span>
                <span className="mt-2 text-2xl font-bold text-secondary">
                  {view.remainingQueues} <span className="text-sm font-semibold">{t('currentJobs.queueUnit')}</span>
                </span>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/70 bg-muted/30 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('currentJobs.queueGate')}</p>
                  <p className="mt-0.5 break-words text-sm font-bold text-foreground">{view.gate || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t('currentJobs.estimatedServiceTime')}</p>
                  <p className="mt-0.5 break-words text-sm font-bold text-foreground">{view.estimatedTime || '-'}</p>
                </div>
              </div>
            </div>

            <div className="relative flex h-20 items-end justify-center overflow-hidden bg-secondary/[0.07]">
              <Truck className="relative mb-3 h-12 w-12 text-secondary/75 motion-safe:transition-transform motion-safe:duration-500" aria-hidden="true" />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
