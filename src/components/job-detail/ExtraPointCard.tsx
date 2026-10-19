import { useEffect, useState } from 'react';
import { Phone, Navigation, MapPin, User, FileText, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/dateUtils';
import {
  ExtraPoint, ExtraPointKind, EXTRA_POINT_EVENT, readExtraProgress, isExtraPointDone,
  extraPointAddress, openExtraPointRoute,
} from '@/lib/extraPoints';

interface Props {
  kind: ExtraPointKind;
  point: ExtraPoint;
  index: number;
  orderNumber: string;
  locked?: boolean;
  readOnly?: boolean;
  /** Extra line(s) under the title, e.g. order/container code on the current-jobs list */
  subtitle?: React.ReactNode;
  onOpen: () => void;
}

export function useExtraProgress(order: string, kind: ExtraPointKind, seq: number) {
  const [p, setP] = useState(() => readExtraProgress(order, kind, seq));
  useEffect(() => {
    const h = () => setP(readExtraProgress(order, kind, seq));
    h();
    window.addEventListener(EXTRA_POINT_EVENT, h);
    window.addEventListener('focus', h);
    return () => { window.removeEventListener(EXTRA_POINT_EVENT, h); window.removeEventListener('focus', h); };
  }, [order, kind, seq]);
  return p;
}

export default function ExtraPointCard({ kind, point, index, orderNumber, locked, readOnly, subtitle, onOpen }: Props) {
  const { t, language } = useLanguage();
  const progress = useExtraProgress(orderNumber, kind, point.sequence);
  const done = isExtraPointDone(kind, progress);
  const started = kind === 'cargo' ? !!progress.checked_in : !!progress.dropped;
  const isDrop = kind === 'drop';
  const tone = isDrop ? 'bg-orange-500' : 'bg-blue-600';
  const head = done ? 'bg-green-500' : locked ? 'bg-gray-400' : tone;
  const status = locked ? t('jobDetail.waitingPreviousStep')
    : done ? t('extraPoint.statusDone')
    : started ? (isDrop ? t('dropPoint.statusDropped') : t('extraPoint.statusCheckedIn'))
    : t('jobDetail.waitingCheckIn');
  const addr = extraPointAddress(point);

  return (
    <Card className={`overflow-hidden border-2 rounded-2xl ${done ? 'border-green-500' : locked ? 'border-gray-300' : isDrop ? 'border-orange-400' : 'border-blue-500'}`}
      onClick={(e) => e.stopPropagation()}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${head}`}>
        <h3 className="font-semibold text-sm text-white">
          {isDrop ? t('dropPoint.title') : t('extraPoint.title')} #{index + 1}
        </h3>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">{status}</span>
      </div>
      <div className={`p-4 space-y-2 text-sm ${locked ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
        {subtitle}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.place') || 'สถานที่'}</span>
          <span className="font-semibold text-[#225795]">{point.location_name || '-'}</span>
        </div>
        {addr && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.address') || 'ที่อยู่'}</span>
            <span className="text-[#454545]">{addr}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
          <span className="font-medium text-[#454545] min-w-[50px]">{t('jobDetail.contactPerson') || 'ผู้ติดต่อ'}</span>
          <span className="text-[#454545]">{point.contact_name || '-'}{point.contact_phone ? ` (${point.contact_phone})` : ''}</span>
        </div>
        {point.notes && (
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
            <span className="text-[#454545]">{point.notes}</span>
          </div>
        )}
        {(progress.dropped || progress.done) && (
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-800">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isDrop ? t('dropPoint.stepDrop') : t('extraPoint.stepConfirm')} {formatDateTime(progress.dropped || progress.done!, language)}</span>
          </div>
        )}
        <div className={`grid gap-2 pt-1 ${readOnly ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 p-1 border-[#225795]/30 text-[#225795]" disabled={locked || done}
                onClick={() => point.contact_phone
                  ? (window.location.href = `tel:${point.contact_phone}`)
                  : toast({ title: t('jobDetail.error'), description: t('jobDetail.noPhoneNumber'), variant: 'destructive' })}>
                <Phone className="w-3.5 h-3.5" /><span className="text-xs">{t('jobDetail.call')}</span>
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 p-1 border-[#225795]/30 text-[#225795]" disabled={locked || done}
                onClick={() => { if (!openExtraPointRoute(point)) toast({ title: t('jobDetail.error'), description: t('jobDetail.noLocation'), variant: 'destructive' }); }}>
                <Navigation className="w-3.5 h-3.5" /><span className="text-xs">{t('jobDetail.route')}</span>
              </Button>
            </>
          )}
          <Button size="sm" className="h-9 p-1 bg-[#225896] hover:bg-[#1a4578]" disabled={locked || (readOnly && !done)} onClick={onOpen}>
            <span className="text-xs">{done ? t('jobDetail.viewInfo') : started ? t('jobDetail.uploadEvidence') : t('jobDetail.updateStatus')}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
