import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const RETURN_WINDOW_HOURS = 48;

interface Props {
  show: boolean;
  pickupAt: string | null;
}

/**
 * Banner shown on BL (international) jobs after the driver checks in to pick
 * up the container. Counts down to the 48h deadline for returning the empty
 * container. Pure UI — no business-logic side effects.
 */
export function ContainerReturnDeadlineBanner({ show, pickupAt }: Props) {
  const { language } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!show || !pickupAt) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [show, pickupAt]);

  if (!show || !pickupAt) return null;

  const pickupMs = new Date(pickupAt).getTime();
  if (!pickupMs) return null;

  const deadlineMs = pickupMs + RETURN_WINDOW_HOURS * 3600 * 1000;
  const remainingMs = deadlineMs - now;
  const overdue = remainingMs <= 0;

  const absMs = Math.abs(remainingMs);
  const totalHours = Math.floor(absMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((absMs % 3_600_000) / 60_000);

  const urgent = !overdue && remainingMs <= 24 * 3_600_000;

  const tone = overdue
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : urgent
    ? 'border-orange-300 bg-orange-50 text-orange-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';

  const labels = {
    th: {
      title: overdue ? 'เลยกำหนดคืนตู้คอนเทนเนอร์' : 'กำหนดคืนตู้คอนเทนเนอร์',
      subtitle: overdue
        ? 'กรุณาคืนตู้เปล่าโดยด่วน'
        : 'ต้องคืนตู้เปล่าภายใน 48 ชั่วโมงหลังรับตู้',
      remaining: 'เหลือเวลา',
      overdueLabel: 'เลยกำหนด',
      d: 'วัน',
      h: 'ชม.',
      m: 'นาที',
    },
    en: {
      title: overdue ? 'Container return overdue' : 'Container return deadline',
      subtitle: overdue
        ? 'Please return the empty container ASAP'
        : 'Empty container must be returned within 48h of pickup',
      remaining: 'Remaining',
      overdueLabel: 'Overdue by',
      d: 'd',
      h: 'h',
      m: 'm',
    },
  };
  const L = language === 'th' ? labels.th : labels.en;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${L.d}`);
  parts.push(`${hours} ${L.h}`);
  if (days === 0) parts.push(`${minutes} ${L.m}`);

  return (
    <div className={cn('mb-4 rounded-xl border p-3 flex items-start gap-3', tone)}>
      {overdue ? (
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
      ) : (
        <Clock className="w-5 h-5 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{L.title}</div>
        <div className="text-xs opacity-90 mt-0.5">{L.subtitle}</div>
        <div className="text-xs font-medium mt-1.5">
          {overdue ? L.overdueLabel : L.remaining}: {parts.join(' ')}
        </div>
      </div>
    </div>
  );
}
