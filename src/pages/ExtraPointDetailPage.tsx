import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/layout/BackButton';
import { useLanguage } from '@/contexts/LanguageContext';
import ExtraPointCard from '@/components/job-detail/ExtraPointCard';
import JobActionButtons from '@/components/job/JobActionButtons';
import { usePresignedImageUrls } from '@/hooks/usePresignedImageUrl';
import { isHistoryContext } from '@/lib/historyMode';
import {
  EXTRA_POINT_EVENT, ExtraCheckinType, ExtraPoint, cargoDone, dropState, localExtraCheckins,
} from '@/lib/extraPoints';

/** Detail page for one extra cargo / drop point: info, call/route, expenses, documents, photos, check-in. */
export default function ExtraPointDetailPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { type, seq } = useParams();
  const st = (location.state || {}) as {
    point?: ExtraPoint; orderNumber?: string; orderId?: string; title?: string; jobData?: any;
    driverId?: string; driverType?: string; locked?: boolean; done?: boolean;
  };
  const isFromHistory = isHistoryContext(location.search, location.state);
  const point = st.point;
  const ctype = type as ExtraCheckinType;
  const orderNumber = st.orderNumber || '';

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    window.addEventListener(EXTRA_POINT_EVENT, on);
    window.addEventListener('focus', on);
    return () => { window.removeEventListener(EXTRA_POINT_EVENT, on); window.removeEventListener('focus', on); };
  }, []);

  const local = orderNumber ? localExtraCheckins(orderNumber) : [];
  void tick;
  const done = !!st.done || (!!point && (ctype === 'extra_cargo'
    ? cargoDone(point, local)
    : ctype === 'extra_drop' ? dropState(point, local) !== 'pending' : dropState(point, local) === 'picked_up'));
  const locked = !done && !!st.locked;

  const pa = point as any;
  const photos: string[] = (ctype === 'extra_drop' ? pa?.dropped_photo_urls : ctype === 'extra_drop_pickup' ? pa?.picked_up_photo_urls : pa?.completed_photo_urls) || [];
  const { urls } = usePresignedImageUrls(photos);

  if (!point) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] p-4"><BackButton /><p className="mt-4 text-sm text-muted-foreground">-</p></div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      <div className="bg-[#225795] text-white px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-2">
        <BackButton />
        <h1 className="font-semibold text-base">{st.title}</h1>
      </div>

      <div className="p-4 space-y-4">
        <ExtraPointCard kind={ctype === 'extra_cargo' ? 'cargo' : 'drop'} point={point} index={Number(seq) - 1}
          title={st.title} readOnly={isFromHistory}
          tone={done ? 'done' : locked ? 'locked' : 'open'}
          statusLabel={t(done ? 'extraPoint.statusDone' : locked ? 'jobDetail.waitingPreviousStep' : 'jobDetail.waitingCheckIn')}
          subtitle={<div className="text-xs text-muted-foreground">{orderNumber}</div>} />

        {(done || photos.length > 0) && (
          <div className="bg-white rounded-2xl p-4 space-y-2">
            <div className="text-sm font-medium text-[#454545]">{t('extraPoint.photos')}</div>
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <a key={i} href={urls[i] || p} target="_blank" rel="noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                    {urls[i] && <img src={urls[i]!} alt="" className="w-full h-full object-cover" />}
                  </a>
                ))}
              </div>
            ) : <div className="text-xs text-muted-foreground">{t('extraPoint.noPhotos')}</div>}
          </div>
        )}

        {!isFromHistory && !done && (
          <Button className="w-full h-12 gap-2 bg-[#225795] hover:bg-[#1b4778] text-white" disabled={locked}
            onClick={() => navigate(`/job/${encodeURIComponent(orderNumber)}/extra-point/${ctype}/${seq}`, { state: st })}>
            <MapPin className="w-4 h-4" />{t('extraPoint.stepCheckIn')}
          </Button>
        )}

        <JobActionButtons jobId={orderNumber} orderNumber={orderNumber} jobData={st.jobData} />
      </div>
    </div>
  );
}
