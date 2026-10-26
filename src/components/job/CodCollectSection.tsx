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
import { QRCodeSVG } from 'qrcode.react';
import { createCodQr, checkCodQr, secondsLeft, formatCountdown, type CodQr } from '@/lib/codQr';

const TXT: Record<string, Record<string, string>> = {
  th: { title: 'เก็บเงินปลายทาง (COD)', cash: 'เงินสด', qr: 'QR', openQr: 'เปิด QR รับเงิน', qrTitle: 'สแกน QR เพื่อชำระเงิน', qrMock: 'QR ตัวอย่าง (ทดสอบ)', confirmQr: 'ยืนยันรับเงินแล้ว', qrDone: 'ยืนยันรับเงินผ่าน QR แล้ว', proof: 'รูปหลักฐานการรับเงิน (บังคับ)', take: 'ถ่ายรูป', pick: 'เลือกรูป', needQr: 'กรุณาเปิด QR และยืนยันรับเงินก่อน', needPhoto: 'กรุณาแนบรูปหลักฐานการรับเงินอย่างน้อย 1 รูป', uploadErr: 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง', creating: 'กำลังสร้าง QR...', waiting: 'รอลูกค้าชำระ...', expiresIn: 'หมดอายุใน', expired: 'QR หมดอายุ', regen: 'สร้าง QR ใหม่', paid: 'รับเงินผ่าน QR แล้ว', fail: 'สร้าง/ตรวจ QR ไม่ได้ กรุณาแนบรูปสลิปแทน', retry: 'ลองใหม่', proofOpt: 'รูปหลักฐาน (ไม่บังคับเมื่อชำระ QR สำเร็จ)' },
  en: { title: 'Cash on delivery (COD)', cash: 'Cash', qr: 'QR', openQr: 'Open payment QR', qrTitle: 'Scan QR to pay', qrMock: 'Sample QR (test)', confirmQr: 'Payment received', qrDone: 'QR payment confirmed', proof: 'Payment proof photo (required)', take: 'Take photo', pick: 'Choose photo', needQr: 'Open the QR and confirm payment first', needPhoto: 'Attach at least 1 payment proof photo', uploadErr: 'Upload failed, please try again', creating: 'Creating QR...', waiting: 'Waiting for payment...', expiresIn: 'Expires in', expired: 'QR expired', regen: 'Create new QR', paid: 'QR payment received', fail: 'QR unavailable, please attach the slip photo instead', retry: 'Retry', proofOpt: 'Proof photo (optional once QR is paid)' },
  zh: { title: '货到付款 (COD)', cash: '现金', qr: '二维码', openQr: '打开收款二维码', qrTitle: '扫码付款', qrMock: '示例二维码（测试）', confirmQr: '已收款', qrDone: '已确认二维码收款', proof: '收款凭证照片（必填）', take: '拍照', pick: '选择照片', needQr: '请先打开二维码并确认收款', needPhoto: '请至少上传1张收款凭证', uploadErr: '上传失败，请重试', creating: '正在生成二维码...', waiting: '等待付款...', expiresIn: '剩余', expired: '二维码已过期', regen: '重新生成二维码', paid: '已通过二维码收款', fail: '二维码不可用，请改为上传付款凭证', retry: '重试', proofOpt: '凭证照片（二维码付款成功后可不传）' },
  ko: { title: '착불 (COD)', cash: '현금', qr: 'QR', openQr: '결제 QR 열기', qrTitle: 'QR 스캔 결제', qrMock: '샘플 QR (테스트)', confirmQr: '결제 받음', qrDone: 'QR 결제 확인됨', proof: '결제 증빙 사진 (필수)', take: '사진 촬영', pick: '사진 선택', needQr: '먼저 QR을 열고 결제를 확인하세요', needPhoto: '결제 증빙 사진을 1장 이상 첨부하세요', uploadErr: '업로드 실패, 다시 시도하세요', creating: 'QR 생성 중...', waiting: '결제 대기 중...', expiresIn: '만료까지', expired: 'QR 만료됨', regen: '새 QR 생성', paid: 'QR 결제 완료', fail: 'QR을 사용할 수 없습니다. 영수증 사진을 첨부하세요', retry: '다시 시도', proofOpt: '증빙 사진 (QR 결제 완료 시 선택)' },
};

export function useCodText() {
  const { language } = useLanguage();
  return TXT[language] || TXT.th;
}

export interface CodState { qrConfirmed: boolean; urls: string[]; qr?: CodQr | null; qrFailed?: boolean }

interface Props {
  cod: CodInfo;
  storageKey: string;
  filenamePrefix: string;
  readOnly?: boolean;
  onChange: (s: CodState & { ready: boolean }) => void;
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
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const left = secondsLeft(state.qr?.expiresAt, now);
  const expired = left === 0;

  const makeQr = async () => {
    if (!cod.amount) return;
    setCreating(true);
    try {
      const qr = await createCodQr(cod.amount, storageKey);
      setState((s) => ({ ...s, qr, qrFailed: false }));
    } catch {
      setState((s) => ({ ...s, qrFailed: true }));
      toast({ title: tx.fail, variant: 'destructive' });
    } finally { setCreating(false); }
  };
  const openQr = () => {
    setQrOpen(true);
    if (!state.qr || secondsLeft(state.qr.expiresAt) === 0) makeQr();
  };

  // countdown tick
  useEffect(() => {
    if (!qrOpen || !state.qr) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qrOpen, state.qr]);

  // poll payment status every 4s while pending and not expired
  useEffect(() => {
    const pid = state.qr?.paymentId;
    if (!qrOpen || !pid || state.qrConfirmed || expired) return;
    let fails = 0;
    const t = setInterval(async () => {
      try {
        const r = await checkCodQr(pid);
        fails = 0;
        if (r.paid) { setState((s) => ({ ...s, qrConfirmed: true })); setQrOpen(false); }
      } catch {
        fails += 1;
        if (fails >= 3) { setState((s) => ({ ...s, qrFailed: true })); }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [qrOpen, state.qr?.paymentId, state.qrConfirmed, expired]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* noop */ }
    onChange({ ...state, ready: needQr ? (state.qrConfirmed || state.urls.length > 0) : state.urls.length > 0 });
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
          <Button variant="outline" className="w-full h-11 gap-2" onClick={openQr}><QrCode className="w-5 h-5" />{tx.openQr}</Button>
        )
      )}

      <div className="space-y-2">
        <div className="text-sm font-medium">{needQr && state.qrConfirmed ? tx.proofOpt : tx.proof}</div>
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
        {!readOnly && needQr && state.qrFailed && !state.qrConfirmed && <p className="text-xs text-destructive">{tx.fail}</p>}
        {!readOnly && state.urls.length === 0 && !(needQr && state.qrConfirmed) && <p className="text-xs text-destructive">{tx.needPhoto}</p>}
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInput} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={onInput} />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="text-center">{tx.qrTitle}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {creating ? (
              <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" />{tx.creating}</div>
            ) : state.qr && !expired ? (
              <div className="bg-background p-3 rounded-xl ring-1 ring-border">
                {state.qr.qrRaw ? <QRCodeSVG value={state.qr.qrRaw} size={220} level="M" /> : <img src={state.qr.qrImage!} alt="QR" className="w-[220px] h-[220px]" />}
              </div>
            ) : state.qr && expired ? (
              <div className="w-[220px] h-[220px] flex flex-col items-center justify-center gap-3 rounded-xl bg-muted text-destructive font-semibold">{tx.expired}</div>
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-center text-sm text-destructive px-4">{tx.fail}</div>
            )}
            <div className="text-2xl font-bold">฿{cod.amount != null ? cod.amount.toLocaleString() : '-'}</div>
            {state.qr && !expired && !creating && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />{tx.waiting}</div>
                {left != null && <div className="text-sm">{tx.expiresIn} <span className="font-bold tabular-nums">{formatCountdown(left)}</span></div>}
              </>
            )}
            {!creating && (expired || !state.qr) && (
              <Button className="w-full h-12" onClick={makeQr}>{state.qr ? tx.regen : tx.retry}</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
