import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import JobActionButtons from '@/components/job/JobActionButtons';
import { usePresignedImageUrls } from '@/hooks/usePresignedImageUrl';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExtraPointCheckinForm, type ExtraCheckinState } from '@/pages/ExtraPointCheckinPage';
import type { ExtraCheckinType } from '@/lib/extraPoints';

export interface ExtraCheckinSheetData extends ExtraCheckinState { type: ExtraCheckinType; seq: number; jobData?: any }

/** Bottom popup with the same check-in form as the extra-point page, plus expenses/documents/problem buttons. */
export default function ExtraPointCheckinSheet({ data, onClose }: { data: ExtraCheckinSheetData | null; onClose: () => void }) {
  const { t } = useLanguage();
  const pa = data?.point as any;
  const photos: string[] = (data?.type === 'extra_drop' ? pa?.dropped_photo_urls
    : data?.type === 'extra_drop_pickup' ? pa?.picked_up_photo_urls : pa?.completed_photo_urls) || [];
  const { urls } = usePresignedImageUrls(photos);

  return (
    <Sheet open={!!data} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[#F5F7FA] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="text-[#225795]">{data?.title || t('extraPoint.stepCheckIn')}</SheetTitle>
        </SheetHeader>
        {data && (
          <ExtraPointCheckinForm key={`${data.type}-${data.seq}`} type={data.type} seq={data.seq} st={data}
            onDone={onClose} onCancel={onClose}>
            <JobActionButtons jobId={data.orderNumber || ''} orderNumber={data.orderNumber || ''} jobData={data.jobData} />
            {photos.length > 0 && (
              <div className="bg-white rounded-2xl p-4 space-y-2">
                <div className="text-sm font-medium text-[#454545]">{t('extraPoint.photos')}</div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <a key={i} href={urls[i] || p} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-gray-100 block">
                      {urls[i] && <img src={urls[i]!} alt="" className="w-full h-full object-cover" />}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </ExtraPointCheckinForm>
        )}
      </SheetContent>
    </Sheet>
  );
}
