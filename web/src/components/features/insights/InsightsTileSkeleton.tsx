import { InfoNote } from '@/components/features/insights/InfoNote';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonBlock } from '@/components/shared/skeleton/SkeletonBlock';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { TileBones } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTileSkeleton({
  label,
  note,
  wide,
  delta,
  detail,
  trend,
}: TileBones) {
  return (
    <SkeletonBlock>
      <div
        data-slot="insights-tile"
        className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      >
        <dt className="flex min-h-6 items-center gap-1.5 px-3 pt-3 pb-2 text-foreground text-xs">
          {label === null ? (
            <SkeletonLine className="w-20" />
          ) : (
            <span className="truncate">{label}</span>
          )}
          {note && <InfoNote note={note} />}
        </dt>
        <dd className="flex flex-1 flex-col gap-1 px-3 pb-3">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <SkeletonLine
              className={cn(
                wide ? 'w-20' : 'w-12',
                'text-[1.375rem] leading-none',
              )}
            />
            {delta && <SkeletonLine className="w-12 text-xs" />}
          </span>
          {typeof detail === 'string' ? (
            <span className="text-[0.7rem] text-muted-foreground">
              {detail}
            </span>
          ) : (
            detail && <SkeletonLine className="w-20 text-[0.7rem]" />
          )}
          {trend && (
            <span className="mt-auto pt-1">
              <Skeleton className="h-8 w-full" />
            </span>
          )}
        </dd>
      </div>
    </SkeletonBlock>
  );
}
