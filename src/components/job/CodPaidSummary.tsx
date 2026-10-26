import { useState } from 'react';
import { Banknote } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePresignedImageUrl } from '@/hooks/usePresignedImageUrl';
import type { CodInfo } from '@/lib/cod';

export interface CodPaid { amount?: number | null; method?: string | null; urls?: string[]; at?: string | null; ref?: string | null }

const TXT: Record<string, Record<string, string>> = {
  th: { title: 'สรุปเก็บเงินปลายทาง (COD)', due: 'ยอดที่ต้องเก็บ', paid: 'จ่ายจริง', via: 'ผ่าน', cash: 'เงินสด', qr: 'QR', mint: 'QR Mint', coke: 'QR โค้ก', at: 'เวลารับเงิน', proof: 'รูปหลักฐานการรับเงิน', none: 'ยังไม่มีข้อมูลการรับเงิน' },
  en: { title: 'COD summary', due: 'Amount due', paid: 'Paid', via: 'via', cash: 'Cash', qr: 'QR', mint: 'Mint QR', coke: 'Coke QR', at: 'Paid at', proof: 'Payment proof', none: 'No payment record yet' },
  zh: { title: '货到付款汇总', due: '应收金额', paid: '实收', via: '方式', cash: '现金', qr: '二维码', mint: 'Mint 二维码', coke: '可乐二维码', at: '收款时间', proof: '收款凭证', none: '暂无收款记录' },
  ko: { title: 'COD 요약', due: '수금 예정액', paid: '실제 결제', via: '방법', cash: '현금', qr: 'QR', mint: 'Mint QR', coke: '코크 QR', at: '결제 시간', proof: '결제 증빙', none: '결제 기록 없음' },
};

export function codMethodLabel(m: string | null | undefined, tx: Record<string, string>) {
  if (m === 'mint_qr' || m === 'qr_mint') return tx.mint;
  if (m === 'static_qr' || m === 'qr_coke') return tx.coke;
  if (m === 'cash') return tx.cash;
  return null;
}

function Thumb({ url, onOpen }: { url: string; onOpen: (u: string) => void }) {
  const { url: src } = usePresignedImageUrl(url) as any;
  return <button type="button" onClick={() => src && onOpen(src)} className="w-16 h-16 rounded-lg overflow-hidden bg-muted ring-1 ring-border">
    {src && <img src={src} alt="" className="w-full h-full object-cover" />}
  </button>;
}

export default function CodPaidSummary({ cod, paid, formatTime }: { cod: CodInfo; paid: CodPaid | null; formatTime: (s: string) => string }) {
  const { language } = useLanguage();
  const tx = TXT[language] || TXT.th;
  const [zoom, setZoom] = useState<string | null>(null);
  const due = cod.amount;
  const dueMethod = cod.method === 'qr' ? tx.qr : tx.cash;
  const paidMethod = codMethodLabel(paid?.method, tx);
  const paidAmount = paid?.amount ?? (paid ? due : null);
  return (
    <div className="rounded-lg p-4 space-y-3 bg-accent/40 ring-1 ring-primary/20">
      <div className="font-semibold flex items-center gap-2"><Banknote className="w-5 h-5 text-primary" />{tx.title}</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-muted-foreground">{tx.due}</div><div className="font-semibold">฿{due != null ? due.toLocaleString() : '-'} <span className="font-normal text-muted-foreground">({dueMethod})</span></div></div>
        <div><div className="text-xs text-muted-foreground">{tx.paid}</div>
          {paid ? <div className="font-semibold text-primary">฿{paidAmount != null ? paidAmount.toLocaleString() : '-'}{paidMethod && <span className="font-normal text-foreground"> {tx.via} {paidMethod}</span>}</div>
            : <div className="text-muted-foreground">{tx.none}</div>}
        </div>
      </div>
      {paid?.ref && <div className="text-xs text-muted-foreground break-all">Ref: {paid.ref}</div>}
      {paid?.at && <div className="text-xs text-muted-foreground">{tx.at}: {formatTime(paid.at)}</div>}
      {!!paid?.urls?.length && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{tx.proof}</div>
          <div className="flex flex-wrap gap-2">{paid.urls.map((u) => <Thumb key={u} url={u} onOpen={setZoom} />)}</div>
        </div>
      )}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="w-[94vw] max-w-lg p-2">{zoom && <img src={zoom} alt="" className="w-full rounded-lg" />}</DialogContent>
      </Dialog>
    </div>
  );
}
