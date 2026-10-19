import { Phone, Navigation, MapPin, User, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExtraPoint, ExtraPointKind, extraPointAddress, openExtraPointRoute } from '@/lib/extraPoints';

interface Props {
  kind: ExtraPointKind;
  point: ExtraPoint;
  index: number;
  readOnly?: boolean;
  /** Extra line(s) under the title, e.g. order/container code on the current-jobs list */
  subtitle?: React.ReactNode;
}

/** Display-only card for an extra cargo point or container drop point (check-in comes later). */
export default function ExtraPointCard({ kind, point, index, readOnly, subtitle }: Props) {
  const { t } = useLanguage();
  const isDrop = kind === 'drop';
  const addr = extraPointAddress(point);

  return (
    <Card className={`overflow-hidden border-2 rounded-2xl ${isDrop ? 'border-orange-400' : 'border-blue-500'}`}
      onClick={(e) => e.stopPropagation()}>
      <div className={`px-4 py-2.5 ${isDrop ? 'bg-orange-500' : 'bg-blue-600'}`}>
        <h3 className="font-semibold text-sm text-white">
          {isDrop ? t('dropPoint.title') : t('extraPoint.title')} #{index + 1}
        </h3>
      </div>
      <div className="p-4 space-y-2 text-sm bg-white">
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
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 p-1 border-[#225795]/30 text-[#225795]"
              onClick={() => point.contact_phone
                ? (window.location.href = `tel:${point.contact_phone}`)
                : toast({ title: t('jobDetail.error'), description: t('jobDetail.noPhoneNumber'), variant: 'destructive' })}>
              <Phone className="w-3.5 h-3.5" /><span className="text-xs">{t('jobDetail.call')}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 p-1 border-[#225795]/30 text-[#225795]"
              onClick={() => { if (!openExtraPointRoute(point)) toast({ title: t('jobDetail.error'), description: t('jobDetail.noLocation'), variant: 'destructive' }); }}>
              <Navigation className="w-3.5 h-3.5" /><span className="text-xs">{t('jobDetail.route')}</span>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
