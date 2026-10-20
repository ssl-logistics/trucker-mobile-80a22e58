import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent aria-describedby={undefined}
            className="w-[94vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0 bg-background [&>button]:hidden [&_.min-h-screen]:min-h-full [&_.fixed.bottom-0]:sticky [&_.fixed.bottom-0]:z-40"
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <Routes location={location}>{steps}</Routes>
            </Suspense>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
