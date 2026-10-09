import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitDriverSignature } from '@/lib/externalApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';

export interface SignatureResult {
  signature_url: string;
  signer_name: string;
}

const TEXT: Record<string, Record<string, string>> = {
  th: { title: 'ลายเซ็นผู้รับ/ผู้ส่ง', name: 'ชื่อผู้เซ็น', hint: 'เซ็นชื่อในกรอบด้านล่าง', clear: 'ล้าง', cancel: 'ยกเลิก', confirm: 'ยืนยัน', required: 'กรุณาให้ผู้รับ/ผู้ส่งเซ็นชื่อก่อนยืนยัน', failed: 'อัปโหลดลายเซ็นไม่สำเร็จ กรุณาลองใหม่', intro_title: 'เซ็นลายเซ็นตรงนี้', intro_desc: 'ให้ผู้รับ/ผู้ส่งกรอกชื่อและเซ็นชื่อในกรอบด้านล่าง แล้วกดยืนยัน', intro_ack: 'รับทราบ' },
  en: { title: 'Sender/Receiver signature', name: 'Signer name', hint: 'Sign inside the box below', clear: 'Clear', cancel: 'Cancel', confirm: 'Confirm', required: 'Please get a signature before confirming', failed: 'Signature upload failed, please try again', intro_title: 'Sign here', intro_desc: 'Have the sender/receiver enter their name and sign in the box below, then tap Confirm', intro_ack: 'Got it' },
  ko: { title: '수령인/발송인 서명', name: '서명자 이름', hint: '아래 상자에 서명하세요', clear: '지우기', cancel: '취소', confirm: '확인', required: '확인 전에 서명을 받아주세요', failed: '서명 업로드 실패, 다시 시도하세요', intro_title: '여기에 서명하세요', intro_desc: '수령인/발송인이 이름을 입력하고 아래 상자에 서명한 후 확인을 누르세요', intro_ack: '확인했습니다' },
  zh: { title: '收货人/发货人签名', name: '签名人姓名', hint: '请在下方框内签名', clear: '清除', cancel: '取消', confirm: '确认', required: '确认前请先签名', failed: '签名上传失败，请重试', intro_title: '在此签名', intro_desc: '请收货人/发货人填写姓名并在下方框内签名，然后点击确认', intro_ack: '知道了' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderCode: string;
  pointKey: string;
  onSigned: (result: SignatureResult) => void;
}

export default function SignatureDialog({ open, onOpenChange, orderCode, pointKey, onSigned }: Props) {
  const { language } = useLanguage();
  const tx = TEXT[language] || TEXT.th;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  // First-time intro card: shown once per account (every time on preview hosts).
  const introUserId = String(localStorage.getItem('auth_driver_id') || '');
  const introKey = introUserId ? `signature_intro_ack:${introUserId}` : '';
  const isPreviewHost = typeof window !== 'undefined' && window.location.hostname.includes('id-preview--');
  const [showIntro, setShowIntro] = useState(() => isPreviewHost || (!!introKey && localStorage.getItem(introKey) !== '1'));
  const ackIntro = () => {
    if (introKey) try { localStorage.setItem(introKey, '1'); } catch { /* noop */ }
    setShowIntro(false);
  };

  // Size canvas to its box once dialog opens
  useEffect(() => {
    if (!open) return;
    setHasInk(false);
    const id = requestAnimationFrame(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext('2d')!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (showIntro) ackIntro();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };
  const up = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const confirm = async () => {
    const c = canvasRef.current;
    if (!c || !hasInk) {
      toast({ title: tx.required, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = c.toDataURL('image/png');
      const signerName = name.trim();
      const isDelivery = pointKey.startsWith('delivery') || pointKey === 'container_return';
      const seqMatch = pointKey.match(/^delivery_(\d+)$/);
      const signedAt = new Date().toISOString();
      const result = { signature_url: '', signer_name: signerName };
      try { localStorage.setItem(`signature_${orderCode}_${pointKey}`, JSON.stringify({ signer_name: signerName, signed_at: signedAt })); } catch { /* noop */ }
      // Fire-and-forget: never blocks the check-in/SOP/POD flow.
      const send = (lat?: number, lng?: number) => {
        submitDriverSignature({
          order_number: orderCode,
          checkin_type: isDelivery ? 'delivery' : 'pickup',
          destination_sequence_number: seqMatch ? Number(seqMatch[1]) : null,
          signer_name: signerName || '-',
          signature_base64: dataUrl,
          signed_at: signedAt,
          ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
          ...(localStorage.getItem('auth_driver_id') ? { driver_id: String(localStorage.getItem('auth_driver_id')) } : {}),
        }).then(({ error }) => {
          if (error) { console.warn('[signature] send failed', error); toast({ title: tx.failed, variant: 'destructive' }); }
        });
      };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((p) => send(p.coords.latitude, p.coords.longitude), () => send(), { timeout: 3000, maximumAge: 60000 });
      } else send();
      onOpenChange(false);
      onSigned(result);
    } catch (err) {
      console.warn('[signature] upload failed', err);
      toast({ title: tx.failed, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-[92vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{tx.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {showIntro && (
            <div className="rounded-xl border-2 border-orange-500 bg-orange-50 dark:bg-orange-500/10 p-3 space-y-2">
              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{tx.intro_title}</p>
              <p className="text-sm text-muted-foreground">{tx.intro_desc}</p>
              <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={ackIntro}>
                {tx.intro_ack}
              </Button>
            </div>
          )}
          <div className={showIntro ? 'rounded-xl ring-2 ring-orange-500 ring-offset-2 p-2 space-y-3' : 'space-y-3'}>
          <Input placeholder={tx.name} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-sm text-muted-foreground">{tx.hint}</p>
          <canvas
            ref={canvasRef}
            className="w-full h-48 rounded-lg border-2 border-dashed border-border bg-background touch-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            onPointerCancel={up}
          />
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={clear} disabled={busy}>{tx.clear}</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tx.cancel}</Button>
            <Button onClick={confirm} disabled={!hasInk || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tx.confirm}
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
