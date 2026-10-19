import { Phone, Navigation, MapPin, User, FileText, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateUnit } from '@/utils/apiDataTranslations';
import { ExtraPoint, ExtraPointKind, extraPointAddress, openExtraPointRoute } from '@/lib/extraPoints';

interface Props {
  kind: ExtraPointKind;
  point: ExtraPoint;
  index: number;
  readOnly?: boolean;
  /** Extra line(s) under the title, e.g. order/container code on the current-jobs list */
  subtitle?: React.ReactNode;
  cardRef?: (el: HTMLDivElement | null) => void;
  /** Optional button placed before Call in the action row */
  leadingAction?: React.ReactNode;
  /** Override header title */
  title?: string;
  /** Check-in state: locked (grey), open (waiting check-in), done (green) */
  tone?: 'locked' | 'open' | 'done';
  statusLabel?: string;
  /** Tap the card to open the point detail page */
  onOpen?: () => void;
}

/** Display-only card for an extra cargo point or container drop point (check-in comes later). */
export default function ExtraPointCard({ kind, point, index, readOnly, subtitle, cardRef, leadingAction, title, tone, statusLabel, onOpen }: Props) {
  const { t, language } = useLanguage();
  const isDrop = kind === 'drop';
  const addr = extraPointAddress(point);
  const border = tone === 'done' ? 'border-green-500' : tone === 'open' ? (isDrop ? 'border-orange-500' : 'border-teal-500') : 'border-gray-300';
  const head = tone === 'done' ? 'bg-green-500' : tone === 'open' ? (isDrop ? 'bg-orange-500' : 'bg-teal-600') : 'bg-gray-400';

  return (
    <Card ref={cardRef} className={`overflow-hidden border-2 rounded-2xl ${border}`}
      role={onOpen ? 'button' : undefined}
      onClick={(e) => { e.stopPropagation(); onOpen?.(); }}>
      <div className={`px-4 py-2.5 flex items-center justify-between ${head}`}>
        <h3 className="font-semibold text-sm text-white">
          {title ?? `${isDrop ? t('dropPoint.title') : t('extraPoint.title')} ${index + 1}`}
        </h3>
        {statusLabel && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-white bg-white/20">{statusLabel}</span>}
      </div>
      <div className="p-4 space-y-2 text-sm bg-white">
        {subtitle}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
          <span className="font-medium text-[#454545] min-w-[50px] whitespace-nowrap shrink-0">{t('jobDetail.place') || 'สถานที่'}</span>
          <span className="font-semibold text-[#225795]">{point.location_name || '-'}</span>
        </div>
        {addr && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="font-medium text-[#454545] min-w-[50px] whitespace-nowrap shrink-0">{t('jobDetail.address') || 'ที่อยู่'}</span>
            <span className="text-[#454545]">{addr}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
          <span className="font-medium text-[#454545] min-w-[50px] whitespace-nowrap shrink-0">{t('jobDetail.contactPerson') || 'ผู้ติดต่อ'}</span>
          <span className="text-[#454545]">{point.contact_name || '-'}</span>
        </div>
        <div className="flex items-start gap-2">
          <Phone className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
          <span className="font-medium text-[#454545] min-w-[50px] whitespace-nowrap shrink-0">{t('jobDetail.phone') || 'เบอร์โทร'}</span>
          <span className="text-[#454545]">{point.contact_phone || '-'}</span>
        </div>
        {!isDrop && Array.isArray(point.products) && point.products.length > 0 && (
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
            <span className="font-medium text-[#454545] min-w-[50px] whitespace-nowrap shrink-0">{language === 'th' ? 'สินค้า' : language === 'zh' ? '货物' : language === 'ko' ? '상품' : 'Products'}</span>
            <div className="flex-1 space-y-1.5">
              {point.products.map((p, i) => (
                <div key={i} className="text-[#454545]">
                  <div className="font-semibold text-[#225795]">
                    {p.product_name || '-'}{p.product_code ? <span className="text-xs text-muted-foreground font-normal"> ({p.product_code})</span> : null}
                  </div>
                  <div className="text-xs">
                    {[p.quantity != null ? `${p.quantity} ${p.unit ? translateUnit(p.unit, language) : ''}`.trim() : null,
                      p.weight != null ? `${t('jobDetail.weight')} ${Number(p.weight).toLocaleString()} ${language === 'th' ? 'กก.' : 'kg'}` : null]
                      .filter(Boolean).join(' · ')}
                  </div>
                  {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {point.notes && (
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
            <span className="text-[#454545]">{point.notes}</span>
          </div>
        )}
        {!readOnly && (
          <div className={`grid ${leadingAction ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`} onClick={(e) => e.stopPropagation()}>
            {leadingAction}
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
