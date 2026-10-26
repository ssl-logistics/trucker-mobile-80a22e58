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

const SUM_TXT: Record<string, Tx> = {
  th: { title: 'สรุปยอดเงิน', none: 'ไม่มียอด COD', total: 'ต้องเก็บ', collected: 'เก็บแล้ว', outstanding: 'ค้าง', running: 'กำลังวิ่ง', closed: 'ปิดงานแล้ว', got: 'เก็บแล้ว', notGot: 'ยังไม่เก็บ', cash: 'เงินสด', point: 'จุดส่ง', ready: 'พร้อมเคลียร์ กดไอคอนเพื่อเคลียร์ยอด', notReady: 'ยังเคลียร์ไม่ได้', whyCollect: 'ยังเก็บไม่ครบ', whyOpen: 'งานยังไม่ปิด', how2: 'เมื่อเก็บครบและปิดงานแล้ว กดไอคอนเคลียร์ที่งาน แล้วแนบรูปสลิป' },
  en: { title: 'Payment Summary', none: 'No COD amounts', total: 'To collect', collected: 'Collected', outstanding: 'Outstanding', running: 'In progress', closed: 'Closed', got: 'Collected', notGot: 'Not yet', cash: 'Cash', point: 'Stop', ready: 'Ready — tap the icon to clear', notReady: 'Cannot clear yet', whyCollect: 'not fully collected', whyOpen: 'job not closed', how2: 'Once fully collected and closed, tap the clear icon and attach the slip' },
  zh: { title: '款项汇总', none: '没有货到付款', total: '应收', collected: '已收', outstanding: '未收', running: '进行中', closed: '已完成', got: '已收', notGot: '未收', cash: '现金', point: '送货点', ready: '可结清，点击图标结清', notReady: '暂不能结清', whyCollect: '尚未收齐', whyOpen: '订单未关闭', how2: '收齐并关闭订单后，点击结清图标并上传凭证' },
  ko: { title: '금액 요약', none: 'COD 금액이 없습니다', total: '수금액', collected: '수금 완료', outstanding: '미수금', running: '진행 중', closed: '종료됨', got: '수금 완료', notGot: '미수금', cash: '현금', point: '배송지', ready: '정산 가능 — 아이콘을 누르세요', notReady: '아직 정산 불가', whyCollect: '수금 미완료', whyOpen: '작업 미종료', how2: '수금 완료 및 작업 종료 후 정산 아이콘을 누르고 영수증을 첨부하세요' },
};

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
  const { all, loading, reload, driverId, driverType } = usePendingCodClears();
  const [selected, setSelected] = useState<CodClearRecord | null>(null);
  const S = SUM_TXT[language] || SUM_TXT.th;
  const tot = all.reduce((a, s) => ({ t: a.t + s.total, c: a.c + s.collected, o: a.o + s.outstanding }), { t: 0, c: 0, o: 0 });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="app-sticky-header bg-header text-header-foreground rounded-b-xl shadow-lg">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button onClick={() => navigate('/home')} className="absolute left-0 p-2 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">{S.title}</h1>
        </div>
      </header>

      <PullToRefresh onRefresh={reload} className="px-4 pt-5 space-y-4">
        <>
            <div className="grid grid-cols-3 gap-2">
              {[[S.total, tot.t, 'text-foreground'], [S.collected, tot.c, 'text-green-600'], [S.outstanding, tot.o, tot.o > 0 ? 'text-destructive' : 'text-foreground']].map(([l, v, c]) => (
                <div key={String(l)} className="bg-card rounded-xl p-3 shadow-sm border text-center">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  {!loaded && all.length === 0
                    ? <div className="h-6 mt-1 mx-auto w-16 rounded bg-muted animate-pulse" />
                    : <div className={`text-lg font-bold ${c}`}>฿{fmt(v as number)}</div>}
                </div>
              ))}
            </div>
            <div className="bg-card rounded-xl p-4 shadow-sm ring-1 ring-primary/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground"><Info className="w-4 h-4 text-primary" />{tx.howTitle}</div>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
                <li>{tx.how1}</li><li>{S.how2}</li><li>{tx.how3}</li>
              </ol>
            </div>
            {loaded && !loading && all.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 text-primary/60" />
                <p className="text-base">{S.none}</p>
              </div>
            )}
            {!loaded && loading && Array.from({ length: all.length ? 1 : 2 }).map((_, i) => (
              <div key={`sk${i}`} className="bg-card rounded-xl p-4 shadow-sm border space-y-3 animate-pulse">
                <div className="flex items-center gap-3"><div className="flex-1 space-y-2"><div className="h-4 w-36 rounded bg-muted" /><div className="h-3 w-16 rounded bg-muted" /></div><div className="w-12 h-12 rounded-full bg-muted" /></div>
                <div className="h-12 rounded-lg bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            )).concat([])}
            {all.map((s) => (
              <div key={s.record.order_number} className={`bg-card rounded-xl p-4 shadow-md border-2 space-y-3 ${s.canClear ? 'border-green-500/50' : 'border-destructive/30'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{s.record.order_number}</div>
                    <span className={`inline-block mt-1 text-xs rounded-full px-2 py-0.5 ${s.closed ? 'bg-muted text-foreground' : 'bg-primary/10 text-primary'}`}>{s.closed ? S.closed : S.running}</span>
                  </div>
                  <button aria-label={tx.confirm} disabled={!s.canClear} onClick={() => setSelected(s.record)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${s.canClear ? 'bg-green-600 text-primary-foreground shadow active:scale-95' : 'bg-muted text-muted-foreground'}`}>
                    <Wallet className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center bg-muted rounded-lg p-2">
                  <div><div className="text-[11px] text-muted-foreground">{S.total}</div><div className="font-bold">฿{fmt(s.total)}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">{S.collected}</div><div className="font-bold text-green-600">฿{fmt(s.collected)}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">{S.outstanding}</div><div className={`font-bold ${s.outstanding > 0 ? 'text-destructive' : ''}`}>฿{fmt(s.outstanding)}</div></div>
                </div>
                <div className="space-y-1.5">
                  {s.points.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate">{p.sequence_number ? `${p.sequence_number}. ` : ''}{p.name && p.name !== 'ไม่ระบุ' ? p.name : S.point}</span>
                      <span className="text-xs text-muted-foreground">{p.payment_method === 'qr' ? 'QR' : p.payment_method === 'cash' ? S.cash : ''}</span>
                      <span className="font-semibold">฿{fmt(p.amount)}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${p.collected ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{p.collected ? S.got : S.notGot}</span>
                    </div>
                  ))}
                </div>
                <div className={`text-xs font-medium ${s.canClear ? 'text-green-600' : 'text-destructive'}`}>
                  {s.canClear ? S.ready : `${S.notReady}: ${s.reason === 'not_collected' ? S.whyCollect : S.whyOpen}`}
                </div>
              </div>
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
