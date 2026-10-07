import { Skeleton } from '@/components/ui/skeleton';

interface JobListSkeletonProps {
  count?: number;
  /** "timeline" = job-detail step cards, "list" = job list cards */
  variant?: 'timeline' | 'list';
}

/** Faded placeholder cards shown only while data is loading. */
export function JobListSkeleton({ count = 3, variant = 'list' }: JobListSkeletonProps) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {variant === 'timeline' && (
            <Skeleton className="w-7 h-7 rounded-full shrink-0 mt-2" />
          )}
          <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden">
            <Skeleton className="h-10 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 flex-1 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
