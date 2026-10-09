import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, QrCode, AlertTriangle } from 'lucide-react';
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

  const corners = (
    <div className="pointer-events-none absolute inset-4 z-10">
      <span className="absolute left-0 top-0 w-8 h-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
      <span className="absolute right-0 top-0 w-8 h-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
      <span className="absolute left-0 bottom-0 w-8 h-8 border-l-4 border-b-4 border-primary rounded-bl-lg" />
      <span className="absolute right-0 bottom-0 w-8 h-8 border-r-4 border-b-4 border-primary rounded-br-lg" />
      <span className="qr-scan-line absolute left-2 right-2 h-0.5 bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <style>{SCANNER_CSS + `
          @keyframes qrScanLine { 0%,100% { top: 8%; } 50% { top: 90%; } }
          .qr-scan-line { animation: qrScanLine 2.4s ease-in-out infinite; }
        `}</style>
        <DialogHeader>
          <DialogTitle className="text-center">{t('loadingQr.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center -mt-1">{t('loadingQr.hint')}</p>
        {cameraError ? (
          <div className="w-full aspect-square rounded-2xl bg-muted ring-1 ring-border flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-sm text-muted-foreground">{t('loadingQr.cameraError')}</p>
          </div>
        ) : cameraOn ? (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden ring-1 ring-border shadow-md">
            <div id={REGION_ID} className="w-full h-full" />
            {corners}
          </div>
        ) : (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-foreground/90 flex items-center justify-center shadow-md">
            {corners}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
                <QrCode className="w-12 h-12 text-primary" />
              </div>
            </div>
          </div>
        )}
        {!cameraOn && !cameraError && (
          <Button className="w-full h-12 text-base gap-2 rounded-xl" onClick={() => setCameraOn(true)}>
            <Camera className="w-5 h-5" />
            {t('loadingQr.openCamera')}
          </Button>
        )}
        <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => { doneRef.current = true; onDone(null); }}>
          {t('loadingQr.skip')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
