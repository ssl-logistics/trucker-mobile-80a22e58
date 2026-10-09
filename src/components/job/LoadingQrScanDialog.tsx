import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (value: string | null) => void;
}

const REGION_ID = 'loading-qr-region';

// Override styles injected by html5-qrcode: hide its status text ("Scanner paused"),
// links/images and white background, and make the camera video fill the box.
const SCANNER_CSS = `
  #${REGION_ID} { position: relative; background: hsl(var(--foreground) / 0.9); border: none; }
  #${REGION_ID} video { width: 100% !important; height: 100% !important; object-fit: cover; display: block; }
  #${REGION_ID} img, #${REGION_ID} a, #${REGION_ID} button, #${REGION_ID} select { display: none !important; }
  #${REGION_ID} span { display: none !important; }
  #${REGION_ID} canvas { display: none !important; }
  #${REGION_ID} #qr-shaded-region { inset: 0 !important; }
`;

export default function LoadingQrScanDialog({ open, onOpenChange, onDone }: Props) {
  const { t } = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const doneRef = useRef(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  // Reset every time the dialog opens; the camera stays off until the driver taps "open camera".
  useEffect(() => {
    if (open) { doneRef.current = false; setCameraError(false); }
    setCameraOn(false);
  }, [open]);

  useEffect(() => {
    if (!open || !cameraOn) return;
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
  }, [open, cameraOn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <style>{SCANNER_CSS}</style>
        <DialogHeader>
          <DialogTitle className="text-center">{t('loadingQr.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center">{t('loadingQr.hint')}</p>
        {cameraError ? (
          <div className="rounded-lg bg-muted p-4 text-sm text-center text-muted-foreground">{t('loadingQr.cameraError')}</div>
        ) : cameraOn ? (
          <div className="w-full aspect-square rounded-xl overflow-hidden ring-1 ring-border shadow-sm">
            <div id={REGION_ID} className="w-full h-full" />
          </div>
        ) : (
          <div className="w-full aspect-square rounded-xl bg-muted ring-1 ring-border flex flex-col items-center justify-center gap-4 p-4">
            <Camera className="w-12 h-12 text-muted-foreground" />
            <Button className="w-full" onClick={() => setCameraOn(true)}>
              {t('loadingQr.openCamera')}
            </Button>
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => { doneRef.current = true; onDone(null); }}>
          {t('loadingQr.skip')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
