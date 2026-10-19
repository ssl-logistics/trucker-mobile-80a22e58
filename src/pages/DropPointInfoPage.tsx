import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Tag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ExtraPointCard from '@/components/job-detail/ExtraPointCard';
import { ExtraPoint, getExtraDropPoints } from '@/lib/extraPoints';

/** Display-only drop-container info: drop step then pick-up at the same point (check-in comes later). */
export default function DropPointInfoPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { jobId, seq } = useParams();
  const state = (useLocation().state || {}) as { jobData?: any; point?: ExtraPoint; index?: number };
  const job = state.jobData || {};
  const points = getExtraDropPoints(job);
  const point = state.point || points.find((p) => String(p.sequence) === String(seq));
  const index = state.index ?? Math.max(0, points.findIndex((p) => String(p.sequence) === String(seq)));
  const order = String(job.order_number || decodeURIComponent(jobId || ''));
  const code = order.includes('/') ? order.slice(order.lastIndexOf('/') + 1) : '';
  const ref = job.bl_no ? `BL ${job.bl_no}` : job.booking_no ? `Booking ${job.booking_no}` : order;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-10">
      <div className="sticky top-0 z-10 bg-orange-500 text-white px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="back"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-semibold">{t('dropPoint.infoTitle')} {index + 1}</h1>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-medium">{ref}</span>
          {code && (<><Tag className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{t('jobDetail.containerCode')} :</span><span className="font-medium">{code}</span></>)}
        </div>
        {!point ? (
          <p className="text-sm text-muted-foreground text-center py-10">-</p>
        ) : (
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-[9px] top-4 bottom-4 w-0.5 bg-orange-200" />
            {[t('dropPoint.dropStep'), t('dropPoint.pickupStep')].map((title, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-6 top-3 w-5 h-5 rounded-full border-2 border-orange-400 bg-white text-[10px] font-bold text-orange-600 flex items-center justify-center">{i + 1}</span>
                <ExtraPointCard kind="drop" point={point} index={index} title={title} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
