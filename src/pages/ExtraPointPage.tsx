import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Camera, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/lib/dateUtils';
import ExtraPointCard, { useExtraProgress } from '@/components/job-detail/ExtraPointCard';
import {
  ExtraPointKind, ExtraStep, getExtraCargoPoints, getExtraDropPoints, saveExtraStep,
} from '@/lib/extraPoints';

/** Steps for one extra point. cargo: check-in -> confirm. drop: drop container -> pick it up again. */
export default function ExtraPointPage() {
  const { jobId = '', kind: kindParam, seq: seqParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const kind: ExtraPointKind = kindParam === 'drop' ? 'drop' : 'cargo';
  const seq = Number(seqParam);
  const jobData: any = (location.state as any)?.jobData || {};
  const readOnly = !!(location.state as any)?.fromHistory;
  const orderNumber = decodeURIComponent(jobId);
  const points = kind === 'drop' ? getExtraDropPoints(jobData) : getExtraCargoPoints(jobData);
  const index = points.findIndex((p) => p.sequence === seq);
  const point = points[index];
  const progress = useExtraProgress(orderNumber, kind, seq);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingStep = useRef<ExtraStep | null>(null);

  const steps = useMemo<{ step: ExtraStep; label: string; needsPrev?: ExtraStep }[]>(() => kind === 'drop'
    ? [{ step: 'dropped', label: t('dropPoint.stepDrop') }, { step: 'picked_up', label: t('dropPoint.stepPickup'), needsPrev: 'dropped' }]
    : [{ step: 'checked_in', label: t('extraPoint.stepCheckIn') }, { step: 'done', label: t('extraPoint.stepConfirm'), needsPrev: 'checked_in' }],
  [kind, t]);

  const confirm = (step: ExtraStep) => {
    setBusy(true);
    saveExtraStep(orderNumber, kind, seq, step);
    setBusy(false);
    toast({ title: t('extraPoint.saved') });
  };

  if (!point) {
    return (
      <div className="min-h-screen p-6 text-center text-muted-foreground">
        <p>{t('docs.empty')}</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>{t('common.back') || 'Back'}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate(-1)} className="absolute left-0 p-1"><ChevronLeft className="w-6 h-6" /></button>
          <h1 className="text-xl font-semibold">{kind === 'drop' ? t('dropPoint.title') : t('extraPoint.title')} #{index + 1}</h1>
        </div>
      </header>
      <div className="p-4 space-y-4">
        <div className="text-sm text-muted-foreground">{orderNumber}</div>
        <ExtraPointCard kind={kind} point={point} index={index} orderNumber={orderNumber} readOnly onOpen={() => {}} />
        {steps.map(({ step, label, needsPrev }) => {
          const at = progress[step as keyof typeof progress];
          const blocked = !!needsPrev && !progress[needsPrev as keyof typeof progress];
          return (
            <Card key={step} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{label}</span>
                {at && <span className="flex items-center gap-1 text-xs text-green-700"><CheckCircle className="w-4 h-4" />{formatDateTime(at, language)}</span>}
              </div>
              {photos[step] && <img src={photos[step]} alt={label} className="w-full max-h-56 object-contain rounded-md bg-muted" />}
              {!at && !readOnly && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={blocked} onClick={() => { pendingStep.current = step; fileRef.current?.click(); }}>
                    <Camera className="w-4 h-4 mr-1" />{t('extraPoint.photo')}
                  </Button>
                  <Button disabled={blocked || busy} onClick={() => confirm(step)}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
                  </Button>
                </div>
              )}
              {blocked && !at && <p className="text-xs text-muted-foreground">{t('jobDetail.waitingPreviousStep')}</p>}
            </Card>
          );
        })}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            const s = pendingStep.current;
            if (f && s) setPhotos((p) => ({ ...p, [s]: URL.createObjectURL(f) }));
            e.target.value = '';
          }} />
      </div>
    </div>
  );
}
