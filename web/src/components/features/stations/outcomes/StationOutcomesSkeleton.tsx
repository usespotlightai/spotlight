import { Settings2 } from 'lucide-react';
import { OUTCOME_COLUMNS } from '@/components/features/stations/outcomes/columns';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

export function StationOutcomesSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how its runs turned out"
      className="flex flex-col rounded-xl border border-border bg-card"
    >
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-2 text-xs">
        <p className="flex min-w-0 items-center gap-1.5">
          <Settings2 className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="font-medium text-foreground">Config</span>
          <SkeletonLine className="w-14" />
        </p>
        <SkeletonLine className="w-24" />
        <SkeletonLine className="w-40" />
      </div>

      <div className="flex flex-col border-border border-t p-1">
        <div
          className={cn(
            'grid h-9 items-center gap-2 px-2 text-sm',
            OUTCOME_COLUMNS,
          )}
        >
          <SkeletonLine className="w-20" />
          <SkeletonLine className="w-10 text-xs" />
          <SkeletonLine className="w-14 text-xs" />
          <SkeletonLine className="w-10 text-xs" />
          <SkeletonLine className="w-10 text-xs" />
          <SkeletonLine className="ml-auto w-6 text-xs" />
          <SkeletonLine className="ml-auto w-8 text-xs" />
          <SkeletonLine className="ml-auto w-8 text-xs" />
        </div>
      </div>
    </div>
  );
}
