import { useEffect, useRef, useState } from 'react';
import { Banknote, Camera, ImageIcon, Loader2, QrCode, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/utils/imageCompression';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import type { CodInfo } from '@/lib/cod';

const TXT: Record<string, Record<string, string>> = {
  th: { title: 'เก็บเงินปลายทาง (COD)', cash: 'เงินสด', qr: 'QR', openQr: 'เปิด QR รับเงิน', qrTitle: 'สแกน QR เพื่อชำระเงิน', qrMock: 'QR ตัวอย่าง (ทดสอบ)', confirmQr: 'ยืนยันรับเงินแล้ว', qrDone: 'ยืนยันรับเงินผ่าน QR แล้ว', proof: 'รูปหลักฐานการรับเงิน (บังคับ)', take: 'ถ่ายรูป', pick: 'เลือกรูป', needQr: 'กรุณาเปิด QR และยืนยันรับเงินก่อน', needPhoto: 'กรุณาแนบรูปหลักฐานการรับเงินอย่างน้อย 1 รูป', uploadErr: 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง' },
  en: { title: 'Cash on delivery (COD)', cash: 'Cash', qr: 'QR', openQr: 'Open payment QR', qrTitle: 'Scan QR to pay', qrMock: 'Sample QR (test)', confirmQr: 'Payment received', qrDone: 'QR payment confirmed', proof: 'Payment proof photo (required)', take: 'Take photo', pick: 'Choose photo', needQr: 'Open the QR and confirm payment first', needPhoto: 'Attach at least 1 payment proof photo', uploadErr: 'Upload failed, please try again' },
  zh: { title: '货到付款 (COD)', cash: '现金', qr: '二维码', openQr: '打开收款二维码', qrTitle: '扫码付款', qrMock: '示例二维码（测试）', confirmQr: '已收款', qrDone: '已确认二维码收款', proof: '收款凭证照片（必填）', take: '拍照', pick: '选择照片', needQr: '请先打开二维码并确认收款', needPhoto: '请至少上传1张收款凭证', uploadErr: '上传失败，请重试' },
  ko: { title: '착불 (COD)', cash: '현금', qr: 'QR', openQr: '결제 QR 열기', qrTitle: 'QR 스캔 결제', qrMock: '샘플 QR (테스트)', confirmQr: '결제 받음', qrDone: 'QR 결제 확인됨', proof: '결제 증빙 사진 (필수)', take: '사진 촬영', pick: '사진 선택', needQr: '먼저 QR을 열고 결제를 확인하세요', needPhoto: '결제 증빙 사진을 1장 이상 첨부하세요', uploadErr: '업로드 실패, 다시 시도하세요' },
};

export function useCodText() {
  const { language } = useLanguage();
  return TXT[language] || TXT.th;
}

export interface CodState { qrConfirmed: boolean; urls: string[] }

interface Props {
  cod: CodInfo;
  storageKey: string;
  filenamePrefix: string;
  readOnly?: boolean;
  onChange: (s: CodState & { ready: boolean }) => void;
}

function MockQr() {
  // Deterministic decorative grid — a mockup, not a real payment QR.
  const n = 21;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) cells.push(((i * 7919) % 13) < 6);
  const finder = (r: number, c: number) =>
    [[0, 0], [0, n - 7], [n - 7, 0]].some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);
  return (
    <div className="grid bg-background p-3 rounded-xl ring-1 ring-border" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, width: 220, height: 220 }}>
      {cells.map((on, i) => {
        const r = Math.floor(i / n), c = i % n;
        let fill = on;
        if (finder(r, c)) {
          const fr = r < 7 ? 0 : n - 7, fc = c < 7 ? 0 : n - 7;
          const dr = r - fr, dc = c - fc;
          fill = dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
        }
        return <div key={i} className={fill ? 'bg-foreground' : ''} />;
      })}
    </div>
  );
}

export default function CodCollectSection({ cod, storageKey, filenamePrefix, readOnly, onChange }: Props) {
  const tx = useCodText();
  const { isNative, takePhoto, selectFromGallery } = useNativeCamera();
  const [state, setState] = useState<CodState>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '') as CodState; } catch { return { qrConfirmed: false, urls: [] }; }
  });
  const [qrOpen, setQrOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const needQr = cod.method === 'qr';

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* noop */ }
    onChange({ ...state, ready: state.urls.length > 0 && (!needQr || state.qrConfirmed) });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    const added: string[] = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', await compressImage(f));
      fd.append('folder', 'mobile/cod-proofs');
      fd.append('filename', `${filenamePrefix}-cod-${Date.now()}-${added.length}`);
      const { data, error } = await supabase.functions.invoke('upload-to-s3', { body: fd });
      if (error || !data?.url) { toast({ title: tx.uploadErr, variant: 'destructive' }); continue; }
      added.push(data.url);
    }
    setUploading(false);
    if (added.length) setState((s) => ({ ...s, urls: [...s.urls, ...added] }));
  };

  const onTake = async () => {
    if (isNative) { const f = await takePhoto(); if (f) upload([f]); } else camRef.current?.click();
  };
  const onPick = async () => {
    if (isNative) { const f = await selectFromGallery(); if (f) upload([f]); } else galRef.current?.click();
  };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    upload(files);
  };

  return (
    <div className="bg-card rounded-xl shadow-md p-4 space-y-3 ring-1 ring-primary/30">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Banknote className="w-5 h-5 text-primary" />{tx.title}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{cod.method === 'qr' ? tx.qr : cod.method === 'cash' ? tx.cash : '-'}</span>
      </div>
      <div className="text-2xl font-bold">฿{cod.amount != null ? cod.amount.toLocaleString() : '-'}</div>

      {needQr && !readOnly && (
        state.qrConfirmed ? (
          <div className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="w-4 h-4" />{tx.qrDone}</div>
        ) : (
          <Button variant="outline" className="w-full h-11 gap-2" onClick={() => setQrOpen(true)}><QrCode className="w-5 h-5" />{tx.openQr}</Button>
        )
      )}

      <div className="space-y-2">
        <div className="text-sm font-medium">{tx.proof}</div>
        {state.urls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {state.urls.map((u) => (
              <div key={u} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={u} alt="" className="w-full h-full object-cover" />
                {!readOnly && (
                  <button aria-label="remove" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 flex items-center justify-center"
                    onClick={() => setState((s) => ({ ...s, urls: s.urls.filter((x) => x !== u) }))}><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11 gap-2" disabled={uploading} onClick={onTake}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}{tx.take}
            </Button>
            <Button variant="secondary" className="h-11 gap-2" disabled={uploading} onClick={onPick}>
              <ImageIcon className="w-4 h-4" />{tx.pick}
            </Button>
          </div>
        )}
        {!readOnly && needQr && !state.qrConfirmed && <p className="text-xs text-destructive">{tx.needQr}</p>}
        {!readOnly && state.urls.length === 0 && <p className="text-xs text-destructive">{tx.needPhoto}</p>}
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInput} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={onInput} />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="text-center">{tx.qrTitle}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <MockQr />
            <div className="text-2xl font-bold">฿{cod.amount != null ? cod.amount.toLocaleString() : '-'}</div>
            <p className="text-xs text-muted-foreground">{tx.qrMock}</p>
            <Button className="w-full h-12" onClick={() => { setState((s) => ({ ...s, qrConfirmed: true })); setQrOpen(false); }}>{tx.confirmQr}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
