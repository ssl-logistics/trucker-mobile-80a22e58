import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (value: string | null) => void;
}

const REGION_ID = 'loading-qr-region';

export default function LoadingQrScanDialog({ open, onOpenChange, onDone }: Props) {
  const { t } = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const doneRef = useRef(false);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setCameraError(false);
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const scanner = new Html5Qrcode(REGION_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (doneRef.current) return;
            doneRef.current = true;
            onDone(text);
          },
          () => {}
        );
      } catch (e) {
        console.error('QR camera error', e);
        if (!cancelled) setCameraError(true);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch { /* noop */ } });
      }
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('loadingQr.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('loadingQr.hint')}</p>
        {cameraError ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-center text-muted-foreground">{t('loadingQr.cameraError')}</div>
        ) : (
          <div id={REGION_ID} className="w-full aspect-square rounded-lg overflow-hidden bg-muted" />
        )}
        <Button variant="outline" className="w-full" onClick={() => { doneRef.current = true; onDone(null); }}>
          {t('loadingQr.skip')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
