import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, useLocation, useNavigate, type Location } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const JOB_RE = /^\/job\/([^/]+)$/;
const STEP_RE = /^\/job\/([^/]+)\/.+/;
const LIST_RE = /^\/current-jobs\/?$/;

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

  const listRef = useRef<Location | null>(null);
  const listJob = useRef<string | null>(null);

  const jobMatch = location.pathname.match(JOB_RE);
  const stepMatch = location.pathname.match(STEP_RE);

  // Job opened from the current-jobs list: keep the list behind and show the job in a centered modal
  if (LIST_RE.test(location.pathname)) { listRef.current = location; listJob.current = null; }
  else if (listRef.current) {
    const id = (jobMatch || stepMatch)?.[1] ?? null;
    if (id && listJob.current == null && jobMatch) listJob.current = id;
    if (!id || listJob.current !== id) { listRef.current = null; listJob.current = null; }
  }
  const listBg = listRef.current;
  if (jobMatch) bgRef.current = location;
  else if (!stepMatch || (bgRef.current && bgRef.current.pathname.match(JOB_RE)?.[1] !== stepMatch[1])) bgRef.current = null;

  const bg = stepMatch ? bgRef.current : null;
  // Remount the job page after a popup session so it re-reads the latest statuses
  const isSheet = !!bg || !!listBg;
  useEffect(() => {
    if (isSheet) wasSheet.current = true;
    else if (wasSheet.current) { wasSheet.current = false; setReloadKey((k) => k + 1); }
  }, [isSheet]);

  const close = () => {
    const b = bgRef.current;
    if (b) navigate(b.pathname + b.search, { state: b.state, replace: true });
  };

  if (listBg) {
    const closeList = () => navigate(listBg.pathname + listBg.search, { state: listBg.state, replace: true });
    return (
      <>
        <Routes key={reloadKey} location={listBg}>{children}</Routes>
        <Dialog open onOpenChange={(o) => !o && closeList()}>
          <DialogContent
            className="w-[94vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0 bg-background [&_.min-h-screen]:min-h-full"
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <Routes location={location}>{children}</Routes>
            </Suspense>
          </DialogContent>
        </Dialog>
      </>
    );
  }

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
