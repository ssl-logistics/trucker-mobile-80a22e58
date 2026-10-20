import { useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Camera, Image as ImageIcon, Loader2, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BackButton } from '@/components/layout/BackButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { driverCheckin } from '@/lib/externalApi';
import { compressImage } from '@/utils/imageCompression';
import { ExtraCheckinType, ExtraPoint, extraPointAddress, recordExtraCheckin } from '@/lib/extraPoints';

const TYPES: ExtraCheckinType[] = ['extra_cargo', 'extra_drop', 'extra_drop_pickup'];

// Main-system error codes (driver-checkin) -> readable messages
const ERR: Record<string, { th: string; en: string; zh: string; ko: string }> = {
  PHOTO_REQUIRED: { th: 'ต้องแนบรูปอย่างน้อย 1 รูป', en: 'Please attach at least 1 photo', zh: '请至少附上1张照片', ko: '사진을 1장 이상 첨부하세요' },
  EXTRA_POINT_NOT_FOUND: { th: 'ไม่พบจุดนี้ในงาน', en: 'This stop was not found in the job', zh: '未找到该站点', ko: '이 지점을 찾을 수 없습니다' },
  EXTRA_POINT_INVALID_STATE: { th: 'ยังไม่ได้ดรอปตู้ที่จุดนี้', en: 'Container has not been dropped here yet', zh: '尚未在此放下集装箱', ko: '아직 컨테이너를 내려놓지 않았습니다' },
  CONTAINER_AT_DROP_POINT: { th: 'ตู้ยังอยู่ที่ลานดรอป ต้องรับตู้คืนก่อน', en: 'Container is still at the drop yard. Pick it up first', zh: '集装箱仍在堆场，请先取回', ko: '컨테이너가 아직 야드에 있습니다. 먼저 회수하세요' },
  EXTRA_POINTS_INCOMPLETE: { th: 'ยังทำจุดเพิ่มไม่ครบ คืนตู้ไม่ได้', en: 'Extra stops are not complete yet', zh: '附加站点尚未完成', ko: '추가 지점이 아직 완료되지 않았습니다' },
};

function getPosition(): Promise<{ latitude?: number; longitude?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}

export interface ExtraCheckinState {
  point?: ExtraPoint; orderNumber?: string; orderId?: string; title?: string;
  driverId?: string; driverType?: 'internal' | 'external' | 'freelance';
}

export default function ExtraPointCheckinPage() {
  const navigate = useNavigate();
  const { type, seq } = useParams();
  const { t } = useLanguage();
  const st = (useLocation().state || {}) as ExtraCheckinState;
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      <div className="bg-[#225795] text-white px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-2">
        <BackButton />
        <h1 className="font-semibold text-base">{st.title || t('extraPoint.stepCheckIn')}</h1>
      </div>
      <div className="p-4">
        <ExtraPointCheckinForm type={type} seq={seq} st={st} onDone={() => navigate(-1)} />
      </div>
    </div>
  );
}

/** Photo + notes check-in form for an extra point; used by the page and the job-detail popup. */
export function ExtraPointCheckinForm({ type, seq, st, onDone, onCancel, children }: {
  type?: string; seq?: string | number; st: ExtraCheckinState;
  onDone: () => void; onCancel?: () => void; children?: ReactNode;
}) {
  const { t, language } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const ctype = TYPES.includes(type as ExtraCheckinType) ? (type as ExtraCheckinType) : null;
  const sequence = Number(seq);
  const point = st.point;

  const addFiles = (list: FileList | null) => {
    if (list?.length) setFiles((f) => [...f, ...Array.from(list)]);
  };

  const upload = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', await compressImage(file));
    fd.append('folder', `extra-points/${st.orderNumber}`);
    const { data, error } = await supabase.functions.invoke('upload-to-s3', { body: fd });
    return error || !data?.url ? null : (data.url as string);
  };

  const submit = async () => {
    if (!ctype || !st.orderNumber || !st.driverId || !(sequence > 0)) return;
    if (!files.length) {
      toast({ title: t('extraPoint.photoRequired'), variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const [urls, pos] = await Promise.all([Promise.all(files.map(upload)), getPosition()]);
      const photoUrls = urls.filter(Boolean) as string[];
      if (photoUrls.length !== files.length) throw new Error(t('extraPoint.failed'));
      const { data: resp, error } = await driverCheckin({
        order_number: st.orderNumber,
        driver_id: st.driverId,
        driver_type: st.driverType || 'freelance',
        checkin_type: ctype,
        extra_point_sequence: sequence,
        photo_urls: photoUrls,
        notes: notes.trim() || undefined,
        ...pos,
      });
      if (error) {
        const code = Object.keys(ERR).find((k) => String((resp as any)?.error_code || error).includes(k));
        throw new Error(code ? (ERR[code][language as 'th'] || ERR[code].en) : error);
      }
      recordExtraCheckin(st.orderNumber, ctype, sequence);
      toast({ title: t('extraPoint.success') });
      onDone();
    } catch (e) {
      toast({ title: t('extraPoint.failed'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="space-y-4">
        {point && (
          <div className="bg-white rounded-2xl p-4 text-sm space-y-1">
            <div className="flex gap-2"><MapPin className="w-4 h-4 text-[#225795] mt-0.5 shrink-0" />
              <span className="font-semibold text-[#225795]">{point.location_name || '-'}</span></div>
            {extraPointAddress(point) && <div className="text-[#454545] pl-6">{extraPointAddress(point)}</div>}
            <div className="text-xs text-muted-foreground pl-6">{st.orderNumber}</div>
          </div>
        )}

        {children}

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div className="text-sm font-medium text-[#454545]">{t('extraPoint.addPhoto')} *</div>
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                <button type="button" className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  onClick={() => setFiles((l) => l.filter((_, j) => j !== i))}>
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="gap-1.5 text-[#225795] border-[#225795]/30" onClick={() => camRef.current?.click()}>
              <Camera className="w-4 h-4" />{t('extraPoint.photo')}
            </Button>
            <Button type="button" variant="outline" className="gap-1.5 text-[#225795] border-[#225795]/30" onClick={() => galRef.current?.click()}>
              <ImageIcon className="w-4 h-4" />{t('extraPoint.addPhoto')}
            </Button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-2">
          <div className="text-sm font-medium text-[#454545]">{t('extraPoint.notes')}</div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>

        <div className={onCancel ? 'grid grid-cols-2 gap-2' : ''}>
          {onCancel && (
            <Button type="button" variant="outline" className="w-full h-12" disabled={sending} onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
          <Button className="w-full h-12 bg-[#225795] hover:bg-[#1b4778] text-white" disabled={sending || !ctype || !files.length} onClick={submit}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('extraPoint.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
