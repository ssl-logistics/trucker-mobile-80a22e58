import { ListOrdered, Truck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface JobQueueInfo {
  myQueue: string;
  currentQueue: string;
  remainingQueues: number;
  estimatedTime: string;
}

interface JobQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: JobQueueInfo | null;
}

export default function JobQueueDialog({ open, onOpenChange, queue }: JobQueueDialogProps) {
  const { t } = useLanguage();

  if (!queue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-3rem)] max-w-sm overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('currentJobs.queueStatus')}</DialogTitle>
          <DialogDescription>{t('currentJobs.queueStatusDescription')}</DialogDescription>
        </DialogHeader>

        <div className="border-b border-border bg-muted/40 px-5 pb-5 pt-7 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
            <ListOrdered className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t('currentJobs.myQueue')}</p>
          <p className="mt-1 text-4xl font-bold text-secondary">{queue.myQueue}</p>
          <p className="mt-1 text-base font-semibold text-primary">{t('currentJobs.waitingForQueue')}</p>
        </div>

        <div className="divide-y divide-border px-5">
          <div className="flex items-center justify-between gap-4 py-4">
            <span className="text-sm text-muted-foreground">{t('currentJobs.currentServingQueue')}</span>
            <span className="text-base font-bold text-secondary">{queue.currentQueue}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <span className="text-sm text-muted-foreground">{t('currentJobs.queuesRemaining')}</span>
            <span className="text-base font-bold text-foreground">
              {queue.remainingQueues} {t('currentJobs.queueUnit')}
            </span>
          </div>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{t('currentJobs.estimatedServiceTime')}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{queue.estimatedTime}</p>
          </div>
        </div>

        <div className="flex items-center justify-center bg-primary/5 py-4 text-primary">
          <Truck className="h-9 w-9" aria-hidden="true" />
        </div>
      </DialogContent>
    </Dialog>
  );
}