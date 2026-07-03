import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Props {
  show: boolean;
  pickupAt: string | null;
  /** Free days allowed for container return, set by office web. */
  containerFreeDays: number | null | undefined;
  /** Absolute deadline (e.g. Booking closing_time). When provided, overrides pickupAt + freeDays. */
  deadlineAt?: string | null;
}

/**
 * Banner shown on container jobs after the driver picks up the container.
 * - BL (inbound): counts down from pickup + `container_free_days`.
 * - Booking (outbound): counts down to absolute `deadlineAt` (closing_time).
 * Updates every 1 second.
 */
export function ContainerReturnDeadlineBanner({ show, pickupAt, containerFreeDays, deadlineAt }: Props) {
  const { language } = useLanguage();
  const [now, setNow] = useState(() => Date.now());

  const days = Number(containerFreeDays);
  const hasValidDays = Number.isFinite(days) && days > 0;
  const deadlineFromAbsolute = deadlineAt ? new Date(deadlineAt).getTime() : NaN;
  const hasAbsoluteDeadline = Number.isFinite(deadlineFromAbsolute) && deadlineFromAbsolute > 0;

  const canRender = show && (hasAbsoluteDeadline || (!!pickupAt && hasValidDays));

  useEffect(() => {
    if (!canRender) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [canRender]);

  if (!canRender) return null;

  let deadlineMs: number;
  if (hasAbsoluteDeadline) {
    deadlineMs = deadlineFromAbsolute;
  } else {
    const pickupMs = new Date(pickupAt!).getTime();
    if (!pickupMs) return null;
    deadlineMs = pickupMs + days * 24 * 3_600_000;
  }
  const remainingMs = deadlineMs - now;
  const overdue = remainingMs <= 0;

  const absMs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(absMs / 1000);
  const dDays = Math.floor(totalSeconds / 86400);
  const dHours = Math.floor((totalSeconds % 86400) / 3600);
  const dMinutes = Math.floor((totalSeconds % 3600) / 60);
  const dSeconds = totalSeconds % 60;

  const critical = !overdue && remainingMs <= 6 * 3_600_000;
  const urgent = !overdue && !critical && remainingMs <= 24 * 3_600_000;

  const tone = overdue || critical
    ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : urgent
    ? 'border-orange-300 bg-orange-50 text-orange-700'
    : 'border-blue-200 bg-blue-50 text-blue-700';

  const deadlineDate = new Date(deadlineMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const deadlineText = `${deadlineDate.getFullYear()}-${pad(deadlineDate.getMonth() + 1)}-${pad(deadlineDate.getDate())} ${pad(deadlineDate.getHours())}:${pad(deadlineDate.getMinutes())}`;

  const labels = {
    th: {
      title: overdue ? 'เลยกำหนดคืนตู้คอนเทนเนอร์' : 'กำหนดคืนตู้คอนเทนเนอร์',
      subtitle: overdue
        ? 'กรุณาคืนตู้เปล่าโดยด่วน'
        : hasAbsoluteDeadline
        ? `ต้องคืนตู้เปล่าภายใน ${deadlineText} (Closing Time)`
        : `ต้องคืนตู้เปล่าภายใน ${days} วันหลังรับตู้`,
      remaining: 'เหลือเวลา',
      overdueLabel: 'เลยกำหนด',
      d: 'วัน',
      h: 'ชม.',
      m: 'นาที',
      s: 'วิ',
    },
    en: {
      title: overdue ? 'Container return overdue' : 'Container return deadline',
      subtitle: overdue
        ? 'Please return the empty container ASAP'
        : hasAbsoluteDeadline
        ? `Empty container must be returned by ${deadlineText} (Closing Time)`
        : `Empty container must be returned within ${days} day(s) of pickup`,
      remaining: 'Remaining',
      overdueLabel: 'Overdue by',
      d: 'd',
      h: 'h',
      m: 'm',
      s: 's',
    },
  };
  const L = language === 'th' ? labels.th : labels.en;

  const parts: string[] = [];
  if (dDays > 0) parts.push(`${dDays} ${L.d}`);
  parts.push(`${dHours} ${L.h}`);
  parts.push(`${dMinutes} ${L.m}`);
  parts.push(`${dSeconds} ${L.s}`);

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
        <div className="text-xs font-medium mt-1.5 tabular-nums">
          {overdue ? L.overdueLabel : L.remaining}: {parts.join(' ')}
        </div>
      </div>
    </div>
  );
}
