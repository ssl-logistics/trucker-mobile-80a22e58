import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Shared loading state for job detail pages (domestic, international and bid
// jobs all render through the unified detail view). Shows a skeleton of the
// detail layout plus a localized "loading" label instead of a blank screen.
export default function JobDetailLoadingState() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite">
      {/* Skeleton of the sticky header */}
      <div className="app-sticky-header bg-header text-header-foreground rounded-b-xl shadow-lg">
        <div className="flex items-center justify-center px-4 py-3">
          <div className="h-6 w-44 rounded-md bg-primary-foreground/20 animate-pulse" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Job type + status badges */}
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
        </div>

        {/* Timeline card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2/5 rounded bg-muted animate-pulse" />
        </div>

        {/* Details card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="h-4 w-1/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
        </div>

        {/* Action buttons area */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="h-10 rounded-md bg-muted animate-pulse" />
          <div className="h-10 rounded-md bg-muted animate-pulse" />
        </div>

        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    </div>
  );
}
