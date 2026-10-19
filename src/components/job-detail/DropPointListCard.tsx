import { Tag, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import ExtraPointCard from '@/components/job-detail/ExtraPointCard';
import { ExtraPoint } from '@/lib/extraPoints';

/** Separate current-jobs card for one container drop point (display only for now). */
export default function DropPointListCard({ job, point, index }: { job: any; point: ExtraPoint; index: number }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const order = String(job.order_number || '');
  const code = order.includes('/') ? order.slice(order.lastIndexOf('/') + 1) : '';
  const ref = job.bl_no ? `BL ${job.bl_no}` : job.booking_no ? `Booking ${job.booking_no}` : order;
  const jobId = encodeURIComponent(String(job.order_number || job.id));

  return (
    <ExtraPointCard
      kind="drop"
      point={point}
      index={index}
      title={`${t('dropPoint.label')} · ${ref}`}
      leadingAction={
        <Button size="sm" className="h-9 gap-1.5 p-1 border-0 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => navigate(`/job/${jobId}/extra-point/drop/${point.sequence}`, { state: { jobData: job, point, index } })}>
          <Eye className="w-3.5 h-3.5" /><span className="text-xs">{t('dropPoint.viewJob')}</span>
        </Button>
      }
      subtitle={
        <div className="flex items-center gap-2 text-sm">
          {code && (<><Tag className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">{t('jobDetail.containerCode')} :</span><span className="font-medium">{code}</span></>)}
        </div>
      }
    />
  );
}
