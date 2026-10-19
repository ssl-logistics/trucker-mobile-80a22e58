import { useNavigate } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import ExtraPointCard, { useExtraProgress } from '@/components/job-detail/ExtraPointCard';
import { ExtraPoint, isExtraPointDone } from '@/lib/extraPoints';

/** Separate current-jobs card for one container drop point; hidden once drop + pickup are done. */
export default function DropPointListCard({ job, point, index }: { job: any; point: ExtraPoint; index: number }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const order = String(job.order_number || '');
  const progress = useExtraProgress(order, 'drop', point.sequence);
  if (isExtraPointDone('drop', progress)) return null;
  const code = order.includes('/') ? order.slice(order.lastIndexOf('/') + 1) : '';
  const ref = job.bl_no ? `BL ${job.bl_no}` : job.booking_no ? `Booking ${job.booking_no}` : order;

  return (
    <ExtraPointCard
      kind="drop"
      point={point}
      index={index}
      orderNumber={order}
      subtitle={
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-medium">{ref}</span>
          {code && (<><Tag className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{t('jobDetail.containerCode')} :</span><span className="font-medium">{code}</span></>)}
        </div>
      }
      onOpen={() => navigate(`/job/${encodeURIComponent(order)}/extra-point/drop/${point.sequence}`, { state: { jobData: job } })}
    />
  );
}
