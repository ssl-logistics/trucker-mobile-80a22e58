import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wallet, Camera, ImageIcon, Loader2, X, CheckCircle2, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/utils/imageCompression';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { usePendingCodClears } from '@/hooks/usePendingCodClears';
import { submitCodClear, codAmountMatches, type CodClearRecord } from '@/lib/codClear';

type Tx = Record<string, string>;
export const COD_CLEAR_TXT: Record<string, Tx> = {
  th: { reading: 'กำลังอ่านยอดจากสลิป...', ocrFail: 'อ่านยอดไม่ได้ กรุณาตรวจ/กรอกยอดเอง', mismatch: 'ยอดไม่ตรงกับยอดที่ต้องเคลียร์', title: 'เคลียร์ยอด', none: 'ไม่มียอดค้างเคลียร์', howTitle: 'วิธีเคลียร์ยอด', how1: 'โอนยอด COD ที่เก็บได้เข้าบัญชีบริษัท', how2: 'กดที่งาน แล้วถ่ายรูปหรือเลือกรูปสลิป', how3: 'ตรวจยอดแล้วกด "ยืนยันเคลียร์ยอด"', order: 'งาน', due: 'ยอดที่ต้องเคลียร์', amount: 'ยอดที่เคลียร์จริง', notes: 'หมายเหตุ', proof: 'รูปหลักฐาน (บังคับอย่างน้อย 1 รูป)', take: 'ถ่ายรูป', pick: 'เลือกรูป', confirm: 'ยืนยันเคลียร์ยอด', success: 'เคลียร์ยอดเรียบร้อย', uploadErr: 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง', PROOF_REQUIRED: 'กรุณาแนบรูปหลักฐานอย่างน้อย 1 รูป', ORDER_NOT_CLOSED: 'งานนี้ยังไม่ปิด ยังเคลียร์ยอดไม่ได้', ORDER_NOT_FOUND: 'ไม่พบงานนี้', COD_NOT_FOUND: 'งานนี้ไม่มียอด COD', failed: 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', pendingCount: 'งานค้างเคลียร์' },
  en: { reading: 'Reading amount from slip...', ocrFail: 'Could not read the amount, please check/enter it', mismatch: 'Amount does not match the amount to clear', title: 'Clear COD', none: 'No outstanding COD to clear', howTitle: 'How to clear', how1: 'Transfer the collected COD to the company account', how2: 'Tap the job, then take or choose the slip photo', how3: 'Check the amount and tap "Confirm clear"', order: 'Job', due: 'Amount to clear', amount: 'Amount cleared', notes: 'Notes', proof: 'Proof photo (at least 1 required)', take: 'Take photo', pick: 'Choose photo', confirm: 'Confirm clear', success: 'COD cleared', uploadErr: 'Upload failed, please try again', PROOF_REQUIRED: 'Attach at least 1 proof photo', ORDER_NOT_CLOSED: 'This job is not closed yet', ORDER_NOT_FOUND: 'Job not found', COD_NOT_FOUND: 'This job has no COD', failed: 'Failed to send, please try again', pendingCount: 'jobs to clear' },
  zh: { reading: '正在读取凭证金额...', ocrFail: '无法读取金额，请检查/手动输入', mismatch: '金额与应结清金额不符', title: '结清货款', none: '没有待结清的货款', howTitle: '结清方法', how1: '将收取的货到付款转入公司账户', how2: '点击订单，拍照或选择转账凭证', how3: '核对金额后点击"确认结清"', order: '订单', due: '应结清金额', amount: '实际结清金额', notes: '备注', proof: '凭证照片（至少1张）', take: '拍照', pick: '选择照片', confirm: '确认结清', success: '已结清', uploadErr: '上传失败，请重试', PROOF_REQUIRED: '请至少上传1张凭证', ORDER_NOT_CLOSED: '该订单尚未关闭', ORDER_NOT_FOUND: '未找到订单', COD_NOT_FOUND: '该订单没有货到付款', failed: '发送失败，请重试', pendingCount: '待结清订单' },
  ko: { reading: '영수증에서 금액 읽는 중...', ocrFail: '금액을 읽을 수 없습니다. 확인/입력해 주세요', mismatch: '정산할 금액과 일치하지 않습니다', title: 'COD 정산', none: '정산할 금액이 없습니다', howTitle: '정산 방법', how1: '수금한 COD를 회사 계좌로 이체하세요', how2: '작업을 누르고 이체 영수증을 촬영하거나 선택하세요', how3: '금액 확인 후 "정산 확인"을 누르세요', order: '작업', due: '정산할 금액', amount: '실제 정산 금액', notes: '메모', proof: '증빙 사진 (최소 1장 필수)', take: '사진 촬영', pick: '사진 선택', confirm: '정산 확인', success: '정산 완료', uploadErr: '업로드 실패, 다시 시도하세요', PROOF_REQUIRED: '증빙 사진을 1장 이상 첨부하세요', ORDER_NOT_CLOSED: '아직 종료되지 않은 작업입니다', ORDER_NOT_FOUND: '작업을 찾을 수 없습니다', COD_NOT_FOUND: '이 작업에는 COD가 없습니다', failed: '전송 실패, 다시 시도하세요', pendingCount: '정산 대기 작업' },
};

const fileToBase64 = (f: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = rej;
  r.readAsDataURL(f);
});
const fmt = (n?: number | null) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function CodClearPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tx = COD_CLEAR_TXT[language] || COD_CLEAR_TXT.th;
  const { items, loading, reload, driverId, driverType } = usePendingCodClears();
  const [selected, setSelected] = useState<CodClearRecord | null>(null);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl shadow-lg">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-2 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{tx.title}</h1>
        </div>
      </header>

      <PullToRefresh onRefresh={reload} className="px-4 pt-5 space-y-4">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 text-primary/60" />
            <p className="text-base">{tx.none}</p>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-xl p-4 shadow-sm ring-1 ring-primary/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground"><Info className="w-4 h-4 text-primary" />{tx.howTitle}</div>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>{tx.how1}</li><li>{tx.how2}</li><li>{tx.how3}</li>
              </ol>
            </div>
            {items.map((it) => (
              <button key={it.order_number} onClick={() => setSelected(it)} className="w-full text-left bg-card rounded-xl p-4 border-2 border-destructive/30 shadow-md active:border-destructive/60 transition-colors flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-muted-foreground">{tx.order}</div>
                  <div className="font-semibold text-foreground truncate">{it.order_number}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{tx.due}</div>
                  <div className="font-bold text-destructive">฿{fmt(it.expected_total)}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </>
        )}
      </PullToRefresh>

      {selected && (
        <ClearDialog
          record={selected}
          tx={tx}
          driverId={driverId}
          driverType={driverType}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); reload(); }}
        />
      )}
    </div>
  );
}

function ClearDialog({ record, tx, driverId, driverType, onClose, onDone }: {
  record: CodClearRecord; tx: Tx; driverId: string; driverType: 'internal' | 'external' | 'freelance';
  onClose: () => void; onDone: () => void;
}) {
  const { isNative, takePhoto, selectFromGallery } = useNativeCamera();
  const [amount, setAmount] = useState('');
  const [reading, setReading] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const matches = codAmountMatches(amount, record.expected_total);
  const [notes, setNotes] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    const added: string[] = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', await compressImage(f));
      fd.append('folder', 'mobile/cod-clear');
      fd.append('filename', `${record.order_number}-clear-${Date.now()}-${added.length}`);
      const { data, error } = await supabase.functions.invoke('upload-to-s3', { body: fd });
      if (error || !data?.url) { toast({ title: tx.uploadErr, variant: 'destructive' }); continue; }
      added.push(data.url);
    }
    setUploading(false);
    readAmount(files[files.length - 1]);
    if (added.length) setUrls((u) => [...u, ...added].slice(0, 20));
  };
  const readAmount = async (f: File) => {
    setReading(true); setOcrFailed(false);
    try {
      const b64 = await fileToBase64(await compressImage(f));
      const { data } = await supabase.functions.invoke('ocr-extract', {
        body: { image_base64: b64, extraction_type: 'payment_slip', expected_amount: record.expected_total ?? undefined },
      });
      const a = Number((data as any)?.data?.amount);
      if ((data as any)?.success && Number.isFinite(a) && a > 0) setAmount(String(a));
      else setOcrFailed(true);
    } catch { setOcrFailed(true); }
    setReading(false);
  };
  const onTake = async () => { if (isNative) { const f = await takePhoto(); if (f) upload([f]); } else camRef.current?.click(); };
  const onPick = async () => { if (isNative) { const f = await selectFromGallery(); if (f) upload([f]); } else galRef.current?.click(); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => { const f = Array.from(e.target.files || []); e.target.value = ''; upload(f); };

  const send = async () => {
    if (!urls.length) { toast({ title: tx.PROOF_REQUIRED, variant: 'destructive' }); return; }
    setSending(true);
    const amt = Number(amount);
    const { data, error } = await submitCodClear({
      order_number: record.order_number,
      ...(Number.isFinite(amt) && amount !== '' ? { amount: amt } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      proof_urls: urls,
      driver_type: driverType,
      driver_id: driverId,
    });
    setSending(false);
    if (error) {
      const code = data?.code || data?.error_code || data?.error || '';
      toast({ title: tx[code] || tx.failed, variant: 'destructive' });
      return;
    }
    toast({ title: tx.success });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>{tx.title} · {record.order_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted rounded-xl p-3">
            <span className="text-sm text-muted-foreground">{tx.due}</span>
            <span className="text-lg font-bold text-destructive">฿{fmt(record.expected_total)}</span>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{tx.amount}</label>
            <Input inputMode="decimal" value={amount} disabled={reading} aria-invalid={amount !== '' && !matches}
              className={amount !== '' && !matches ? 'border-destructive focus-visible:ring-destructive' : ''}
              onChange={(e) => { setOcrFailed(false); setAmount(e.target.value.replace(/[^0-9.]/g, '')); }} />
            {reading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{tx.reading}</p>}
            {!reading && ocrFailed && <p className="text-xs text-muted-foreground">{tx.ocrFail}</p>}
            {!reading && amount !== '' && !matches && <p className="text-xs text-destructive">{tx.mismatch} (฿{fmt(record.expected_total)})</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{tx.notes}</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{tx.proof}</label>
            {urls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {urls.map((u) => (
                  <div key={u} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={u} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setUrls((x) => x.filter((y) => y !== u))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/90 flex items-center justify-center">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-11 gap-2" disabled={uploading} onClick={onTake}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}{tx.take}
              </Button>
              <Button variant="secondary" className="h-11 gap-2" disabled={uploading} onClick={onPick}>
                <ImageIcon className="w-4 h-4" />{tx.pick}
              </Button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInput} />
            <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={onInput} />
          </div>
          <Button className="w-full h-12" disabled={!urls.length || uploading || reading || sending || !matches} onClick={send}>
            {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{tx.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
