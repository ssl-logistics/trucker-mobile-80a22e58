import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

const JOB_RE = /^\/job\/([^/]+)$/;
const STEP_RE = /^\/job\/([^/]+)\/.+/;

/**
 * Renders app routes. When a job step page (/job/:id/...) is opened from that job's detail page,
 * the detail page stays behind and the step page opens in a bottom popup. Direct/deep-link opens
 * still render the step as a full page. Step pages keep their own logic and navigation.
 */
export default function JobStepRoutes({ children, steps }: { children: ReactNode; steps: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const bgRef = useRef<Location | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const wasSheet = useRef(false);

  const jobMatch = location.pathname.match(JOB_RE);
  const stepMatch = location.pathname.match(STEP_RE);
  if (jobMatch) bgRef.current = location;
  else if (!stepMatch || (bgRef.current && bgRef.current.pathname.match(JOB_RE)?.[1] !== stepMatch[1])) bgRef.current = null;

  const bg = stepMatch ? bgRef.current : null;
  // Remount the job page after a popup session so it re-reads the latest statuses
  const isSheet = !!bg;
  useEffect(() => {
    if (isSheet) wasSheet.current = true;
    else if (wasSheet.current) { wasSheet.current = false; setReloadKey((k) => k + 1); }
  }, [isSheet]);

  const close = () => {
    const b = bgRef.current;
    if (b) navigate(b.pathname + b.search, { state: b.state, replace: true });
  };

  return (
    <>
      <Routes key={reloadKey} location={bg || location}>{children}</Routes>
      {bg && (
        <Sheet open onOpenChange={(o) => !o && close()}>
          <SheetContent side="bottom"
            className="h-[95vh] overflow-y-auto rounded-t-2xl p-0 bg-background [&>button]:hidden [&_.min-h-screen]:min-h-full"
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="sticky top-0 z-50 flex justify-center bg-transparent py-1.5 pointer-events-none">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <Routes location={location}>{steps}</Routes>
            </Suspense>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
